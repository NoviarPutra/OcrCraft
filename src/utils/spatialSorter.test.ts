import { describe, expect, it } from 'vitest'
import { sortBoundingBoxesSpatially } from './spatialSorter'

describe('spatialSorter', () => {
  it('returns empty array when given empty list', () => {
    expect(sortBoundingBoxesSpatially([])).toEqual([])
  })

  it('sorts single line with multiple boxes from left to right', () => {
    const boxes = [
      { id: 'b2', x: 200, y: 50, w: 100, h: 30, text: '3171010101900001', confidence: 0.95 },
      { id: 'b1', x: 20, y: 52, w: 60, h: 28, text: 'NIK :', confidence: 0.98 },
    ]

    const sorted = sortBoundingBoxesSpatially(boxes)
    expect(sorted[0].id).toBe('b1')
    expect(sorted[1].id).toBe('b2')
    expect(sorted[0].lineIndex).toBe(0)
    expect(sorted[1].lineIndex).toBe(0)
  })

  it('sorts multiple lines top-to-bottom even with slight vertical jitters', () => {
    // Line 0: PROVINSI (y=20)
    // Line 1: NIK : (y=72), 317101... (y=68) -> same line despite 4px jitter
    // Line 2: Nama : (y=110), BUDI (y=112)
    const boxes = [
      { id: 'b_name_val', x: 180, y: 112, w: 120, h: 25, text: 'BUDI', confidence: 0.9 },
      { id: 'b_nik_val', x: 180, y: 68, w: 150, h: 25, text: '3171010101900001', confidence: 0.9 },
      { id: 'b_prov', x: 150, y: 20, w: 200, h: 28, text: 'PROVINSI DKI JAKARTA', confidence: 0.99 },
      { id: 'b_nik_lbl', x: 40, y: 72, w: 60, h: 26, text: 'NIK :', confidence: 0.95 },
      { id: 'b_name_lbl', x: 40, y: 110, w: 80, h: 25, text: 'Nama :', confidence: 0.95 },
    ]

    const sorted = sortBoundingBoxesSpatially(boxes)

    expect(sorted.map((b) => b.id)).toEqual([
      'b_prov',
      'b_nik_lbl',
      'b_nik_val',
      'b_name_lbl',
      'b_name_val',
    ])

    // Verify line indices
    expect(sorted[0].lineIndex).toBe(0) // PROVINSI
    expect(sorted[1].lineIndex).toBe(1) // NIK label
    expect(sorted[2].lineIndex).toBe(1) // NIK value
    expect(sorted[3].lineIndex).toBe(2) // Nama label
    expect(sorted[4].lineIndex).toBe(2) // Nama value
  })
})
