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
  L: '1',
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
  let cleaned = line.replace(labelRegex, '')
  // Hapus subtitle label bahasa Inggris pada format bilingual e-KTP (misal: / NAME, / ADDRESS, dll.)
  cleaned = cleaned.replace(
    /^[\s/]*(name|address|occupation|nationality|religion|sex|blood\s*type|place\s*[/.,\s]*(?:date)?\s*(?:of)?\s*birth|date\s*of\s*birth|place|marital\s*status)\b/i,
    ''
  )
  return cleaned.replace(/^[:;.,\s\-/\\|=]+/, '').trim()
}

/**
 * Ekstraksi NIK (16 digit) dengan OCR post-correction
 */
export function extractNik(lines: string[], fullText: string): string {
  // 1. Coba cari baris yang memuat kata kunci NIK (termasuk variasi OCR: MK, M1K, N1K, N!K)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\b(N[I!|1lL]K|N1K|MK|M1K)\b/i.test(line)) {
      // Ambil sisa teks setelah label NIK
      const afterLabel = line.replace(/.*?\b(N[I!|1lL]K|N1K|MK|M1K)\b[:;\s=5]*/i, '').trim()
      const candidate = correctOcrDigits(afterLabel).replace(/\D/g, '')
      if (candidate.length === 16) {
        return candidate
      }
      if (candidate.length > 16) {
        const validMatch = candidate.match(/([1-9][0-9]{15})/)
        if (validMatch) return validMatch[1]
        return candidate.slice(0, 16)
      }

      // Cek baris berikutnya jika baris ini hanya berisi label NIK
      if (i + 1 < lines.length) {
        const nextLineCandidate = correctOcrDigits(lines[i + 1]).replace(/\D/g, '')
        if (nextLineCandidate.length === 16) {
          return nextLineCandidate
        }
        if (nextLineCandidate.length > 16) {
          const match = nextLineCandidate.match(/([1-9][0-9]{15})/)
          if (match) return match[1]
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
    if (corrected.length > 16) {
      const match = corrected.match(/([1-9][0-9]{15})/)
      if (match) return match[1]
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
        /.*?(tempat\s*[/.,\s]*(?:tgl|tanggal)?\s*lahir|tgl\s*lahir|tempat\s*lahir|lahir)/i
      )
      if (!rawValue && i + 1 < lines.length) {
        rawValue = lines[i + 1].trim()
      }
      if (rawValue) break
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
  if (!rawDate || !rawDate.trim()) return ''
  // Ganti karakter OCR tertukar pada angka tanggal
  const corrected = correctOcrDigits(rawDate)
  // Cocokkan pola angka 2 digit - 2 digit - 4 digit
  const match = corrected.match(/\b([0-3]?[0-9])[\s\-./]+([0-1]?[0-9])[\s\-./]+((?:19|20)\d{2})\b/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3]
    return `${day}-${month}-${year}`
  }
  // Pola tanpa delimiter (misal 8 digit berurutan DDMMYYYY)
  const continuousMatch = corrected.match(/\b([0-3][0-9])([0-1][0-9])((?:19|20)\d{2})\b/)
  if (continuousMatch) {
    return `${continuousMatch[1]}-${continuousMatch[2]}-${continuousMatch[3]}`
  }
  return ''
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
  // Pastikan BUKAN bagian dari tanggal lahir DD/MM/YYYY (negatif lookahead tahun 19xx/20xx)
  const fallbackMatch = fullText.match(
    /\b([0-9a-zA-Z]{1,3})\s*[/]\s*([0-9a-zA-Z]{1,3})\b(?!\s*[/]\s*(?:19|20)\d{2})/
  )
  if (fallbackMatch) {
    const rawLeft = fallbackMatch[1].toUpperCase()
    const rawRight = fallbackMatch[2].toUpperCase()
    if (!['RT', 'RW', 'KEL', 'DES', 'KEC'].includes(rawLeft)) {
      const rt = correctOcrDigits(rawLeft).replace(/\D/g, '')
      const rw = correctOcrDigits(rawRight).replace(/\D/g, '')
      if (rt && rw && rt.length <= 3 && rw.length <= 3) {
        return `${rt.padStart(3, '0')}/${rw.padStart(3, '0')}`
      }
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
  if (!fullText.trim()) return ''

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

  return 'WNI' // Default pada e-KTP Indonesia jika terdeteksi teks
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
 * Ekstraksi Alamat lengkap dengan dukungan multi-line (wrap)
 * Menangani kasus di mana nomor rumah atau nama dusun berlanjut ke baris kedua
 * (misal: "JLN SILABERANTI GG KELAPA NO" dilanjutkan "08" atau "DUSUN IX PEKAN BUKIT" dilanjutkan "SELAMAT")
 */
export function extractAlamat(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\balamat\b/i.test(line)) {
      let val = cleanLabelPrefix(line, /.*?\balamat\b/i).replace(/[:;]+/, '').trim()
      if (!val && i + 1 < lines.length) {
        val = lines[i + 1].trim()
        i++
      }

      // Periksa apakah baris berikutnya adalah kelanjutan alamat (bukan label KTP baru)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        const isNextLabel =
          /\b(RT|RW|Kel|Desa|Kecamatan|Kec\b|Agama|Status|Pekerjaan|Kewarganegaraan|NIK|Nama|Tempat|Jenis)\b/i.test(
            nextLine
          )
        if (!isNextLabel && nextLine.length > 0 && nextLine.length < 50) {
          val = `${val} ${nextLine}`.trim()
        }
      }

      return val.toUpperCase()
    }
  }
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
 * Smart NIK & Date Cross-Validation:
 * Melakukan validasi silang antara 6 digit tanggal lahir di dalam NIK (DDMMYY)
 * terhadap field tanggal lahir tertulis (DD-MM-YYYY) dan jenis kelamin.
 *
 * Aturan NIK Nasional (UU No. 23/2006):
 * - Digit 7-8: Tanggal lahir.
 *   - Laki-laki: 01 s/d 31
 *   - Perempuan: Tanggal lahir + 40 (41 s/d 71)
 * - Digit 9-10: Bulan lahir (01 s/d 12)
 * - Digit 11-12: 2 digit terakhir tahun lahir (YY)
 *
 * Logika Rekonsiliasi & Auto-Repair:
 * 1. Jika NIK valid 16 digit dan tanggal lahir kosong/rusak, ekstrak tanggal lahir & gender dari NIK.
 * 2. Jika tanggal lahir tertulis valid dan NIK mengalami kesalahan OCR minor (1-2 digit berbeda pada posisi 7-12,
 *    misal 3<->8, 1<->7, 0<->8, 5<->6), koreksi digit tanggal lahir pada NIK agar NIK kembali valid 100%.
 * 3. Jika gender kosong, simpulkan dari digit hari NIK (> 40 = PEREMPUAN, <= 31 = LAKI-LAKI).
 */
export function crossValidateNikAndDate(
  nik: string,
  tanggalLahir: string,
  jenisKelamin: string,
  options: { inferMissing?: boolean } = {}
): {
  nik: string
  tanggalLahir: string
  jenisKelamin: string
  repaired: boolean
} {
  const { inferMissing = false } = options
  let reconciledNik = nik
  let reconciledTanggalLahir = tanggalLahir
  let reconciledJenisKelamin = jenisKelamin
  let repaired = false

  const isNik16 = /^\d{16}$/.test(reconciledNik)

  if (isNik16) {
    const rawDay = parseInt(reconciledNik.slice(6, 8), 10)
    const rawMonth = parseInt(reconciledNik.slice(8, 10), 10)
    const rawYear2 = reconciledNik.slice(10, 12)

    const isFemaleByNik = rawDay >= 41 && rawDay <= 71
    const isMaleByNik = rawDay >= 1 && rawDay <= 31
    const birthDay = isFemaleByNik ? rawDay - 40 : rawDay

    // Inferensi jenis kelamin jika kosong
    if (!reconciledJenisKelamin) {
      if (isFemaleByNik) {
        reconciledJenisKelamin = 'PEREMPUAN'
        repaired = true
      } else if (isMaleByNik) {
        reconciledJenisKelamin = 'LAKI-LAKI'
        repaired = true
      }
    }

    // Cek apakah tanggal lahir tertulis valid DD-MM-YYYY
    const hasValidWrittenDate = /^\d{2}-\d{2}-\d{4}$/.test(reconciledTanggalLahir)

    // Rekonstruksi tanggal lahir jika kosong dan opsi inferMissing aktif
    if (!hasValidWrittenDate && inferMissing) {
      if (birthDay >= 1 && birthDay <= 31 && rawMonth >= 1 && rawMonth <= 12) {
        const yearInt = parseInt(rawYear2, 10)
        // e-KTP diterbitkan untuk usia >= 17 tahun
        const century = yearInt > 26 ? '19' : '20'
        reconciledTanggalLahir = `${String(birthDay).padStart(2, '0')}-${String(rawMonth).padStart(2, '0')}-${century}${rawYear2}`
        repaired = true
      }
    } else if (hasValidWrittenDate) {
      // Keduanya ada: Uji kecocokan dan koreksi jika ada disinkronisasi akibat salah baca OCR
      const tMatch = reconciledTanggalLahir.match(/^(\d{2})-(\d{2})-(\d{4})$/)
      if (tMatch) {
        const tDay = parseInt(tMatch[1], 10)
        const tMonth = parseInt(tMatch[2], 10)
        const tYear2 = tMatch[3].slice(-2)

        const isFemale = reconciledJenisKelamin === 'PEREMPUAN' || isFemaleByNik
        const expectedDayCode = isFemale ? tDay + 40 : tDay
        const expectedDateCode = `${String(expectedDayCode).padStart(2, '0')}${String(tMonth).padStart(2, '0')}${tYear2}`
        const nikDateCode = reconciledNik.slice(6, 12)

        // Deteksi apakah NIK date code tidak valid menurut UU KTP (hari/bulan mustahil)
        const isNikDateInvalid =
          rawDay < 1 ||
          (rawDay > 31 && rawDay < 41) ||
          rawDay > 71 ||
          rawMonth < 1 ||
          rawMonth > 12

        if (isNikDateInvalid) {
          // Tanggal di NIK mustahil menurut hukum KTP -> perbaiki dari tanggal lahir tertulis
          if (tDay >= 1 && tDay <= 31 && tMonth >= 1 && tMonth <= 12) {
            reconciledNik = reconciledNik.slice(0, 6) + expectedDateCode + reconciledNik.slice(12)
            repaired = true
          }
        } else if (nikDateCode !== expectedDateCode) {
          // Keduanya memiliki tanggal secara sintaksis valid, tapi berbeda 1 digit (kesalahan tipikal OCR).
          // Perbaiki NIK jika pola gender konsisten
          const genderConsistent = (isFemale && rawDay > 40) || (!isFemale && rawDay <= 31)
          if (genderConsistent) {
            let diffCount = 0
            for (let i = 0; i < 6; i++) {
              if (nikDateCode[i] !== expectedDateCode[i]) diffCount++
            }
            if (diffCount === 1) {
              reconciledNik = reconciledNik.slice(0, 6) + expectedDateCode + reconciledNik.slice(12)
              repaired = true
            }
          }
        }
      }
    }
  } else if (reconciledNik.length === 16 && !/^\d{16}$/.test(reconciledNik)) {
    // NIK panjang 16 tapi memuat karakter non-digit: koreksi digit via correctOcrDigits
    const cleaned = correctOcrDigits(reconciledNik).replace(/\D/g, '')
    if (cleaned.length === 16) {
      reconciledNik = cleaned
      repaired = true
    }
  }

  return {
    nik: reconciledNik,
    tanggalLahir: reconciledTanggalLahir,
    jenisKelamin: reconciledJenisKelamin,
    repaired,
  }
}

/**
 * Menggabungkan hasil ekstraksi dari dua pass OCR (Multi-Pass Fallback Strategy)
 * Memilih field terbaik, terbersih, dan tervalidasi dari masing-masing pass.
 */
export function mergeKtpResults(
  primary: KtpExtractionResult,
  secondary: KtpExtractionResult
): KtpExtractionResult {
  const mergedData: KtpData = { ...primary.data }

  // 1. Prioritas NIK: pilih yang valid 16 digit
  const pNikValid = primary.data.nik.length === 16 && /^\d{16}$/.test(primary.data.nik)
  const sNikValid = secondary.data.nik.length === 16 && /^\d{16}$/.test(secondary.data.nik)

  if (!pNikValid && sNikValid) {
    mergedData.nik = secondary.data.nik
  } else if (pNikValid && !sNikValid) {
    mergedData.nik = primary.data.nik
  } else if (!pNikValid && !sNikValid) {
    mergedData.nik =
      secondary.data.nik.length > primary.data.nik.length ? secondary.data.nik : primary.data.nik
  }

  // 2. Dictionary-validated fields
  const standardOptions: Record<string, string[]> = {
    agama: ['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU'],
    statusPerkawinan: ['BELUM KAWIN', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI'],
    golonganDarah: ['A', 'B', 'AB', 'O'],
    jenisKelamin: ['LAKI-LAKI', 'PEREMPUAN'],
    kewarganegaraan: ['WNI', 'WNA'],
  }

  for (const [key, validList] of Object.entries(standardOptions)) {
    const k = key as keyof KtpData
    const pVal = primary.data[k]
    const sVal = secondary.data[k]
    if (validList.includes(sVal) && !validList.includes(pVal)) {
      mergedData[k] = sVal
    } else if (!pVal && sVal) {
      mergedData[k] = sVal
    }
  }

  // 3. Format-specific text fields
  const generalFields: (keyof KtpData)[] = [
    'nama',
    'tempatLahir',
    'tanggalLahir',
    'alamat',
    'rtRw',
    'kelDesa',
    'kecamatan',
    'pekerjaan',
  ]

  for (const k of generalFields) {
    const pVal = primary.data[k] || ''
    const sVal = secondary.data[k] || ''
    if (!pVal && sVal) {
      mergedData[k] = sVal
    } else if (pVal && sVal) {
      if (k === 'tanggalLahir') {
        const pValidDate = /^\d{2}-\d{2}-\d{4}$/.test(pVal)
        const sValidDate = /^\d{2}-\d{2}-\d{4}$/.test(sVal)
        if (!pValidDate && sValidDate) mergedData[k] = sVal
      } else if (k === 'rtRw') {
        const pValidRt = /^\d{3}\/\d{3}$/.test(pVal)
        const sValidRt = /^\d{3}\/\d{3}$/.test(sVal)
        if (!pValidRt && sValidRt) mergedData[k] = sVal
      } else {
        // Bandingkan noise karakter aneh
        const pNoise = (pVal.match(/[^a-zA-Z0-9\s.,\-/]/g) || []).length
        const sNoise = (sVal.match(/[^a-zA-Z0-9\s.,\-/]/g) || []).length
        if (sNoise < pNoise || (sNoise === pNoise && sVal.length > pVal.length)) {
          mergedData[k] = sVal
        }
      }
    }
  }

  // 4. Lakukan cross-validation ulang pada hasil gabungan
  const reconciled = crossValidateNikAndDate(
    mergedData.nik,
    mergedData.tanggalLahir,
    mergedData.jenisKelamin
  )
  mergedData.nik = reconciled.nik
  mergedData.tanggalLahir = reconciled.tanggalLahir
  mergedData.jenisKelamin = reconciled.jenisKelamin

  const isNikValid = mergedData.nik.length === 16 && /^\d{16}$/.test(mergedData.nik)

  return {
    meta: {
      confidence: Math.round(Math.max(primary.meta.confidence, secondary.meta.confidence)),
      processingTimeMs: primary.meta.processingTimeMs + secondary.meta.processingTimeMs,
      nikValid: isNikValid,
      modeUsed: secondary.meta.modeUsed ?? primary.meta.modeUsed,
      retryFallbackUsed: true,
    },
    data: mergedData,
    rawText: `${primary.rawText}\n\n--- [Multi-Pass Fallback OCR] ---\n\n${secondary.rawText}`,
  }
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

  // 2. Ekstraksi Nama
  const nama = extractNama(lines)

  // 3. Ekstraksi Tempat & Tanggal Lahir
  const { tempatLahir, tanggalLahir } = extractTempatTanggalLahir(lines, normalizedRaw)

  // 4. Ekstraksi Jenis Kelamin & Golongan Darah
  const { jenisKelamin, golonganDarah } = extractJenisKelaminGolDarah(lines, normalizedRaw)

  // 5. Ekstraksi Alamat
  const alamat = extractAlamat(lines)

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

  // 13. Smart NIK & Date Cross-Validation (termasuk aturan wanita +40)
  const crossValidated = crossValidateNikAndDate(nik, tanggalLahir, jenisKelamin)
  const finalNik = crossValidated.nik
  const finalTanggalLahir = crossValidated.tanggalLahir
  const finalJenisKelamin = crossValidated.jenisKelamin
  const finalNikValid = finalNik.length === 16 && /^\d{16}$/.test(finalNik)

  const meta: KtpMeta = {
    confidence: Math.round(confidence),
    processingTimeMs: Math.round(processingTimeMs),
    nikValid: finalNikValid,
  }

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
    meta,
    data,
    rawText,
  }
}
