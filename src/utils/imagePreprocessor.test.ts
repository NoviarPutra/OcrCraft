import { describe, expect, it } from 'vitest'
import {
  applySoftContrast,
  calculateDownscaledDimensions,
  calculateId1CropBounds,
  calculateScaledDimensions,
  cyanSuppressingGrayscale,
  DEFAULT_ADAPTIVE_SENSITIVITY,
  DEFAULT_ADAPTIVE_WINDOW,
  DEFAULT_CONTRAST,
  DEFAULT_MAX_WIDTH,
  DEFAULT_PREPROCESS_MODE,
  DEFAULT_THRESHOLD,
  detectCoarseOrientation,
  estimateDeskewAngle,
} from './imagePreprocessor'

describe('imagePreprocessor - formula & helpers', () => {
  it('cyanSuppressingGrayscale produces bright background for cyan and dark for black text', () => {
    // Cyan e-KTP color: r is low (~50-100), g & b are high (~180-230)
    // E.g. rgb(60, 180, 210)
    const cyanGray = cyanSuppressingGrayscale(60, 180, 210)
    // 0.10*60 + 0.55*180 + 0.35*210 = 6 + 99 + 73.5 = 178.5 -> 179 (bright background)
    expect(cyanGray).toBe(179)

    // Standard ITU-R BT.601 luminance on same cyan: 0.299*60 + 0.587*180 + 0.114*210 = 17.94 + 105.66 + 23.94 = 147.54
    // 189 is significantly brighter than 147!
    const standardLuma = Math.round(0.299 * 60 + 0.587 * 180 + 0.114 * 210)
    expect(cyanGray).toBeGreaterThan(standardLuma)

    // Black text: rgb(15, 15, 15)
    const blackGray = cyanSuppressingGrayscale(15, 15, 15)
    expect(blackGray).toBe(15) // remains dark

    // Pure white: rgb(255, 255, 255)
    const whiteGray = cyanSuppressingGrayscale(255, 255, 255)
    expect(whiteGray).toBe(255)
  })

  it('applySoftContrast correctly stretches contrast around midpoint 128', () => {
    // At midpoint 128, contrast factor leaves it at 128
    expect(applySoftContrast(128, 1.25)).toBe(128)

    // Values below 128 become darker
    expect(applySoftContrast(100, 1.25)).toBeLessThan(100)
    // Values above 128 become brighter
    expect(applySoftContrast(160, 1.25)).toBeGreaterThan(160)

    // Clamp boundary: 0 stays 0, 255 stays 255
    expect(applySoftContrast(0, 1.5)).toBe(0)
    expect(applySoftContrast(255, 1.5)).toBe(255)
  })

  it('calculateDownscaledDimensions downscales oversized images proportionally', () => {
    // Image > 2000px wide (e.g. 4000x3000) -> scaled to maxWidth (1600px)
    const downscaled = calculateDownscaledDimensions(4000, 3000, DEFAULT_MAX_WIDTH)
    expect(downscaled.width).toBe(1600)
    expect(downscaled.height).toBe(1200)

    // Image under max limit (e.g. 1200x800) -> remains original size
    const unchanged = calculateDownscaledDimensions(1200, 800, DEFAULT_MAX_WIDTH)
    expect(unchanged.width).toBe(1200)
    expect(unchanged.height).toBe(800)

    // Tall portrait image (e.g. 2000x3200)
    const tall = calculateDownscaledDimensions(2000, 3200, DEFAULT_MAX_WIDTH)
    expect(tall.height).toBe(1600)
    expect(tall.width).toBe(1000)
  })

  it('calculateDownscaledDimensions throws on zero or negative dimensions', () => {
    expect(() => calculateDownscaledDimensions(0, 100)).toThrow()
    expect(() => calculateDownscaledDimensions(100, -10)).toThrow()
  })

  it('exports proper default constants for all 4 modes', () => {
    expect(DEFAULT_PREPROCESS_MODE).toBe('enhanced-grayscale')
    expect(DEFAULT_THRESHOLD).toBe(135)
    expect(DEFAULT_CONTRAST).toBe(1.25)
    expect(DEFAULT_ADAPTIVE_SENSITIVITY).toBe(15)
    expect(DEFAULT_ADAPTIVE_WINDOW).toBe(31)
  })

  it('calculateScaledDimensions upscales low-res images (< 800px) by 2x', () => {
    const res = calculateScaledDimensions(400, 250, 1600, true)
    expect(res.scaleFactor).toBe(2)
    expect(res.width).toBe(800)
    expect(res.height).toBe(500)
  })

  it('calculateScaledDimensions downscales images exceeding maxWidth', () => {
    const res = calculateScaledDimensions(3200, 2000, 1600, true)
    expect(res.scaleFactor).toBeLessThan(1)
    expect(res.width).toBe(1600)
    expect(res.height).toBe(1000)
  })

  it('calculateId1CropBounds computes crop coordinates matching ID-1 1.58577 aspect ratio', () => {
    const bounds = calculateId1CropBounds(1000, 700)
    const expectedHeight = Math.round(1000 / 1.58577)
    expect(bounds.sWidth).toBe(1000)
    expect(bounds.sHeight).toBe(expectedHeight)
  })

  it('regression: calculateId1CropBounds does not aggressively crop portrait images', () => {
    // Portrait photo from smartphone (e.g. 1080x1920)
    const bounds = calculateId1CropBounds(1080, 1920)
    // Harap jangan potong 65% foto; biarkan full image jika rasio bukan kartu landscape
    expect(bounds.sHeight).toBe(1920)
    expect(bounds.sWidth).toBe(1080)
  })

  it('estimateDeskewAngle returns 0 on empty / blank image data', () => {
    const blankData = new Uint8ClampedArray(100 * 100 * 4)
    const fakeImageData = {
      data: blankData,
      width: 100,
      height: 100,
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData
    const angle = estimateDeskewAngle(fakeImageData)
    expect(angle).toBe(0)
  })

  it('detectCoarseOrientation returns 0 for landscape blank image and 90 for portrait', () => {
    const landscapeData = {
      data: new Uint8ClampedArray(160 * 100 * 4),
      width: 160,
      height: 100,
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData
    expect(detectCoarseOrientation(landscapeData)).toBe(0)

    const portraitData = {
      data: new Uint8ClampedArray(100 * 180 * 4),
      width: 100,
      height: 180,
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData
    expect(detectCoarseOrientation(portraitData)).toBe(90)
  })
})
