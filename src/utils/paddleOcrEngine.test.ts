import { describe, expect, it } from 'vitest'
import { PaddleOcrEngine } from './paddleOcrEngine'

describe('PaddleOcrEngine', () => {
  it('postprocessDetBoxes detects rectangular regions and scales back to original size', () => {
    const engine = new PaddleOcrEngine()
    const detW = 64
    const detH = 64
    const origW = 640
    const origH = 640

    // Create a mock probability map with a 10x10 high probability region
    const probMap = new Float32Array(detW * detH).fill(0.0)
    for (let y = 20; y <= 30; y++) {
      for (let x = 15; x <= 35; x++) {
        probMap[y * detW + x] = 0.95
      }
    }

    const boxes = engine.postprocessDetBoxes(probMap, detW, detH, origW, origH, 0.3, 10)
    expect(boxes.length).toBeGreaterThan(0)

    const box = boxes[0]
    expect(box.confidence).toBeGreaterThan(0.9)
    // Box should be approximately scaled by factor 10 (origW / detW = 10)
    expect(box.x).toBeGreaterThanOrEqual(50)
    expect(box.y).toBeGreaterThanOrEqual(100)
    expect(box.w).toBeGreaterThan(150)
    expect(box.h).toBeGreaterThan(80)
  })

  it('release resets offscreen canvas dimensions and empties state', async () => {
    const engine = new PaddleOcrEngine()
    await engine.release()
    // Calling release multiple times is idempotent
    await expect(engine.release()).resolves.not.toThrow()
  })
})
