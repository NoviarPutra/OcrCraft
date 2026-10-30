import { describe, expect, it } from 'vitest'
import {
  normalizeColons,
  parseRapidOcrResponse,
  type RapidOcrInputData,
} from './rapidKtpParser'

describe('rapidKtpParser', () => {
  it('normalizes full-width and irregular colons', () => {
    expect(normalizeColons('NIK： 3171010101900001')).toBe('NIK : 3171010101900001')
    expect(normalizeColons('Nama； BUDI SANTOSO')).toBe('Nama : BUDI SANTOSO')
    expect(normalizeColons('Agama :  ISLAM')).toBe('Agama : ISLAM')
  })

  it('parses typical RapidOCR backend payload correctly into standard JSON and KtpData', () => {
    const mockInput: RapidOcrInputData = {
      boxes: [
        [[50, 20], [300, 20], [300, 45], [50, 45]],
        [[50, 60], [450, 60], [450, 90], [50, 90]],
        [[50, 100], [400, 100], [400, 125], [50, 125]],
        [[50, 135], [420, 135], [420, 160], [50, 160]],
        [[50, 170], [350, 170], [350, 195], [50, 195]],
        [[50, 205], [400, 205], [400, 230], [50, 230]],
        [[50, 240], [250, 240], [250, 265], [50, 265]],
        [[50, 275], [300, 275], [300, 300], [50, 300]],
        [[50, 310], [320, 310], [320, 335], [50, 335]],
        [[50, 345], [200, 345], [200, 370], [50, 370]],
        [[50, 380], [300, 380], [300, 405], [50, 405]],
        [[50, 415], [350, 415], [350, 440], [50, 440]],
        [[50, 450], [250, 450], [250, 475], [50, 475]],
      ],
      txts: [
        'PROVINSI DKI JAKARTA',
        'NIK： 3171011508900001',
        'Nama : SITI AMINAH',
        'Tempat/Tgl Lahir : JAKARTA, 15-08-1990',
        'Jenis Kelamin : PEREMPUAN  Gol. Darah : B',
        'Alamat : JL. CEMPAKA PUTIH BARAT NO. 12',
        'RT/RW : 005/002',
        'Kel/Desa : CEMPAKA PUTIH',
        'Kecamatan : CEMPAKA PUTIH',
        'Agama : ISLAM',
        'Status Perkawinan : KAWIN',
        'Pekerjaan : KARYAWAN SWASTA',
        'Kewarganegaraan : WNI',
      ],
      scores: [0.99, 0.98, 0.97, 0.96, 0.95, 0.98, 0.94, 0.95, 0.95, 0.97, 0.98, 0.96, 0.99],
    }

    const result = parseRapidOcrResponse(mockInput)

    expect(result.standardJson.nama).toBe('SITI AMINAH')
    expect(result.standardJson.tempat_lahir).toBe('JAKARTA')
    expect(result.standardJson.tanggal_lahir).toBe('15-08-1990')
    expect(result.standardJson.jenis_kelamin).toBe('PEREMPUAN')
    expect(result.standardJson.agama).toBe('ISLAM')
    expect(result.standardJson.status_perkawinan).toBe('KAWIN')
    expect(result.standardJson.pekerjaan).toBe('KARYAWAN SWASTA')
    expect(result.standardJson.kewarganegaraan).toBe('WNI')

    // Alamat nested structure
    expect(result.standardJson.alamat.jalan).toContain('CEMPAKA PUTIH')
    expect(result.standardJson.alamat.rt_rw).toBe('005/002')
    expect(result.standardJson.alamat.kel_desa).toContain('CEMPAKA PUTIH')
    expect(result.standardJson.alamat.kecamatan).toContain('CEMPAKA PUTIH')

    // KtpData mapping for AutoFillFormPanel
    expect(result.ktpData.nik).toBe('3171011508900001')
    expect(result.ktpData.nama).toBe('SITI AMINAH')
    expect(result.ktpData.golonganDarah).toBe('B')
  })

  it('corrects OCR typos in NIK (letter-to-digit)', () => {
    const mockInput: RapidOcrInputData = {
      txts: [
        'PROVINSI JAWA BARAT',
        'NIK : 3273OlOlOl9000Ol', // O and l letters instead of 0 and 1
        'Nama : BUDI SANTOSO',
        'Tempat/Tgl Lahir : BANDUNG, 01-01-1990',
        'Jenis Kelamin : LAKI-LAKI',
      ],
    }

    const result = parseRapidOcrResponse(mockInput)
    expect(result.standardJson.nik).toBe('3273010101900001')
    expect(result.ktpData.nik).toBe('3273010101900001')
  })

  it('performs cross-check on female date of birth (+40 for females)', () => {
    // Female born 15-08-1992 -> day in NIK should be 15 + 40 = 55
    const mockInput: RapidOcrInputData = {
      txts: [
        'PROVINSI JAWA TIMUR',
        'NIK : 3578015508920002', // Day = 55 (female 15 + 40)
        'Nama : RATNA SARI',
        'Tempat/Tgl Lahir : SURABAYA, 15-08-1992',
        'Jenis Kelamin : PEREMPUAN',
      ],
    }

    const result = parseRapidOcrResponse(mockInput)
    expect(result.standardJson.jenis_kelamin).toBe('PEREMPUAN')
    expect(result.standardJson.tanggal_lahir).toBe('15-08-1992')
    expect(result.standardJson.nik).toBe('3578015508920002')
  })

  it('handles empty or malformed input gracefully', () => {
    const emptyResult = parseRapidOcrResponse({})
    expect(emptyResult.standardJson.nik).toBe('')
    expect(emptyResult.standardJson.nama).toBe('')
    expect(emptyResult.standardJson.alamat.jalan).toBe('')
    expect(emptyResult.confidence).toBe(0)
    expect(emptyResult.annotatedBoxes).toEqual([])
  })

  it('rejects malformed or non-finite polygon boxes without producing NaN coordinates', () => {
    const malformedInput: RapidOcrInputData = {
      boxes: [
        [[], [], [], []],
        [[NaN, 0], [10, 0], [10, 10], [0, 10]],
      ],
      txts: ['TEST 1', 'TEST 2'],
      scores: [0.9, 0.8],
    }
    const result = parseRapidOcrResponse(malformedInput)
    // Both malformed boxes should be rejected rather than outputting NaN bounding boxes
    expect(result.annotatedBoxes).toHaveLength(0)
  })
})
