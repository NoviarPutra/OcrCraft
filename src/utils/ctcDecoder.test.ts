import { describe, expect, it } from 'vitest'
import { buildPaddleDictionary, ctcGreedyDecode } from './ctcDecoder'

describe('ctcDecoder', () => {
  const mockDict = buildPaddleDictionary(['N', 'I', 'K', '1', '2', '3', 'A', 'B'])

  it('buildPaddleDictionary adds space at the end if not present', () => {
    const dict = buildPaddleDictionary(['A', 'B', 'C'])
    expect(dict).toContain('A')
    expect(dict).toContain('B')
    expect(dict).toContain('C')
    expect(dict[dict.length - 1]).toBe(' ')
  })

  it('handles empty input gracefully', () => {
    const result = ctcGreedyDecode(new Float32Array(), [], mockDict)
    expect(result.text).toBe('')
    expect(result.confidence).toBe(0)
    expect(result.timesteps).toEqual([])
  })

  it('decodes single non-blank character with high probability', () => {
    // 1 timestep, numClasses = mockDict.length + 1 (blank at 0)
    const numClasses = mockDict.length + 1
    const logits = new Float32Array(numClasses).fill(-10)

    // Class 1 = 'N' (mockDict[0])
    logits[1] = 10.0

    const result = ctcGreedyDecode(logits, [1, 1, numClasses], mockDict)
    expect(result.text).toBe('N')
    expect(result.confidence).toBeGreaterThan(0.99)
  })

  it('correctly collapses repeated tokens without blank separator (CTC Rule)', () => {
    // 3 timesteps of class 1 ('N', 'N', 'N') -> should collapse to 'N'
    const numClasses = mockDict.length + 1
    const logits = new Float32Array(3 * numClasses).fill(-10)
    logits[1] = 10.0 // N
    logits[numClasses + 1] = 10.0 // N
    logits[2 * numClasses + 1] = 10.0 // N
    const result = ctcGreedyDecode(logits, [1, 3, numClasses], mockDict)
    expect(result.text).toBe('N')
  })

  it('preserves repeated characters separated by blank token (index 0)', () => {
    // 3 timesteps: class 1 ('N'), class 0 (blank), class 1 ('N') -> should yield 'NN'
    const numClasses = mockDict.length + 1
    const logits = new Float32Array(3 * numClasses).fill(-10)
    logits[1] = 10.0 // N
    logits[numClasses] = 10.0 // Blank (index 0)
    logits[2 * numClasses + 1] = 10.0 // N
    const result = ctcGreedyDecode(logits, [1, 3, numClasses], mockDict)
    expect(result.text).toBe('NN')
  })

  it('decodes multi-character sequence: NIK 123', () => {
    // Characters: 'N' (1), 'I' (2), 'K' (3), ' ' (mockDict.length), '1' (4), '2' (5), '3' (6)
    const spaceClass = mockDict.indexOf(' ') + 1
    const seq = [1, 2, 3, spaceClass, 4, 5, 6]
    const numClasses = mockDict.length + 1
    const logits = new Float32Array(seq.length * numClasses).fill(-10)

    seq.forEach((cls, t) => {
      logits[t * numClasses + cls] = 10.0
    })

    const result = ctcGreedyDecode(logits, [1, seq.length, numClasses], mockDict)
    expect(result.text).toBe('NIK 123')
    expect(result.confidence).toBeGreaterThan(0.99)
  })

  it('buildPaddleDictionary parses ArrayBuffer and Uint8Array correctly', () => {
    const text = 'A\nB\nC'
    const buffer = new TextEncoder().encode(text).buffer
    const dict = buildPaddleDictionary(buffer)
    expect(dict).toEqual(['A', 'B', 'C', ' '])
  })

  it('buildPaddleDictionary avoids duplicate space when space is already at the end', () => {
    const dict1 = buildPaddleDictionary(['A', 'B', ' '])
    expect(dict1).toEqual(['A', 'B', ' '])
  })
})
