import type { KtpData, KtpExtractionResult, KtpMeta } from '../types/ktp'

/**
 * Peta penggantian karakter huruf yang sering tertukar OCR pada baris numerik
 */
const OCR_DIGIT_MAP: Record<string, string> = {
  O: '0',
  o: '0',
  D: '0',
  Q: '0',
  I: '1',
  l: '1',
  '|': '1',
  '!': '1',
  i: '1',
  ']': '1',
  '[': '1',
  Z: '2',
  z: '2',
  E: '3',
  e: '3',
  A: '4',
  a: '4',
  S: '5',
  s: '5',
  G: '6',
  b: '6',
  '?': '7',
  J: '7',
  B: '8',
  g: '9',
  q: '9',
}

/**
 * Mengoreksi karakter huruf menjadi angka berdasarkan peta substitusi OCR
 */
export function correctOcrDigits(rawInput: string): string {
  return rawInput
    .split('')
    .map((char) => OCR_DIGIT_MAP[char] ?? char)
    .join('')
}

/**
 * Membersihkan prefix label (seperti "Nama :", "NIK :", dll.) dari baris teks
 */
function cleanLabelPrefix(line: string, labelRegex: RegExp): string {
  return line.replace(labelRegex, '').replace(/^[:;.,\s-]+/, '').trim()
}

/**
 * Ekstraksi NIK (16 digit) dengan OCR post-correction
 */
export function extractNik(lines: string[], fullText: string): string {
  // 1. Coba cari baris yang memuat kata kunci NIK
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\b(N[I!|1l]K|N1K)\b/i.test(line)) {
      // Ambil sisa teks setelah label NIK
      const afterLabel = line.replace(/.*?\b(N[I!|1l]K|N1K)\b[:;\s]*/i, '').trim()
      const candidate = correctOcrDigits(afterLabel).replace(/\D/g, '')
      if (candidate.length >= 16) {
        return candidate.slice(0, 16)
      }

      // Cek baris berikutnya jika baris ini hanya berisi label NIK
      if (i + 1 < lines.length) {
        const nextLineCandidate = correctOcrDigits(lines[i + 1]).replace(/\D/g, '')
        if (nextLineCandidate.length >= 16) {
          return nextLineCandidate.slice(0, 16)
        }
      }
    }
  }

  // 2. Fallback: Cari deretan angka/karakter 16 digit yang mungkin adalah NIK di seluruh teks
  const allWords = fullText.split(/\s+/)
  for (const word of allWords) {
    const corrected = correctOcrDigits(word).replace(/\D/g, '')
    if (corrected.length === 16) {
      return corrected
    }
  }
  // 3. Fallback: Cari deretan 16 digit yang mungkin terpisah spasi atau tanda hubung
  const spacedNikMatch = correctOcrDigits(fullText).match(/\b(?:\d[\s-]?){15}\d\b/)
  if (spacedNikMatch) {
    const cleanSpaced = spacedNikMatch[0].replace(/\D/g, '')
    if (cleanSpaced.length === 16) {
      return cleanSpaced
    }
  }

  // 4. Fallback: Cari deretan angka terpanjang >= 16 digit
  const textCorrected = correctOcrDigits(fullText).replace(/[^\d\s]/g, '')
  const numbers = textCorrected.match(/\b\d{16}\b/)
  if (numbers && numbers[0]) {
    return numbers[0]
  }
  return ''
}

/**
 * Ekstraksi Tempat dan Tanggal Lahir
 */
export function extractTempatTanggalLahir(
  lines: string[],
  fullText: string
): { tempatLahir: string; tanggalLahir: string } {
  let rawValue = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/(tempat|tgl|tgllahir|lahir)/i.test(line)) {
      rawValue = cleanLabelPrefix(
        line,
        /.*?(tempat\s*[/&]?\s*tgl\.?\s*lahir|tempat\/tgl\s*lahir|tgl\s*lahir|tempat\s*lahir)/i
      )
      if (!rawValue && i + 1 < lines.length) {
        rawValue = lines[i + 1].trim()
      }
      break
    }
  }

  if (!rawValue) {
    // Fallback: cari pola Tanggal Lahir (DD-MM-YYYY atau DD/MM/YYYY) di fullText
    const dateMatch = fullText.match(/\b([0-3]?[0-9][-/\s][0-1]?[0-9][-/\s](?:19|20)\d{2})\b/)
    if (dateMatch) {
      rawValue = dateMatch[0]
    }
  }

  let tempatLahir = ''
  let tanggalLahir = ''

  if (rawValue) {
    // Cari bagian tanggal lahir dengan post-correction
    // Format tanggal KTP biasanya DD-MM-YYYY atau DD/MM/YYYY
    const parts = rawValue.split(/,|\s{2,}|\b(?=\d{2}[-/])/)

    if (parts.length >= 2) {
      tempatLahir = parts[0].replace(/[^a-zA-Z\s]/g, '').trim()
      const rawDate = parts.slice(1).join(' ').trim()
      tanggalLahir = normalizeDateString(rawDate)
    } else {
      // Coba regex pisahkan teks tempat dan tanggal
      const match = rawValue.match(/^([a-zA-Z\s]+)[,.\s]+(.*)$/)
      if (match) {
        tempatLahir = match[1].replace(/[^a-zA-Z\s]/g, '').trim()
        tanggalLahir = normalizeDateString(match[2])
      } else {
        // Hanya satu bagian, cek apakah ini tanggal atau tempat
        const maybeDate = normalizeDateString(rawValue)
        if (maybeDate) {
          tanggalLahir = maybeDate
        } else {
          tempatLahir = rawValue.replace(/[^a-zA-Z\s]/g, '').trim()
        }
      }
    }
  }

  return { tempatLahir, tanggalLahir }
}

/**
 * Normalisasi format tanggal DD-MM-YYYY dengan OCR post-correction
 */
export function normalizeDateString(rawDate: string): string {
  // Ganti karakter OCR tertukar pada angka tanggal
  const corrected = correctOcrDigits(rawDate)
  // Cocokkan pola angka 2 digit - 2 digit - 4 digit
  const match = corrected.match(/(\d{1,2})[\s\-./]+(\d{1,2})[\s\-./]+(\d{4})/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3]
    return `${day}-${month}-${year}`
  }
  return corrected.replace(/[^\d\-/]/g, '').trim()
}

/**
 * Ekstraksi Jenis Kelamin dan Golongan Darah
 */
export function extractJenisKelaminGolDarah(
  lines: string[],
  fullText: string
): { jenisKelamin: string; golonganDarah: string } {
  let jenisKelamin = ''
  let golonganDarah = ''

  // Deteksi jenis kelamin dari keseluruhan teks (mendukung OCR noise LAK1-LAK1, PEREMPU4N)
  if (/PEREMPU[A4]N|WAN[I!|1l]TA/i.test(fullText)) {
    jenisKelamin = 'PEREMPUAN'
  } else if (/LAK[I!|1l][\s\-_]*LAK[I!|1l]|LAK[I!|1l]/i.test(fullText)) {
    jenisKelamin = 'LAKI-LAKI'
  }

  // Deteksi Golongan Darah (AB harus dievaluasi sebelum [ABO0])
  const golMatch = fullText.match(
    /(?:gol\.?\s*darah|darah)\s*[:;\s]*(AB|[ABO0]|-)(?!\w)/i
  )
  if (golMatch) {
    const val = golMatch[1] ? golMatch[1].toUpperCase() : '-'
    golonganDarah = val === '0' ? 'O' : val
  } else {
    // Fallback: cari kata kunci khusus "Gol. Darah" pada baris
    for (const line of lines) {
      if (/gol\.?\s*darah/i.test(line)) {
        const bloodCandidate = line.replace(/.*gol\.?\s*darah[:;\s]*/i, '').trim()
        const bloodMatch = bloodCandidate.match(/\b(AB|A|B|O|-)\b/i)
        if (bloodMatch) {
          golonganDarah = bloodMatch[1].toUpperCase()
          break
        }
      }
    }
  }

  return { jenisKelamin, golonganDarah: golonganDarah || '-' }
}

/**
 * Ekstraksi RT/RW dengan OCR post-correction
 */
export function extractRtRw(lines: string[], fullText: string): string {
  // 1. Deteksi pola terpisah label seperti "RT 005 RW 002" atau "RT.005/RW.002"
  const rtRwPatternMatch = fullText.match(
    /\bRT\.?\s*([0-9a-zA-Z]{1,3})\s*[/,\s-]+\s*RW\.?\s*([0-9a-zA-Z]{1,3})\b/i
  )
  if (rtRwPatternMatch) {
    const rt = correctOcrDigits(rtRwPatternMatch[1]).replace(/\D/g, '')
    const rw = correctOcrDigits(rtRwPatternMatch[2]).replace(/\D/g, '')
    if (rt && rw) {
      return `${rt.padStart(3, '0')}/${rw.padStart(3, '0')}`
    }
  }
  // 2. Baris yang memuat label RT/RW
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\bRT[\s/\\]*RW\b/i.test(line)) {
      const rawVal = cleanLabelPrefix(line, /.*?\bRT[\s/\\]*RW\b/i)
      const corrected = correctOcrDigits(rawVal)
      const match = corrected.match(/(\d{1,3})[\s/\\]+(\d{1,3})/)
      if (match) {
        return `${match[1].padStart(3, '0')}/${match[2].padStart(3, '0')}`
      }
      if (rawVal.trim()) {
        return rawVal.trim()
      }
    }
  }

  // 3. Fallback scan format XXX/YYY di fullText
  const fallbackMatch = fullText.match(/\b([0-9a-zA-Z]{1,3})\s*[/]\s*([0-9a-zA-Z]{1,3})\b/)
  if (fallbackMatch) {
    const rt = correctOcrDigits(fallbackMatch[1]).replace(/\D/g, '')
    const rw = correctOcrDigits(fallbackMatch[2]).replace(/\D/g, '')
    if (rt && rw) {
      return `${rt.padStart(3, '0')}/${rw.padStart(3, '0')}`
    }
  }

  return ''
}

/**
 * Ekstraksi Agama
 */
export function extractAgama(lines: string[], fullText: string): string {
  const religionPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'ISLAM', pattern: /\b[I1!l|]SLAM\b/i },
    { name: 'KRISTEN', pattern: /\bKR[I1!l|]STEN\b/i },
    { name: 'KATOLIK', pattern: /\bK[A4]TOL[I1!l|]K\b/i },
    { name: 'HINDU', pattern: /\bH[I1!l|]NDU\b/i },
    { name: 'BUDDHA', pattern: /\bBUDD?H?A\b/i },
    { name: 'KONGHUCU', pattern: /\bKONGHUCU\b/i },
    { name: 'PENGHAYAT KEPERCAYAAN', pattern: /\bPENGHAYAT(\s+KEPERCAYAAN)?\b/i },
  ]

  for (const line of lines) {
    if (/\bagama\b/i.test(line)) {
      const val = cleanLabelPrefix(line, /.*?\bagama\b/i)
      for (const rel of religionPatterns) {
        if (rel.pattern.test(val)) return rel.name
      }
      if (val) return val.toUpperCase()
    }
  }

  // Fallback scan
  for (const rel of religionPatterns) {
    if (rel.pattern.test(fullText)) {
      return rel.name
    }
  }

  return ''
}

/**
 * Ekstraksi Status Perkawinan
 */
export function extractStatusPerkawinan(lines: string[], fullText: string): string {
  const statusPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'BELUM KAWIN', pattern: /\bBELUM\s+K[A4]W[I1!l|]N\b/i },
    { name: 'KAWIN', pattern: /\bK[A4]W[I1!l|]N\b/i },
    { name: 'CERAI HIDUP', pattern: /\bCERA[I1!l|]\s+H[I1!l|]DUP\b/i },
    { name: 'CERAI MATI', pattern: /\bCERA[I1!l|]\s+MAT[I1!l|]\b/i },
  ]

  for (const line of lines) {
    if (/status\s*perkawinan/i.test(line)) {
      const val = cleanLabelPrefix(line, /.*?status\s*perkawinan/i)
      for (const st of statusPatterns) {
        if (st.pattern.test(val)) return st.name
      }
      if (val) return val.toUpperCase()
    }
  }

  // Fallback scan (prioritaskan 'BELUM KAWIN' sebelum 'KAWIN')
  for (const st of statusPatterns) {
    if (st.pattern.test(fullText)) {
      return st.name
    }
  }

  return ''
}

/**
 * Ekstraksi Kewarganegaraan
 */
export function extractKewarganegaraan(lines: string[], fullText: string): string {
  if (/\bWNA\b/i.test(fullText)) return 'WNA'
  if (/\bWNI\b/i.test(fullText)) return 'WNI'

  for (const line of lines) {
    if (/kewarganegaraan/i.test(line)) {
      const val = cleanLabelPrefix(line, /.*?kewarganegaraan/i).toUpperCase()
      if (val.includes('WNI')) return 'WNI'
      if (val.includes('WNA')) return 'WNA'
      if (val) return val
    }
  }

  return 'WNI' // Default pada e-KTP Indonesia
}

/**
 * Ekstraksi Nama
 */
export function extractNama(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\b(nama|narna)\b/i.test(line)) {
      let val = cleanLabelPrefix(line, /.*?\b(nama|narna)(\s*[/]\s*name)?\b/i)
      if (!val && i + 1 < lines.length) {
        val = lines[i + 1].trim()
      }
      // Hapus karakter non-huruf yang bukan spasi
      val = val.replace(/[^a-zA-Z\s.',-]/g, '').trim()
      if (val.length > 2) {
        return val.toUpperCase()
      }
    }
  }

  // Fallback: Jika setelah NIK ada baris berhuruf kapital
  return ''
}

/**
 * Ekstraksi Alamat, Kel/Desa, Kecamatan, Pekerjaan
 */
export function extractFieldByKeyword(
  lines: string[],
  keywords: RegExp[],
  cleanRegex: RegExp
): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const kw of keywords) {
      if (kw.test(line)) {
        let val = cleanLabelPrefix(line, cleanRegex)
        if (!val && i + 1 < lines.length) {
          val = lines[i + 1].trim()
        }
        val = val.replace(/[:;]+/, '').trim()
        return val.toUpperCase()
      }
    }
  }
  return ''
}

/**
 * Parser utama KTP OCR ke Structured JSON
 */
export function parseKtpText(
  rawText: string,
  confidence: number = 0,
  processingTimeMs: number = 0
): KtpExtractionResult {
  const normalizedRaw = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // 1. Ekstraksi NIK
  const nik = extractNik(lines, normalizedRaw)
  const isNikValid = nik.length === 16 && /^\d{16}$/.test(nik)

  // 2. Ekstraksi Nama
  const nama = extractNama(lines)

  // 3. Ekstraksi Tempat & Tanggal Lahir
  const { tempatLahir, tanggalLahir } = extractTempatTanggalLahir(lines, normalizedRaw)

  // 4. Ekstraksi Jenis Kelamin & Golongan Darah
  const { jenisKelamin, golonganDarah } = extractJenisKelaminGolDarah(lines, normalizedRaw)

  // 5. Ekstraksi Alamat
  const alamat = extractFieldByKeyword(lines, [/\balamat\b/i], /.*?\balamat\b/i)

  // 6. Ekstraksi RT/RW
  const rtRw = extractRtRw(lines, normalizedRaw)

  // 7. Ekstraksi Kel/Desa
  const kelDesa = extractFieldByKeyword(
    lines,
    [/kelurahan\s*[/&]?\s*desa/i, /kel[/.\s]*desa/i, /\bdesa\b/i, /\bkelurahan\b/i],
    /.*?(kelurahan\s*[/&]?\s*desa|kel[/.\s]*desa|desa|kelurahan)/i
  )

  // 8. Ekstraksi Kecamatan
  const kecamatan = extractFieldByKeyword(
    lines,
    [/kecamatan/i, /\bkec\b/i],
    /.*?(kecamatan|kec\.?)/i
  )

  // 9. Ekstraksi Agama
  const agama = extractAgama(lines, normalizedRaw)

  // 10. Ekstraksi Status Perkawinan
  const statusPerkawinan = extractStatusPerkawinan(lines, normalizedRaw)

  // 11. Ekstraksi Pekerjaan
  const pekerjaan = extractFieldByKeyword(lines, [/pekerjaan/i], /.*?pekerjaan/i)

  // 12. Ekstraksi Kewarganegaraan
  const kewarganegaraan = extractKewarganegaraan(lines, normalizedRaw)

  const meta: KtpMeta = {
    confidence: Math.round(confidence),
    processingTimeMs: Math.round(processingTimeMs),
    nikValid: isNikValid,
  }

  const data: KtpData = {
    nik,
    nama,
    tempatLahir,
    tanggalLahir,
    jenisKelamin,
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
    meta,
    data,
    rawText,
  }
}
