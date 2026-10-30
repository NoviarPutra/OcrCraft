import type {
  ModelAssetKey,
  ModelAssetStatus,
  ModelManagerStatus,
} from '../types/paddleOcr'

export const CACHE_NAME = 'paddleocr-onnx-cache-v1'

export const DEFAULT_MODEL_URLS = {
  det: 'https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx',
  rec: 'https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_rec_infer.onnx',
  dict: 'https://cdn.jsdelivr.net/gh/PaddlePaddle/PaddleOCR@release/2.7/ppocr/utils/ppocr_keys_v1.txt',
}
export const FALLBACK_MODEL_URLS: Record<ModelAssetKey, string[]> = {
  det: [
    'https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx',
    'https://hf-mirror.com/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx',
  ],
  rec: [
    'https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_rec_infer.onnx',
    'https://hf-mirror.com/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_rec_infer.onnx',
  ],
  dict: [
    'https://cdn.jsdelivr.net/gh/PaddlePaddle/PaddleOCR@release/2.7/ppocr/utils/ppocr_keys_v1.txt',
    'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/release/2.7/ppocr/utils/ppocr_keys_v1.txt',
  ],
}

const MIN_ONNX_SIZE_BYTES = 100 * 1024 // 100 KB
const MIN_DICT_SIZE_BYTES = 100 // 100 bytes

const ESTIMATED_SIZES_BYTES: Record<ModelAssetKey, number> = {
  det: 4_745_517, // ~4.7 MB (ch_PP-OCRv4_det_infer.onnx)
  rec: 11_544_147, // ~11.5 MB (ch_PP-OCRv4_rec_infer.onnx)
  dict: 85_000, // ~85 KB (ppocr_keys_v1.txt)
}
// Fallback memory store when Cache API is unavailable (e.g. in test runners or non-secure contexts)
const memoryStore = new Map<string, ArrayBuffer | string>()

/**
 * Checks if the Cache API is supported in the current environment.
 */
export function isCacheApiAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    Boolean(globalThis.caches && typeof globalThis.caches.open === 'function')
  )
}

/**
 * Retrieves a cached asset by its cache key.
 */
export async function getCachedAsset(
  cacheKey: string
): Promise<ArrayBuffer | string | null> {
  if (memoryStore.has(cacheKey)) {
    return memoryStore.get(cacheKey) ?? null
  }

  if (!isCacheApiAvailable()) {
    return null
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    const match = await cache.match(cacheKey)
    if (!match) return null

    const contentType = match.headers.get('content-type') || ''
    if (
      cacheKey.endsWith('.txt') ||
      cacheKey.endsWith('/dict') ||
      contentType.includes('text/plain')
    ) {
      return await match.text()
    }
    return await match.arrayBuffer()
  } catch {
    return null
  }
}

/**
 * Stores an asset in the Browser Cache API (and memory fallback).
 */
export async function storeCachedAsset(
  cacheKey: string,
  data: ArrayBuffer | string
): Promise<void> {
  memoryStore.set(cacheKey, data)

  if (!isCacheApiAvailable()) {
    return
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    const isText = typeof data === 'string'
    const body = isText ? data : new Blob([data])
    const response = new Response(body, {
      headers: {
        'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/octet-stream',
        'Content-Length': String(isText ? new TextEncoder().encode(data).length : data.byteLength),
      },
    })
    await cache.put(cacheKey, response)
  } catch (err) {
    console.warn(`Failed to store ${cacheKey} in Cache API:`, err)
  }
}

/**
 * Deletes a cached asset.
 */
export async function deleteCachedAsset(cacheKey: string): Promise<boolean> {
  memoryStore.delete(cacheKey)
  if (!isCacheApiAvailable()) return true
  try {
    const cache = await caches.open(CACHE_NAME)
    return await cache.delete(cacheKey)
  } catch {
    return false
  }
}

/**
 * Downloads a model asset with streaming progress reporting and Cache API persistence.
 */
export async function downloadModelAssetWithProgress(
  key: ModelAssetKey,
  url: string,
  onProgress?: (loadedBytes: number, totalBytes: number, percent: number) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer | string> {
  const cacheKey = `${CACHE_NAME}/${key}`

  // Check cache first
  const existing = await getCachedAsset(cacheKey)
  if (existing) {
    const size = typeof existing === 'string' ? existing.length : existing.byteLength
    onProgress?.(size, size, 100)
    return existing
  }

  const candidateUrls = Array.from(new Set([url, ...(FALLBACK_MODEL_URLS[key] || [])]))
  let lastError: Error | null = null

  for (const targetUrl of candidateUrls) {
    if (signal?.aborted) {
      throw new DOMException('Proses dibatalkan oleh pengguna.', 'AbortError')
    }

    try {
      const response = await fetch(targetUrl, { signal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : ESTIMATED_SIZES_BYTES[key]

      if (!response.body) {
        const buffer = await response.arrayBuffer()
        validateAssetSize(key, buffer.byteLength)
        if (key === 'dict') {
          const text = new TextDecoder('utf-8').decode(buffer)
          await storeCachedAsset(cacheKey, text)
          onProgress?.(text.length, text.length, 100)
          return text
        }
        await storeCachedAsset(cacheKey, buffer)
        onProgress?.(buffer.byteLength, buffer.byteLength, 100)
        return buffer
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let loadedBytes = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            loadedBytes += value.length
            const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
            onProgress?.(loadedBytes, totalBytes, percent)
          }
        }
      } catch (streamErr) {
        reader.cancel().catch(() => {})
        throw streamErr
      } finally {
        reader.releaseLock()
      }
      onProgress?.(loadedBytes, loadedBytes, 100)

      validateAssetSize(key, loadedBytes)

      // Combine chunks into a single contiguous array
      const combined = new Uint8Array(loadedBytes)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      if (key === 'dict') {
        const text = new TextDecoder('utf-8').decode(combined)
        await storeCachedAsset(cacheKey, text)
        return text
      }

      const buffer = combined.buffer
      await storeCachedAsset(cacheKey, buffer)
      return buffer
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw err
      }
      lastError = err as Error
      console.warn(`Gagal mengunduh aset ${key} dari ${targetUrl}:`, err)
    }
  }

  throw new Error(`Gagal mengunduh aset ${key} (${lastError?.message || 'Unknown error'})`)
}

function validateAssetSize(key: ModelAssetKey, sizeBytes: number): void {
  const minRequired = key === 'dict' ? MIN_DICT_SIZE_BYTES : MIN_ONNX_SIZE_BYTES
  if (sizeBytes < minRequired) {
    throw new Error(
      `File ${key} terlalu kecil (${sizeBytes} bytes). Kemungkinan respon error 404/HTML.`
    )
  }
}

/**
 * Reads a user-selected local file and caches it.
 */
export async function loadLocalModelAsset(
  key: ModelAssetKey,
  file: File
): Promise<ArrayBuffer | string> {
  const cacheKey = `${CACHE_NAME}/${key}`
  if (key === 'dict') {
    const text = await file.text()
    validateAssetSize(key, text.length)
    await storeCachedAsset(cacheKey, text)
    return text
  }

  const buffer = await file.arrayBuffer()
  validateAssetSize(key, buffer.byteLength)
  await storeCachedAsset(cacheKey, buffer)
  return buffer
}

/**
 * Checks the availability status of all 3 model assets in cache.
 */
export async function checkAllModelAssetsStatus(): Promise<ModelManagerStatus> {
  const [detCached, recCached, dictCached] = await Promise.all([
    getCachedAsset(`${CACHE_NAME}/det`),
    getCachedAsset(`${CACHE_NAME}/rec`),
    getCachedAsset(`${CACHE_NAME}/dict`),
  ])

  const detStatus: ModelAssetStatus = {
    key: 'det',
    name: 'det.onnx (DBNet Detection)',
    state: detCached ? 'cached' : 'idle',
    progressPercent: detCached ? 100 : 0,
    loadedBytes: detCached && typeof detCached !== 'string' ? detCached.byteLength : 0,
    totalBytes: detCached && typeof detCached !== 'string' ? detCached.byteLength : 0,
    source: detCached ? 'cache' : 'none',
  }

  const recStatus: ModelAssetStatus = {
    key: 'rec',
    name: 'rec.onnx (CRNN/SVTR Recognition)',
    state: recCached ? 'cached' : 'idle',
    progressPercent: recCached ? 100 : 0,
    loadedBytes: recCached && typeof recCached !== 'string' ? recCached.byteLength : 0,
    totalBytes: recCached && typeof recCached !== 'string' ? recCached.byteLength : 0,
    source: recCached ? 'cache' : 'none',
  }

  const dictStatus: ModelAssetStatus = {
    key: 'dict',
    name: 'ppocr_keys_v1.txt (Character Dictionary)',
    state: dictCached ? 'cached' : 'idle',
    progressPercent: dictCached ? 100 : 0,
    loadedBytes: dictCached ? (typeof dictCached === 'string' ? dictCached.length : dictCached.byteLength) : 0,
    totalBytes: dictCached ? (typeof dictCached === 'string' ? dictCached.length : dictCached.byteLength) : 0,
    source: dictCached ? 'cache' : 'none',
  }

  return {
    det: detStatus,
    rec: recStatus,
    dict: dictStatus,
    allReady: Boolean(detCached && recCached && dictCached),
  }
}
