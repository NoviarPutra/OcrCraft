import type { ByokExtractionResult, ByokQualityCheck } from '../types/byok'
import type { KtpData } from '../types/ktp'
import { correctOcrDigits, crossValidateNikAndDate } from './ktpParser'

/**
 * Mengekstrak konten pesan teks dari respons endpoint OpenAI-Compatible.
 * Menangani secara tangguh berbagai format:
 * 1. Format JSON standar OpenAI: { choices: [{ message: { content } }] }
 * 2. Format Server-Sent Events (SSE) streaming: baris berulang data: {"id": ..., "choices": [{"delta": ...}]}
 * 3. Format langsung tanpa pembungkus API: { "nik": ... }
 */
export function extractOpenAiResponseContent(rawResponseText: string): string {
  if (!rawResponseText || typeof rawResponseText !== 'string') {
    throw new Error('Respons dari server kosong.')
  }

  const trimmed = rawResponseText.trim()

  // 1. Cek apakah respons berupa format Server-Sent Events (SSE) streaming (diawali "data:")
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
    const lines = trimmed.split(/\r?\n/)
    let accumulatedContent = ''
    let parsedAnyChunk = false

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue

      const dataPayload = line.slice(5).trim()
      if (!dataPayload || dataPayload === '[DONE]') continue

      try {
        const chunk = JSON.parse(dataPayload) as {
          choices?: Array<{
            delta?: { content?: string }
            message?: { content?: string }
            text?: string
          }>
        }
        parsedAnyChunk = true
        const chunkContent =
          chunk.choices?.[0]?.delta?.content ??
          chunk.choices?.[0]?.message?.content ??
          chunk.choices?.[0]?.text ??
          ''
        accumulatedContent += chunkContent
      } catch {
        // Abaikan chunk individual jika ada malformed line
      }
    }

    if (parsedAnyChunk && accumulatedContent.trim().length > 0) {
      return accumulatedContent
    }
  }

  // 2. Coba parse sebagai objek JSON standar OpenAI
  try {
    const parsed = JSON.parse(trimmed) as {
      choices?: Array<{
        message?: { content?: string }
        delta?: { content?: string }
        text?: string
      }>
    }

    if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
      const content =
        parsed.choices[0]?.message?.content ??
        parsed.choices[0]?.delta?.content ??
        parsed.choices[0]?.text
      if (typeof content === 'string') {
        return content
      }
    }

    // Jika objek JSON langsung (bukan bungkus choices)
    return trimmed
  } catch {
    // Jika bukan JSON valid, kembalikan apa adanya agar extractJsonFromText dapat mencari {...}
    return trimmed
  }
}
export function extractJsonFromText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Respons model kosong atau bukan string.')
  }

  let text = rawText.trim()

  // 1. Ekstrak dari blok markdown ```json ... ``` atau ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch?.[1]) {
    text = codeBlockMatch[1].trim()
  }

  // 2. Jika masih ada teks pengantar di luar kurung kurawal, cari objek JSON terluar {...}
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1)
  } else {
    throw new Error('Tidak ditemukan struktur objek JSON valid pada respons model.')
  }

  // 3. Bersihkan trailing commas yang sering dihasilkan LLM: {"a": 1, } -> {"a": 1}
  text = text.replace(/,(\s*[}\]])/g, '$1')

  return text
}

interface RawLlmKtpObject {
  nik?: string | number
  nama?: string
  tempat_lahir?: string
  tempatLahir?: string
  tanggal_lahir?: string
  tanggalLahir?: string
  jenis_kelamin?: string
  jenisKelamin?: string
  golongan_darah?: string
  golonganDarah?: string
  alamat?:
    | string
    | {
        jalan?: string
        rt_rw?: string
        rtRw?: string
        kel_desa?: string
        kelDesa?: string
        kecamatan?: string
      }
  rt_rw?: string
  rtRw?: string
  kel_desa?: string
  kelDesa?: string
  kecamatan?: string
  agama?: string
  status_perkawinan?: string
  statusPerkawinan?: string
  pekerjaan?: string
  kewarganegaraan?: string
  quality_check?: {
    is_clear?: boolean
    blur_detected?: boolean
    glare_detected?: boolean
    issues?: string[]
  }
}

/**
 * Mem-parsing string respons LLM ke dalam struktur terstandar ByokExtractionResult
 */
export function parseByokVisionResponse(
  rawResponseText: string,
  metaContext: {
    modelUsed: string
    baseUrlUsed: string
    processingTimeMs: number
    fallbackWithoutJsonFormatUsed?: boolean
  }
): ByokExtractionResult {
  const jsonString = extractJsonFromText(rawResponseText)

  let parsedRaw: unknown
  try {
    parsedRaw = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(
      `Gagal mem-parsing JSON dari respons model: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!parsedRaw || typeof parsedRaw !== 'object') {
    throw new Error('Format respons model bukan merupakan objek JSON valid.')
  }

  const raw = parsedRaw as RawLlmKtpObject

  // 1. NIK extraction & sanitization
  let rawNik = String(raw.nik ?? '').trim()
  rawNik = correctOcrDigits(rawNik).replace(/\D/g, '')

  // 2. Nama
  const nama = String(raw.nama ?? '')
    .toUpperCase()
    .replace(/^NAMA\s*[:;.\s-]*/i, '')
    .trim()

  // 3. Tempat & Tanggal Lahir
  let tempatLahir = String(raw.tempat_lahir ?? raw.tempatLahir ?? '').trim().toUpperCase()
  let tanggalLahir = String(raw.tanggal_lahir ?? raw.tanggalLahir ?? '').trim()

  // Jika tanggal lahir menyatu di tempat lahir (misal "JAKARTA, 01-01-1990")
  if (!tanggalLahir && tempatLahir.includes(',')) {
    const parts = tempatLahir.split(',')
    tempatLahir = (parts[0] ?? '').trim()
    tanggalLahir = (parts[1] ?? '').trim()
  }

  // 4. Jenis Kelamin
  let jenisKelamin = String(raw.jenis_kelamin ?? raw.jenisKelamin ?? '').trim().toUpperCase()
  if (jenisKelamin.includes('LAKI')) {
    jenisKelamin = 'LAKI-LAKI'
  } else if (jenisKelamin.includes('PEREMPUAN') || jenisKelamin.includes('WANITA')) {
    jenisKelamin = 'PEREMPUAN'
  }

  // 5. Golongan Darah
  let golonganDarah = String(raw.golongan_darah ?? raw.golonganDarah ?? '').trim().toUpperCase()
  const bloodMatch = golonganDarah.match(/\b(AB|A|B|O)\b/i)
  if (bloodMatch?.[1]) {
    golonganDarah = bloodMatch[1].toUpperCase()
  } else if (!golonganDarah || golonganDarah === '-' || golonganDarah === 'TIDAK ADA') {
    golonganDarah = '-'
  }

  // 6. Alamat & Sub-objek
  let alamat = ''
  let rtRw = String(raw.rt_rw ?? raw.rtRw ?? '').trim()
  let kelDesa = String(raw.kel_desa ?? raw.kelDesa ?? '').trim().toUpperCase()
  let kecamatan = String(raw.kecamatan ?? '').trim().toUpperCase()

  if (typeof raw.alamat === 'object' && raw.alamat !== null) {
    alamat = String(raw.alamat.jalan ?? '').trim().toUpperCase()
    if (!rtRw) {
      rtRw = String(raw.alamat.rt_rw ?? raw.alamat.rtRw ?? '').trim()
    }
    if (!kelDesa) {
      kelDesa = String(raw.alamat.kel_desa ?? raw.alamat.kelDesa ?? '').trim().toUpperCase()
    }
    if (!kecamatan) {
      kecamatan = String(raw.alamat.kecamatan ?? '').trim().toUpperCase()
    }
  } else {
    alamat = String(raw.alamat ?? '').trim().toUpperCase()
  }

  // 7. Agama
  const agama = String(raw.agama ?? '').trim().toUpperCase()

  // 8. Status Perkawinan
  const statusPerkawinan = String(raw.status_perkawinan ?? raw.statusPerkawinan ?? '')
    .trim()
    .toUpperCase()

  // 9. Pekerjaan
  const pekerjaan = String(raw.pekerjaan ?? '').trim().toUpperCase()

  // 10. Kewarganegaraan
  let kewarganegaraan = String(raw.kewarganegaraan ?? '').trim().toUpperCase()
  if (kewarganegaraan.includes('WNI') || kewarganegaraan.includes('INDONESIA')) {
    kewarganegaraan = 'WNI'
  } else if (kewarganegaraan.includes('WNA') || kewarganegaraan.includes('ASING')) {
    kewarganegaraan = 'WNA'
  }

  // 11. Cross-check NIK vs Tanggal Lahir (termasuk aturan wanita +40)
  const crossValidated = crossValidateNikAndDate(rawNik, tanggalLahir, jenisKelamin, {
    inferMissing: false,
  })

  const finalNik = crossValidated.nik
  const finalTanggalLahir = crossValidated.tanggalLahir || tanggalLahir
  const finalJenisKelamin = crossValidated.jenisKelamin || jenisKelamin
  const nikValid = finalNik.length === 16 && /^\d{16}$/.test(finalNik)

  // 12. Quality Check
  const qc = raw.quality_check
  const qualityCheck: ByokQualityCheck = {
    isClear: typeof qc?.is_clear === 'boolean' ? qc.is_clear : true,
    blurDetected: typeof qc?.blur_detected === 'boolean' ? qc.blur_detected : false,
    glareDetected: typeof qc?.glare_detected === 'boolean' ? qc.glare_detected : false,
    issues: Array.isArray(qc?.issues) ? qc.issues.map(String) : [],
  }

  // 13. Hitung Confidence Score berbasis kelengkapan & validitas
  let confidence = 85
  if (nikValid) confidence += 10
  if (nama.length > 2) confidence += 2
  if (finalTanggalLahir.length >= 8) confidence += 2
  if (alamat.length > 3) confidence += 1
  if (qualityCheck.blurDetected) confidence -= 15
  if (qualityCheck.glareDetected) confidence -= 10
  if (!qualityCheck.isClear) confidence -= 10
  confidence = Math.max(10, Math.min(99, confidence))

  const data: KtpData = {
    nik: finalNik,
    nama,
    tempatLahir,
    tanggalLahir: finalTanggalLahir,
    jenisKelamin: finalJenisKelamin,
    golonganDarah,
    alamat,
    rtRw,
    kelDesa,
    kecamatan,
    agama,
    statusPerkawinan,
    pekerjaan,
    kewarganegaraan,
  }

  return {
    data,
    rawText: rawResponseText,
    qualityCheck,
    meta: {
      modelUsed: metaContext.modelUsed,
      baseUrlUsed: metaContext.baseUrlUsed,
      processingTimeMs: metaContext.processingTimeMs,
      nikValid,
      confidence,
      fallbackWithoutJsonFormatUsed: metaContext.fallbackWithoutJsonFormatUsed,
    },
  }
}
