import { describe, expect, it } from 'vitest'
import {
  correctOcrDigits,
  extractNik,
  extractRtRw,
  extractTempatTanggalLahir,
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

  it('does not throw on empty string', () => {
    const result = parseKtpText('', 0, 0)
    expect(result.meta.confidence).toBe(0)
    expect(result.meta.nikValid).toBe(false)
    expect(result.data.nik).toBe('')
    expect(result.data.nama).toBe('')
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
