import { describe, expect, it } from 'vitest'
import { calculateVisionDimensions } from './byokImageOptimizer'

describe('calculateVisionDimensions', () => {
  it('returns unchanged dimensions if both width and height are within maxDimension', () => {
    const res = calculateVisionDimensions(1200, 800, 1536)
    expect(res).toEqual({
      width: 1200,
      height: 800,
      scaled: false,
    })
  })

  it('scales down landscape image when width exceeds maxDimension', () => {
    // 3072x2048 at maxDimension 1536 -> halved to 1536x1024
    const res = calculateVisionDimensions(3072, 2048, 1536)
    expect(res).toEqual({
      width: 1536,
      height: 1024,
      scaled: true,
    })
  })

  it('scales down portrait image when height exceeds maxDimension', () => {
    // 2000x4000 at maxDimension 1536 -> 768x1536
    const res = calculateVisionDimensions(2000, 4000, 1536)
    expect(res).toEqual({
      width: 768,
      height: 1536,
      scaled: true,
    })
  })

  it('handles square image exceeding maxDimension', () => {
    const res = calculateVisionDimensions(2000, 2000, 1536)
    expect(res).toEqual({
      width: 1536,
      height: 1536,
      scaled: true,
    })
  })

  it('handles edge cases with small or non-positive values safely', () => {
    const res = calculateVisionDimensions(0, 0, 1536)
    expect(res.width).toBe(1)
    expect(res.height).toBe(1)
  })
})
