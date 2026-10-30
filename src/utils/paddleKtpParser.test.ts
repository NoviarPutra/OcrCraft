import { describe, expect, it } from 'vitest'
import { parsePaddleBoxesToKtp } from './paddleKtpParser'
import type { BoundingBox } from '../types/paddleOcr'

describe('paddleKtpParser', () => {
  it('returns empty structure when boxes list is empty', () => {
    const res = parsePaddleBoxesToKtp([])
    expect(res.rawText).toBe('')
    expect(res.annotatedBoxes).toEqual([])
    expect(res.ktpData.nik).toBe('')
  })

  it('correctly associates boxes, parses NIK, and annotates matched fields', () => {
    const mockBoxes: BoundingBox[] = [
      { id: '1', x: 20, y: 30, w: 200, h: 25, text: 'PROVINSI DKI JAKARTA', confidence: 0.98 },
      { id: '2', x: 20, y: 70, w: 80, h: 25, text: 'NIK :', confidence: 0.95 },
      { id: '3', x: 120, y: 70, w: 250, h: 25, text: '3171010101900001', confidence: 0.97 },
      { id: '4', x: 20, y: 110, w: 80, h: 25, text: 'Nama :', confidence: 0.94 },
      { id: '5', x: 120, y: 110, w: 200, h: 25, text: 'SITI AMINAH', confidence: 0.96 },
      { id: '6', x: 20, y: 150, w: 100, h: 25, text: 'Tempat/Tgl Lahir :', confidence: 0.91 },
      { id: '7', x: 130, y: 150, w: 220, h: 25, text: 'JAKARTA, 41-01-1990', confidence: 0.93 },
      { id: '8', x: 20, y: 190, w: 120, h: 25, text: 'Jenis Kelamin :', confidence: 0.92 },
      { id: '9', x: 150, y: 190, w: 110, h: 25, text: 'PEREMPUAN', confidence: 0.95 },
      { id: '10', x: 280, y: 190, w: 90, h: 25, text: 'Gol. Darah : O', confidence: 0.9 },
    ]

    const result = parsePaddleBoxesToKtp(mockBoxes)

    // Verify NIK parsed
    expect(result.ktpData.nik).toBe('3171010101900001')
    expect(result.ktpData.nama).toBe('SITI AMINAH')
    expect(result.ktpData.jenisKelamin).toBe('PEREMPUAN')
    expect(result.ktpData.golonganDarah).toBe('O')

    // Verify matchedField annotations
    const nikBox = result.annotatedBoxes.find((b) => b.id === '3')
    expect(nikBox?.matchedField).toBe('nik')

    const namaBox = result.annotatedBoxes.find((b) => b.id === '5')
    expect(namaBox?.matchedField).toBe('nama')

    const sexBox = result.annotatedBoxes.find((b) => b.id === '9')
    expect(sexBox?.matchedField).toBe('jenisKelamin')
  })

  it('parses real-world noisy OCR from sample Langkat (Muhammad Hatta Siregar)', () => {
    const rawText = `PROVINSISUMATERAUTARAIS
KABUPATENLANGKAT
NIK 3:1205160402900001
Nama MUHAMMADHATTASIREGAR
Tempat/TgLahir: Lahir:BUKITSELAMAT.04-02-1990
JenisKeiamin LA-LAK Gol.Darah
Aamat ：DUSUNIXPEIANBUKIT
SELAMAT
RT/RW  
Kei/Desa :BUKITSELAMAT
Kecamatan ：BESITANG
Agama ISLAM
UANGKAT
StatusPerkawinan:BELUMKAwiN 07-08-2012
Pekerjaan PELAJAR/MAHASISWA
Kewarganegaraan:WNi
BerakuHingga ：0402-2017`

    const lines = rawText.split('\n')
    const mockBoxes: BoundingBox[] = lines.map((line, idx) => ({
      id: String(idx + 1),
      x: 20,
      y: 30 + idx * 30,
      w: 300,
      h: 25,
      text: line,
      confidence: 0.9,
    }))

    const res = parsePaddleBoxesToKtp(mockBoxes)

    // Verify all 6 previously flawed fields are now parsed 100% accurately
    expect(res.ktpData.nik).toBe('1205160402900001')
    expect(res.ktpData.nama).toBe('MUHAMMAD HATTA SIREGAR')
    expect(res.ktpData.tempatLahir).toBe('BUKIT SELAMAT')
    expect(res.ktpData.tanggalLahir).toBe('04-02-1990')
    expect(res.ktpData.jenisKelamin).toBe('LAKI-LAKI')
    expect(res.ktpData.alamat).toBe('DUSUN IX PEIAN BUKIT SELAMAT')
    expect(res.ktpData.kelDesa).toBe('BUKIT SELAMAT')
    expect(res.ktpData.kecamatan).toBe('BESITANG')
    expect(res.ktpData.statusPerkawinan).toBe('BELUM KAWIN')
    expect(res.ktpData.agama).toBe('ISLAM')
    expect(res.ktpData.pekerjaan).toBe('PELAJAR/MAHASISWA')
    expect(res.ktpData.kewarganegaraan).toBe('WNI')
  })

  it('preserves Gol. Darah on right side without misclassifying as photo zone', () => {
    const boxes = [
      { id: '1', x: 20, y: 30, w: 250, h: 30, text: 'NIK : 1234567890123456', confidence: 0.95 },
      { id: '2', x: 20, y: 120, w: 200, h: 30, text: 'Nama : BUDI SANTOSO', confidence: 0.95 },
      { id: '3', x: 20, y: 200, w: 250, h: 30, text: 'Jenis Kelamin : LAKI-LAKI', confidence: 0.95 },
      { id: '4', x: 750, y: 200, w: 150, h: 30, text: 'Gol. Darah : O', confidence: 0.95 },
    ]
    const res = parsePaddleBoxesToKtp(boxes, 1000, 700)
    expect(res.ktpData.golonganDarah).toBe('O')
  })

  it('accurately identifies address box without false positive blood type matching', () => {
    const boxes = [
      { id: '1', x: 20, y: 30, w: 250, h: 30, text: 'NIK : 1234567890123456', confidence: 0.95 },
      { id: '2', x: 20, y: 150, w: 350, h: 30, text: 'Alamat : JL. A. YANI NO. 10', confidence: 0.95 },
    ]
    const res = parsePaddleBoxesToKtp(boxes, 1000, 700)
    const alamatBox = res.annotatedBoxes.find((b) => b.id === '2')
    expect(alamatBox?.matchedField).toBe('alamat')
  })
})
