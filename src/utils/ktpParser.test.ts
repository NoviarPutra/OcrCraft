import { describe, expect, it } from 'vitest'
import {
  correctOcrDigits,
  crossValidateNikAndDate,
  extractNik,
  extractRtRw,
  extractTempatTanggalLahir,
  mergeKtpResults,
  normalizeDateString,
  parseKtpText,
} from './ktpParser'
import { validateKtpImageFile } from './fileValidator'

describe('OCR Digit Post-Correction', () => {
  it('corrects character substitutions in numeric sequences', () => {
    // O/D -> 0, I/l -> 1, Z -> 2, S -> 5, G -> 6, ? -> 7, B -> 8
    const raw = 'O D I l Z S G ? B'
    const corrected = correctOcrDigits(raw)
    expect(corrected).toBe('0 0 1 1 2 5 6 7 8')
  })

  it('corrects noisy NIK with letters to 16 digits', () => {
    const noisyNik = '3I7IOIOIOI9OOOOI'
    const corrected = correctOcrDigits(noisyNik)
    expect(corrected).toBe('3171010101900001')
    expect(corrected.length).toBe(16)
  })
})

describe('KTP Field Extractors', () => {
  it('extracts NIK from a line with label', () => {
    const lines = ['PROVINSI DKI JAKARTA', 'NIK : 3171010101900001', 'Nama : BUDI SANTOSO']
    const nik = extractNik(lines, lines.join('\n'))
    expect(nik).toBe('3171010101900001')
  })

  it('extracts NIK when label and digits are on separate lines with OCR noise', () => {
    const lines = ['PROVINSI DKI JAKARTA', 'NIK', '3I7IOIOIOI9OOOOI', 'Nama : BUDI SANTOSO']
    const nik = extractNik(lines, lines.join('\n'))
    expect(nik).toBe('3171010101900001')
  })

  it('extracts and normalizes Tempat & Tanggal Lahir', () => {
    const lines = ['Tempat/Tgl Lahir : JAKARTA, 01-O1-199O']
    const res = extractTempatTanggalLahir(lines, lines[0])
    expect(res.tempatLahir).toBe('JAKARTA')
    expect(res.tanggalLahir).toBe('01-01-1990')
  })

  it('extracts and pads RT/RW correctly with OCR noise', () => {
    const lines = ['RT/RW : OO1/OO2']
    const rtRw = extractRtRw(lines, lines[0])
    expect(rtRw).toBe('001/002')
  })

  it('normalizes date with slash or space separators', () => {
    expect(normalizeDateString('15/08/1995')).toBe('15-08-1995')
    expect(normalizeDateString('05 12 2000')).toBe('05-12-2000')
  })
  it('extracts spaced NIK without explicit label', () => {
    const fullText = 'PROVINSI DKI JAKARTA\n3171 0101 0190 0001\nNAMA : AHMAD'
    const lines = fullText.split('\n')
    expect(extractNik(lines, fullText)).toBe('3171010101900001')
  })

  it('extracts separated RT 005 RW 002 format correctly', () => {
    const fullText = 'ALAMAT : JL SUDIRMAN\nRT 005 RW 002\nKEL/DESA : KARET'
    const lines = fullText.split('\n')
    expect(extractRtRw(lines, fullText)).toBe('005/002')
  })
})

describe('Full KTP Parser (parseKtpText)', () => {
  it('parses realistic clean e-KTP raw text into valid JSON', () => {
    const rawOcr = `
PROVINSI DKI JAKARTA
JAKARTA PUSAT
NIK : 3171010101900001
Nama : BUDI SANTOSO
Tempat/Tgl Lahir : JAKARTA, 01-01-1990
Jenis Kelamin : LAKI-LAKI  Gol. Darah : O
Alamat : JL. SUDIRMAN NO. 45
RT/RW : 005/002
Kel/Desa : GELORA
Kecamatan : TANAH ABANG
Agama : ISLAM
Status Perkawinan : KAWIN
Pekerjaan : KARYAWAN SWASTA
Kewarganegaraan : WNI
Berlaku Hingga : SEUMUR HIDUP
`
    const result = parseKtpText(rawOcr, 92, 1250)

    expect(result.meta.confidence).toBe(92)
    expect(result.meta.processingTimeMs).toBe(1250)
    expect(result.meta.nikValid).toBe(true)

    expect(result.data.nik).toBe('3171010101900001')
    expect(result.data.nama).toBe('BUDI SANTOSO')
    expect(result.data.tempatLahir).toBe('JAKARTA')
    expect(result.data.tanggalLahir).toBe('01-01-1990')
    expect(result.data.jenisKelamin).toBe('LAKI-LAKI')
    expect(result.data.golonganDarah).toBe('O')
    expect(result.data.alamat).toBe('JL. SUDIRMAN NO. 45')
    expect(result.data.rtRw).toBe('005/002')
    expect(result.data.kelDesa).toBe('GELORA')
    expect(result.data.kecamatan).toBe('TANAH ABANG')
    expect(result.data.agama).toBe('ISLAM')
    expect(result.data.statusPerkawinan).toBe('KAWIN')
    expect(result.data.pekerjaan).toBe('KARYAWAN SWASTA')
    expect(result.data.kewarganegaraan).toBe('WNI')
  })

  it('handles noisy OCR text and auto-corrects corrupted characters', () => {
    const rawOcr = `
PROVINSI JAWA BARAT
KABUPATEN BANDUNG
N1K : 3204OI25O895OOO2
Nama : SITI AMINAH
Tempat/Tgl Lahir : BANDUNG, 25-OB-1995
Jenis Kelamin : PEREMPUAN Gol. Darah : B
Alamat : JL. ASIA AFRIKA NO. 10
RT/RW : O1/O4
Kel/Desa : BRAGA
Kecamatan : SUMUR BANDUNG
Agama : ISLAM
Status Perkawinan : BELUM KAWIN
Pekerjaan : WIRASWASTA
Kewarganegaraan : WNI
`
    const result = parseKtpText(rawOcr, 85, 950)

    expect(result.meta.nikValid).toBe(true)
    expect(result.data.nik).toBe('3204012508950002')
    expect(result.data.nama).toBe('SITI AMINAH')
    expect(result.data.tempatLahir).toBe('BANDUNG')
    expect(result.data.tanggalLahir).toBe('25-08-1995')
    expect(result.data.jenisKelamin).toBe('PEREMPUAN')
    expect(result.data.golonganDarah).toBe('B')
    expect(result.data.rtRw).toBe('001/004')
    expect(result.data.statusPerkawinan).toBe('BELUM KAWIN')
  })

  it('marks nikValid false when NIK is missing or corrupted beyond 16 digits', () => {
    const rawOcr = `
PROVINSI BALI
NIK : 12345
Nama : I WAYAN
`
    const result = parseKtpText(rawOcr, 50, 400)
    expect(result.meta.nikValid).toBe(false)
  })

  it('does not throw on empty string and leaves all fields empty', () => {
    const result = parseKtpText('', 0, 0)
    expect(result.meta.confidence).toBe(0)
    expect(result.meta.nikValid).toBe(false)
    expect(result.data.nik).toBe('')
    expect(result.data.nama).toBe('')
    expect(result.data.kewarganegaraan).toBe('')
  })
  it('handles bilingual labels and noisy religion/marital/gender values', () => {
    const noisySample = `
      PROVINSI JAWA TIMUR
      KABUPATEN SIDOARJO
      N1K : 3515082005900003
      NAMA / NAME : SITI NURHALIZA
      TEMPAT/TGL LAHIR : SIDOARJO, 20-05-1990
      JENIS KELAMIN : PEREMPU4N GOL. DARAH : AB
      ALAMAT : JL CEMPAKA NO 10
      RT 003 RW 007
      KEL/DESA : SIDOKARE
      KECAMATAN : SIDOARJO
      AGAMA : 1SLAM
      STATUS PERKAWINAN : BELUM KAW1N
      PEKERJAAN : KARYAWAN SWASTA
      KEWARGANEGARAAN : WNI
    `
    const result = parseKtpText(noisySample, 89, 450)
    expect(result.data.nama).toBe('SITI NURHALIZA')
    expect(result.data.jenisKelamin).toBe('PEREMPUAN')
    expect(result.data.golonganDarah).toBe('AB')
    expect(result.data.agama).toBe('ISLAM')
    expect(result.data.statusPerkawinan).toBe('BELUM KAWIN')
    expect(result.data.rtRw).toBe('003/007')
  })

  it('correctly strips bilingual English secondary labels from all fields', () => {
    const bilingualSample = `
      PROVINSI DKI JAKARTA
      KOTA ADM. JAKARTA SELATAN
      NIK : 3171010101900001
      NAMA / NAME : BUDI SANTOSO
      TEMPAT/TGL LAHIR / PLACE/DATE OF BIRTH : JAKARTA, 01-01-1990
      JENIS KELAMIN / SEX : LAKI-LAKI GOL. DARAH / BLOOD TYPE : O
      ALAMAT / ADDRESS : JL. JEND. SUDIRMAN NO. 1
      RT/RW : 001/002
      KEL/DESA : KARET SEMANGGI
      KECAMATAN : SETIABUDI
      AGAMA / RELIGION : ISLAM
      STATUS PERKAWINAN / MARITAL STATUS : KAWIN
      PEKERJAAN / OCCUPATION : KARYAWAN SWASTA
      KEWARGANEGARAAN / NATIONALITY : WNI
    `
    const result = parseKtpText(bilingualSample, 95, 300)
    expect(result.data.nama).toBe('BUDI SANTOSO')
    expect(result.data.tempatLahir).toBe('JAKARTA')
    expect(result.data.tanggalLahir).toBe('01-01-1990')
    expect(result.data.alamat).toBe('JL. JEND. SUDIRMAN NO. 1')
    expect(result.data.pekerjaan).toBe('KARYAWAN SWASTA')
    expect(result.data.agama).toBe('ISLAM')
    expect(result.data.statusPerkawinan).toBe('KAWIN')
    expect(result.data.kewarganegaraan).toBe('WNI')
  })

  it('extracts multi-line wrapped addresses properly', () => {
    const sample = `
      PROVINSI SUMATERA SELATAN
      KOTA PALEMBANG
      NIK : 1671020601940009
      Nama : ALDILA NIKMATHUL AKBAR
      Tempat/Tgl Lahir : PALEMBANG, 06-01-1994
      Jenis kelamin : LAKI-LAKI
      Alamat : JLN SILABERANTI GG KELAPA NO
      08
      RT/RW : 027/007
      Kel/Desa : SILABERANTI
      Kecamatan : JAKABARING
    `
    const result = parseKtpText(sample, 90, 800)
    expect(result.data.alamat).toBe('JLN SILABERANTI GG KELAPA NO 08')
    expect(result.data.rtRw).toBe('027/007')
    expect(result.data.kelDesa).toBe('SILABERANTI')
    expect(result.data.kecamatan).toBe('JAKABARING')
  })

  it('extracts NIK when label is slightly corrupted (MK / M1K) or has OCR noise prefix', () => {
    const sample = `
      PROVINSI SUMATERA SELATAN KOTA PALEMBANG
      NIK : bb71020501940007 su NAMA ALDILA
    `
    const lines = sample.trim().split('\n').map((l) => l.trim())
    const nik = extractNik(lines, sample)
    expect(nik).toBe('6671020501940007')
  })
  it('regression: does not turn city name into garbage numbers when date is missing', () => {
    const sample = `
      PROVINSI JAWA TIMUR
      NIK : 3515082005900003
      NAMA : BUDI
      TEMPAT/TGL LAHIR : SURABAYA
    `
    const result = parseKtpText(sample, 80, 500)
    expect(result.data.tempatLahir).toBe('SURABAYA')
    expect(result.data.tanggalLahir).toBe('')
  })

  it('regression: does not misidentify birthday slashes DD/MM/YYYY as RT/RW', () => {
    const sample = `
      PROVINSI DKI JAKARTA
      NIK : 3171012304950001
      NAMA : BUDI SANTOSO
      TEMPAT/TGL LAHIR : JAKARTA, 23/04/1995
      JENIS KELAMIN : LAKI-LAKI
      ALAMAT : JL KEBON SIRIH NO 45
      AGAMA : ISLAM
    `
    const result = parseKtpText(sample, 85, 400)
    // Tidak boleh mengekstrak "023/004" dari 23/04/1995 sebagai RT/RW
    expect(result.data.rtRw).toBe('')
  })
})

describe('Smart NIK & Date Cross-Validation (crossValidateNikAndDate)', () => {
  it('infers female gender and birth date (+40 rule) from NIK when missing in text', () => {
    // NIK with day code 63 (23 + 40 for female), month 04, year 95 -> 23-04-1995 PEREMPUAN
    const res = crossValidateNikAndDate('3171016304950001', '', '', { inferMissing: true })
    expect(res.jenisKelamin).toBe('PEREMPUAN')
    expect(res.tanggalLahir).toBe('23-04-1995')
    expect(res.repaired).toBe(true)
  })

  it('infers male gender and birth date from NIK when missing in text', () => {
    // NIK with day code 23 (<= 31 for male), month 04, year 95 -> 23-04-1995 LAKI-LAKI
    const res = crossValidateNikAndDate('3171012304950001', '', '', { inferMissing: true })
    expect(res.jenisKelamin).toBe('LAKI-LAKI')
    expect(res.tanggalLahir).toBe('23-04-1995')
    expect(res.repaired).toBe(true)
  })

  it('auto-repairs invalid NIK date segment based on valid written birth date', () => {
    // NIK has day 38 (impossible day in Indonesian NIK: 32-40 is strictly invalid)
    // Written birth date: 23-04-1995, Male
    const res = crossValidateNikAndDate('3171013804950001', '23-04-1995', 'LAKI-LAKI')
    expect(res.nik).toBe('3171012304950001')
    expect(res.repaired).toBe(true)
  })

  it('auto-repairs female NIK date segment with +40 addition', () => {
    // Female birth date: 23-04-1995 -> expected in NIK: 630495
    // NIK has day 78 (impossible day in NIK: > 71)
    const res = crossValidateNikAndDate('3171017804950001', '23-04-1995', 'PEREMPUAN')
    expect(res.nik).toBe('3171016304950001')
    expect(res.repaired).toBe(true)
  })
})

describe('Multi-Pass OCR Result Merging (mergeKtpResults)', () => {
  it('merges fields across passes taking the highest quality valid values', () => {
    const pass1 = {
      meta: {
        confidence: 50,
        processingTimeMs: 300,
        nikValid: false,
        modeUsed: 'enhanced-grayscale' as const,
      },
      data: {
        nik: '317101', // truncated/incomplete
        nama: 'BUDI SANTOSO', // clean
        tempatLahir: 'JAKARTA',
        tanggalLahir: '23-04-1995',
        jenisKelamin: 'LAKI-LAKI',
        golonganDarah: '',
        alamat: 'JL. KEBON SIRIH NO. 45',
        rtRw: '005/002',
        kelDesa: 'GAMBIR',
        kecamatan: 'GAMBIR',
        agama: '',
        statusPerkawinan: 'BELUM KAWIN',
        pekerjaan: 'KARYAWAN SWASTA',
        kewarganegaraan: 'WNI',
      },
      rawText: 'Pass 1 Text',
    }

    const pass2 = {
      meta: {
        confidence: 82,
        processingTimeMs: 350,
        nikValid: true,
        modeUsed: 'adaptive-threshold' as const,
      },
      data: {
        nik: '3171012304950001', // valid 16 digits!
        nama: 'BUD! S4NT0S0', // noisy
        tempatLahir: 'JAKARTA',
        tanggalLahir: '23-04-1995',
        jenisKelamin: 'LAKI-LAKI',
        golonganDarah: 'O', // extracted in pass 2
        alamat: '',
        rtRw: '',
        kelDesa: '',
        kecamatan: '',
        agama: 'ISLAM', // extracted in pass 2
        statusPerkawinan: '',
        pekerjaan: '',
        kewarganegaraan: 'WNI',
      },
      rawText: 'Pass 2 Text',
    }

    const merged = mergeKtpResults(pass1, pass2)

    // NIK should come from pass 2 (valid 16 digits)
    expect(merged.data.nik).toBe('3171012304950001')
    expect(merged.meta.nikValid).toBe(true)
    // Nama should come from pass 1 (less noise than BUD! S4NT0S0)
    expect(merged.data.nama).toBe('BUDI SANTOSO')
    // Alamat from pass 1
    expect(merged.data.alamat).toBe('JL. KEBON SIRIH NO. 45')
    // Golongan darah & Agama from pass 2
    expect(merged.data.golonganDarah).toBe('O')
    expect(merged.data.agama).toBe('ISLAM')
    // Meta
    expect(merged.meta.confidence).toBe(82)
    expect(merged.meta.retryFallbackUsed).toBe(true)
  })
})

describe('File Validator (validateKtpImageFile)', () => {
  it('accepts valid JPEG, PNG, and WebP files within 10 MB', () => {
    const validJpg = new File([new Uint8Array(1024)], 'ktp.jpg', { type: 'image/jpeg' })
    const validPng = new File([new Uint8Array(2048)], 'ktp.png', { type: 'image/png' })
    const validWebp = new File([new Uint8Array(4096)], 'ktp.webp', { type: 'image/webp' })

    expect(validateKtpImageFile(validJpg).valid).toBe(true)
    expect(validateKtpImageFile(validPng).valid).toBe(true)
    expect(validateKtpImageFile(validWebp).valid).toBe(true)
  })

  it('rejects 0 byte empty files', () => {
    const emptyFile = new File([], 'empty_ktp.jpg', { type: 'image/jpeg' })
    const res = validateKtpImageFile(emptyFile)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('0 byte')
  })

  it('rejects files larger than 10 MB', () => {
    const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'huge_ktp.png', {
      type: 'image/png',
    })
    const res = validateKtpImageFile(largeFile)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('10 MB')
  })

  it('rejects unsupported extensions or mismatched MIME types', () => {
    const pdfFile = new File([new Uint8Array(1024)], 'document.pdf', {
      type: 'application/pdf',
    })
    const spoofedFile = new File([new Uint8Array(1024)], 'script.exe.jpg', {
      type: 'application/octet-stream',
    })

    expect(validateKtpImageFile(pdfFile).valid).toBe(false)
    expect(validateKtpImageFile(spoofedFile).valid).toBe(false)
  })
  it('accepts mobile JPEG MIME types (image/jpg and image/pjpeg)', () => {
    const jpgFile = new File([new Uint8Array(100)], 'ktp_photo.jpg', {
      type: 'image/jpg',
    })
    const pjpegFile = new File([new Uint8Array(100)], 'ktp_photo.jpeg', {
      type: 'image/pjpeg',
    })
    expect(validateKtpImageFile(jpgFile).valid).toBe(true)
    expect(validateKtpImageFile(pjpegFile).valid).toBe(true)
  })
})
