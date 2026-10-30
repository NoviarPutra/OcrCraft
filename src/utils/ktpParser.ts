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

export const COMMON_KTP_KEYWORDS = [
  'PROVINSI', 'KABUPATEN',
  'SUMATERA', 'UTARA', 'SELATAN', 'BARAT', 'JAKARTA',
  'MUHAMMAD', 'MOHAMMAD', 'HATTA', 'SIREGAR', 'NASUTION', 'HASIBUAN', 'BATUBARA',
  'DUSUN', 'KELURAHAN', 'KECAMATAN', 'BUKIT', 'SELAMAT',
  'BELUM', 'KAWIN', 'CERAI', 'HIDUP',
  'PELAJAR', 'MAHASISWA', 'KARYAWAN', 'WIRASWASTA',
  'PEREMPUAN',
]

export function splitGluedWords(word: string): string {
  if (!word || word.length <= 5 || word.includes('/')) return word
  const upper = word.toUpperCase()
  for (const kw of COMMON_KTP_KEYWORDS) {
    if (upper.startsWith(kw) && word.length >= kw.length + 3) {
      const rest = word.slice(kw.length)
      return word.slice(0, kw.length) + ' ' + splitGluedWords(rest)
    }
    if (upper.endsWith(kw) && word.length >= kw.length + 3) {
      const front = word.slice(0, word.length - kw.length)
      return splitGluedWords(front) + ' ' + word.slice(word.length - kw.length)
    }
  }
  return word
}

export function recoverLexicalSpacing(text: string): string {
  if (!text) return ''
  let cleaned = text
    .replace(/[\uFF1A：]/g, ':')
    .replace(/[\uFF08（]/g, '(')
    .replace(/[\uFF09）]/g, ')')
    .replace(/[\uFF0F／]/g, '/')
    .replace(/[\uFF0D－]/g, '-')
    .replace(/[\uFF1B；]/g, ';')
    .replace(/[\uFF0C，]/g, ',')
    .replace(/[\u3002。]/g, '.')

  cleaned = cleaned.replace(/\bDUSUN([IVX]+)([A-Za-z]+)/gi, 'DUSUN $1 $2')
  cleaned = cleaned.replace(/\bDUSUN([IVX]+)\b/gi, 'DUSUN $1')
  cleaned = cleaned.replace(/BELUMKAW[I1!l|]N/gi, 'BELUM KAWIN')
  cleaned = cleaned.replace(/CERA[I1!l|]H[I1!l|]DUP/gi, 'CERAI HIDUP')
  cleaned = cleaned.replace(/CERA[I1!l|]MAT[I1!l|]/gi, 'CERAI MATI')
  cleaned = cleaned.replace(/LAK[I1!l|]LAK[I1!l|]/gi, 'LAKI-LAKI')
  cleaned = cleaned.replace(/PELAJARMAHAS[I1!l|]SWA/gi, 'PELAJAR/MAHASISWA')
  const tokens = cleaned.split(/\s+/)
  const separated = tokens.map((token) => {
    if (/^\d+$/.test(token) || /^\d{2}[-/.]\d{2}[-/.]\d{4}$/.test(token) || token.includes('/')) {
      return token
    }
    return splitGluedWords(token)
  })

  return separated
    .join(' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s{2,}/g, ' ')
    .trim()
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
  return cleaned.replace(/^[:;.,\s\-/\\|=\uFF1A\uFF1B]+/, '').trim()
}

/**
 * Mencari kandidat NIK 16 digit terbaik dari string angka panjang berdasarkan aturan hukum NIK RI:
 * - Kode provinsi: 11 s/d 94
 * - Hari lahir: 01-31 (Pria) atau 41-71 (Wanita)
 * - Bulan lahir: 01-12
 * - Kesesuaian 6 digit tengah (DDMMYY) dengan tanggal lahir tertulis & gender
 */
export function findBest16DigitNik(
  rawDigits: string,
  writtenDob?: string,
  gender?: string
): string {
  if (rawDigits.length === 16) return rawDigits
  if (rawDigits.length < 16) return ''

  let bestNik = rawDigits.slice(0, 16)
  let bestScore = -Infinity

  for (let i = 0; i <= rawDigits.length - 16; i++) {
    const candidate = rawDigits.slice(i, i + 16)
    const prov = parseInt(candidate.slice(0, 2), 10)
    const day = parseInt(candidate.slice(6, 8), 10)
    const month = parseInt(candidate.slice(8, 10), 10)
    const year2 = candidate.slice(10, 12)
    const dateSegment = candidate.slice(6, 12)

    let score = 0
    // Validitas kode provinsi Indonesia (11-94)
    if (prov >= 11 && prov <= 94) {
      score += 10
    } else {
      score -= 30
    }

    // Hari lahir sah: 01-31 (Laki-laki) atau 41-71 (Perempuan)
    if ((day >= 1 && day <= 31) || (day >= 41 && day <= 71)) {
      score += 15
    } else {
      score -= 50
    }

    // Bulan lahir sah: 01-12
    if (month >= 1 && month <= 12) {
      score += 20
    } else {
      score -= 100
    }

    // Korelasi dengan tanggal lahir tertulis (DD-MM-YYYY)
    if (writtenDob) {
      const match = writtenDob.match(/^(\d{2})-(\d{2})-(\d{4})$/)
      if (match) {
        const wDay = parseInt(match[1], 10)
        const wMonth = parseInt(match[2], 10)
        const wYear2 = match[3].slice(-2)
        const isFemale = gender === 'PEREMPUAN'
        const expectedDayCode = isFemale ? wDay + 40 : wDay
        const expectedDateSegment = `${String(expectedDayCode).padStart(2, '0')}${String(wMonth).padStart(2, '0')}${wYear2}`

        // Pencocokan presisi 6 digit tanggal lahir di tengah NIK
        if (dateSegment === expectedDateSegment) {
          score += 100
        } else {
          if (day === expectedDayCode || day === wDay || day === wDay + 40) score += 30
          if (month === wMonth) score += 30
          if (year2 === wYear2) score += 30
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestNik = candidate
    }
  }

  return bestNik
}

/**
 * Ekstraksi NIK (16 digit) dengan OCR post-correction
 */
export function extractNik(
  lines: string[],
  fullText: string,
  writtenDob?: string,
  gender?: string
): string {
  // 1. Coba cari baris yang memuat kata kunci NIK (termasuk variasi OCR: MK, M1K, N1K, N!K)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\b(N[I!|1lL]K|N1K|MK|M1K)\b/i.test(line)) {
      // Ambil substring SETELAH pemisah ':' / '：' / ';' terakhir jika ada
      // sehingga artefak digit sebelum titik dua (seperti '3:' atau '1:') terpotong
      let afterLabel = ''
      const lastColonIdx = Math.max(
        line.lastIndexOf(':'),
        line.lastIndexOf('\uFF1A'),
        line.lastIndexOf(';')
      )
      if (lastColonIdx !== -1 && lastColonIdx < line.length - 1) {
        afterLabel = line.slice(lastColonIdx + 1).trim()
      } else {
        afterLabel = line.replace(/.*?\b(N[I!|1lL]K|N1K|MK|M1K)\b[:;\s=5]*/i, '').trim()
      }

      const candidate = correctOcrDigits(afterLabel).replace(/\D/g, '')
      if (candidate.length === 16) {
        return candidate
      }
      if (candidate.length > 16) {
        const best = findBest16DigitNik(candidate, writtenDob, gender)
        if (best.length === 16) return best
      }

      // Cek baris berikutnya jika baris ini hanya berisi label NIK
      if (i + 1 < lines.length) {
        const nextLineCandidate = correctOcrDigits(lines[i + 1]).replace(/\D/g, '')
        if (nextLineCandidate.length === 16) {
          return nextLineCandidate
        }
        if (nextLineCandidate.length > 16) {
          const best = findBest16DigitNik(nextLineCandidate, writtenDob, gender)
          if (best.length === 16) return best
        }
      }
    }
  }

  // 2. Scan fullText untuk pola NIK dengan label fleksibel
  const nikRegex = /(?:NIK|MK|M1K|N1K)[\s:=5]*([0-9IlODSZAGB?]{16,})/gi
  let match: RegExpExecArray | null
  while ((match = nikRegex.exec(fullText)) !== null) {
    const corrected = correctOcrDigits(match[1]).replace(/\D/g, '')
    if (corrected.length === 16) return corrected
    if (corrected.length > 16) {
      const best = findBest16DigitNik(corrected, writtenDob, gender)
      if (best.length === 16) return best
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
  const numbers = textCorrected.match(/\b\d{16,}\b/)
  if (numbers && numbers[0]) {
    return findBest16DigitNik(numbers[0], writtenDob, gender)
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
    // Bersihkan prefix sisa kata label 'lahir' yang redundan (baik terpisah spasi maupun menempel)
    tempatLahir = tempatLahir
      .replace(/^(?:tempat\s*[/.,\s]*)?(?:tgl|tanggal)?\s*lahir\s*[:;：.\s]*/i, '')
      .trim()
    if (/^lahir/i.test(tempatLahir) && tempatLahir.length > 5) {
      tempatLahir = tempatLahir.replace(/^lahir\s*[:;：\uFF1A\uFF1B.,\s\-/|=]*/i, '').trim()
    }
    // Jika masih menempel (misal 'LahirBUKITSELAMAT')
    if (tempatLahir.toUpperCase().startsWith('LAHIR') && tempatLahir.length > 5) {
      tempatLahir = tempatLahir.slice(5).replace(/^[:;：\uFF1A\uFF1B.,\s\-/|=]+/, '').trim()
    }
    // Pulihkan spasi antar-kata leksikal
    tempatLahir = recoverLexicalSpacing(tempatLahir)
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
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

  // 1. Coba cari di baris yang secara spesifik memuat label Jenis Kelamin / Kelamin / Sex
  for (const line of lines) {
    if (/(jenis\s*k[eoa]lamin|k[eoa]lamin|keiamin|sex)\b/i.test(line)) {
      if (/PEREMPU[A4]N|WAN[I!|1l]TA/i.test(line)) {
        jenisKelamin = 'PEREMPUAN'
        break
      }
      if (
        /LAK[I!|1l]?[\s\-_/]*LAK[I!|1l]?|\bLAK[I!|1l]\b|\bLA[\s\-_]+LAK[I!|1l]?\b|\bPR[I1!l|]A\b/i.test(
          line
        )
      ) {
        jenisKelamin = 'LAKI-LAKI'
        break
      }
    }
  }

  // 2. Fallback scan dari fullText jika belum ditemukan di baris spesifik
  if (!jenisKelamin) {
    if (/PEREMPU[A4]N|WAN[I!|1l]TA/i.test(fullText)) {
      jenisKelamin = 'PEREMPUAN'
    } else if (
      /LAK[I!|1l]?[\s\-_/]*LAK[I!|1l]?|\bLAK[I!|1l]\b|\bLA[\s\-_]+LAK[I!|1l]?\b|\bPR[I1!l|]A\b/i.test(
        fullText
      )
    ) {
      jenisKelamin = 'LAKI-LAKI'
    }
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
    { name: 'BELUM KAWIN', pattern: /\bBELUM\s*K[A4]W[I1!l|]N\b/i },
    { name: 'KAWIN', pattern: /\bK[A4]W[I1!l|]N\b/i },
    { name: 'CERAI HIDUP', pattern: /\bCERA[I1!l|]\s*H[I1!l|]DUP\b/i },
    { name: 'CERAI MATI', pattern: /\bCERA[I1!l|]\s*MAT[I1!l|]\b/i },
  ]

  for (const line of lines) {
    if (/status\s*perkawinan/i.test(line)) {
      let val = cleanLabelPrefix(line, /.*?status\s*perkawinan/i)
      if (!val) continue
      val = val.replace(/^[:;：\uFF1A\uFF1B.,\s\-/|=]+/, '').trim()
      // Hapus tanggal terbit atau angka di ujung (misal '07-08-2012' yang bocor)
      val = val.replace(/\s*\d{2}[-/.]\d{2}[-/.]\d{4}.*$/, '').trim()
      for (const st of statusPatterns) {
        if (st.pattern.test(val)) {
          return st.name
        }
      }
      return val.toUpperCase()
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
      val = val.replace(/^[:;：\uFF1A\uFF1B.,\s\-/|=]+/, '').trim()
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
    if (/\b(a[l1!|i]?amat|aamat|alarnat|alanat|aiamat)\b/i.test(line)) {
      let val = cleanLabelPrefix(line, /.*?\b(a[l1!|i]?amat|aamat|alarnat|alanat|aiamat)\b/i)
        .replace(/^[:;：\uFF1A\uFF1B.,\s\-/|=]+/, '')
        .trim()
      if (!val && i + 1 < lines.length) {
        val = lines[i + 1].trim()
        i++
      }

      // Periksa apakah baris berikutnya adalah kelanjutan alamat (bukan label KTP baru)
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        const isNextLabel =
          /\b(RT|RW|Kel|Desa|Kecamatan|Kec\b|Agama|Status|Pekerjaan|Kewarganegaraan|NIK|Nama|Tempat|Jenis)\b/i.test(
            nextLine
          )
        if (!isNextLabel && nextLine.length > 0 && nextLine.length < 60) {
          val = `${val} ${nextLine}`.trim()
          i++
        } else {
          break
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
        val = val.replace(/^[:;：\uFF1A\uFF1B.,\s\-/|=]+/, '').trim()
        val = recoverLexicalSpacing(val)
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

        // Kunci mutlak jenis kelamin: jika sudah terdeteksi LAKI-LAKI / PEREMPUAN, jangan pernah ditimpa oleh NIK!
        const isFemale =
          reconciledJenisKelamin === 'PEREMPUAN'
            ? true
            : reconciledJenisKelamin === 'LAKI-LAKI'
              ? false
              : isFemaleByNik
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

  // 1. Ekstraksi Tempat & Tanggal Lahir (didahulukan untuk membimbing skor pemilihan NIK)
  const { tempatLahir, tanggalLahir } = extractTempatTanggalLahir(lines, normalizedRaw)

  // 2. Ekstraksi Jenis Kelamin & Golongan Darah (didahulukan sebelum NIK untuk mengunci gender)
  const { jenisKelamin, golonganDarah } = extractJenisKelaminGolDarah(lines, normalizedRaw)

  // 3. Ekstraksi NIK dengan parameter tanggal lahir dan jenis kelamin
  const nik = extractNik(lines, normalizedRaw, tanggalLahir, jenisKelamin)

  // 4. Ekstraksi Nama
  const nama = extractNama(lines)
  // 5. Ekstraksi Alamat
  const alamat = extractAlamat(lines)

  // 6. Ekstraksi RT/RW
  const rtRw = extractRtRw(lines, normalizedRaw)

  // 7. Ekstraksi Kel/Desa
  const kelDesa = extractFieldByKeyword(
    lines,
    [
      /kelurahan\s*[/&]?\s*desa/i,
      /kel[/.\s]*desa/i,
      /ke[il1!|]\s*[/&.\s]*desa/i,
      /\bdesa\b/i,
      /\bkelurahan\b/i,
    ],
    /.*?(kelurahan\s*[/&]?\s*desa|kel[/.\s]*desa|ke[il1!|]\s*[/&.\s]*desa|desa|kelurahan)/i
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
