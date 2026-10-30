import { describe, expect, it, vi } from 'vitest'
import {
  checkAllModelAssetsStatus,
  deleteCachedAsset,
  getCachedAsset,
  storeCachedAsset,
} from './modelCacheManager'

describe('modelCacheManager', () => {
  it('stores and retrieves cached text asset via memory fallback', async () => {
    const key = 'test-cache/dict'
    const content = 'A\nB\nC\n1\n2\n3'

    await storeCachedAsset(key, content)
    const retrieved = await getCachedAsset(key)

    expect(retrieved).toBe(content)

    await deleteCachedAsset(key)
    const afterDelete = await getCachedAsset(key)
    expect(afterDelete).toBeNull()
  })

  it('stores and retrieves binary ArrayBuffer', async () => {
    const key = 'test-cache/model.onnx'
    const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer

    await storeCachedAsset(key, buffer)
    const retrieved = (await getCachedAsset(key)) as ArrayBuffer

    expect(retrieved).toBeDefined()
    expect(retrieved.byteLength).toBe(5)

    await deleteCachedAsset(key)
  })

  it('correctly reads text from Cache API mock for dictionary assets', async () => {
    try {
      const mockResponse = new Response('CHAR1\nCHAR2', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })

      const mockCache = {
        match: async (url: RequestInfo | URL) => {
          const key = typeof url === 'string' ? url : url.toString()
          if (key.endsWith('/dict')) {
            return mockResponse
          }
          return undefined
        },
      }

      const mockCacheStorage = {
        open: async () => mockCache,
      }

      vi.stubGlobal('caches', mockCacheStorage)

      const asset = await getCachedAsset('paddleocr-onnx-cache-v1/dict')
      expect(typeof asset).toBe('string')
      expect(asset).toBe('CHAR1\nCHAR2')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('checkAllModelAssetsStatus reports correct states', async () => {
    const status = await checkAllModelAssetsStatus()
    expect(status).toHaveProperty('det')
    expect(status).toHaveProperty('rec')
    expect(status).toHaveProperty('dict')
    expect(typeof status.allReady).toBe('boolean')
  })
})
