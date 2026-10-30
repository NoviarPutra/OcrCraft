import type { ByokOptimizedImage } from '../types/byok'

export const DEFAULT_MAX_VISION_DIMENSION = 1536
export const DEFAULT_JPEG_QUALITY = 0.85

/**
 * Menghitung dimensi resize gambar dengan menjaga aspek rasio asli.
 * Batas maksimum dimensi panjang default 1536px (sesuai spesifikasi Vision LLM).
 */
export function calculateVisionDimensions(
  width: number,
  height: number,
  maxDimension = DEFAULT_MAX_VISION_DIMENSION
): { width: number; height: number; scaled: boolean } {
  const safeWidth = Math.max(1, Math.round(width))
  const safeHeight = Math.max(1, Math.round(height))

  const maxSide = Math.max(safeWidth, safeHeight)

  if (maxSide <= maxDimension) {
    return {
      width: safeWidth,
      height: safeHeight,
      scaled: false,
    }
  }

  const scale = maxDimension / maxSide
  const targetWidth = Math.max(1, Math.round(safeWidth * scale))
  const targetHeight = Math.max(1, Math.round(safeHeight * scale))

  return {
    width: targetWidth,
    height: targetHeight,
    scaled: true,
  }
}

/**
 * Memuat Blob / File / ObjectURL ke dalam HTMLImageElement secara aman dengan teardown.
 */
export function loadVisionImage(
  source: Blob | File | string
): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  const { promise, resolve, reject } = Promise.withResolvers<{
    img: HTMLImageElement
    cleanup: () => void
  }>()
  const img = new Image()
  let objectUrl: string | null = null

  const cleanup = () => {
    img.onload = null
    img.onerror = null
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  }

  img.onload = () => {
    resolve({ img, cleanup })
  }

  img.onerror = (err) => {
    cleanup()
    reject(new Error(`Gagal memuat gambar: ${String(err)}`))
  }

  if (typeof source === 'string') {
    img.src = source
  } else {
    objectUrl = URL.createObjectURL(source)
    img.src = objectUrl
  }

  return promise
}
/**
 * Client-Side Pre-Flight Image Optimizer untuk Vision LLM:
 * - Tidak mengubah ke binarization / hitam-putih (mempertahankan warna & konteks spasial)
 * - Safe Resize jika melebihi batas panjang dimensi (default 1536px)
 * - Kompresi JPEG kualitas 0.85
 * - Zero-Retention teardown pada Canvas untuk mencegah memory leak
 */
export async function optimizeImageForVision(
  source: HTMLImageElement | Blob | File,
  options: {
    maxDimension?: number
    quality?: number
    originalSizeBytes?: number
  } = {}
): Promise<ByokOptimizedImage> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_VISION_DIMENSION
  const quality = options.quality ?? DEFAULT_JPEG_QUALITY

  let imgElement: HTMLImageElement
  let externalCleanup: (() => void) | null = null
  let sourceSize = options.originalSizeBytes ?? 0

  if (source instanceof Blob) {
    sourceSize = source.size
    const loaded = await loadVisionImage(source)
    imgElement = loaded.img
    externalCleanup = loaded.cleanup
  } else {
    imgElement = source
  }

  const naturalWidth = imgElement.naturalWidth || imgElement.width
  const naturalHeight = imgElement.naturalHeight || imgElement.height

  const { width: targetWidth, height: targetHeight } = calculateVisionDimensions(
    naturalWidth,
    naturalHeight,
    maxDimension
  )

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    if (externalCleanup) externalCleanup()
    throw new Error('Gagal menginisialisasi 2D Canvas context.')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imgElement, 0, 0, targetWidth, targetHeight)

  // Ekspor ke DataURL
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  // Konversi ke Blob
  const { promise: blobPromise, resolve: resolveBlob, reject: rejectBlob } =
    Promise.withResolvers<Blob>()
  canvas.toBlob(
    (b) => {
      if (b) {
        resolveBlob(b)
      } else {
        rejectBlob(new Error('Gagal mengonversi canvas ke Blob JPEG.'))
      }
    },
    'image/jpeg',
    quality
  )
  const blob: Blob = await blobPromise

  // Zero memory retention teardown pada canvas
  canvas.width = 0
  canvas.height = 0

  if (externalCleanup) {
    externalCleanup()
  }

  return {
    dataUrl,
    blob,
    originalWidth: naturalWidth,
    originalHeight: naturalHeight,
    width: targetWidth,
    height: targetHeight,
    originalSizeBytes: sourceSize || blob.size,
    optimizedSizeBytes: blob.size,
  }
}
