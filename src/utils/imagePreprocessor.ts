import type { PreprocessOptions, PreprocessResult } from '../types/ktp'

export const DEFAULT_THRESHOLD = 135
export const DEFAULT_MAX_WIDTH = 1600

/**
 * Memuat gambar dari URL atau Blob ke HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>()
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = (e) => reject(new Error('Gagal memuat gambar: ' + String(e)))
  img.src = src
  return promise
}

/**
 * Menghitung dimensi baru dengan mempertahankan rasio aspek
 * Jika lebar atau tinggi gambar melebihi maxWidth (default 1600px),
 * skalakan secara proporsional agar memori browser dan WASM tetap aman.
 */
export function calculateDownscaledDimensions(
  width: number,
  height: number,
  maxWidth: number = DEFAULT_MAX_WIDTH
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new Error('Dimensi gambar tidak valid (lebar dan tinggi harus lebih dari 0).')
  }
  if (width <= maxWidth && height <= maxWidth) {
    return { width, height }
  }

  const aspectRatio = width / height
  if (width > height) {
    const targetWidth = Math.min(width, maxWidth)
    return {
      width: Math.round(targetWidth),
      height: Math.round(targetWidth / aspectRatio),
    }
  } else {
    const targetHeight = Math.min(height, maxWidth)
    return {
      width: Math.round(targetHeight * aspectRatio),
      height: Math.round(targetHeight),
    }
  }
}

/**
 * Pipeline Canvas Preprocessing:
 * 1. Safe Downscaling (lebar maks 1600px)
 * 2. Rotasi 90° / 180° / 270° jika gambar miring/terbalik
 * 3. Grayscale dengan pembobotan kanal warna khusus untuk meredam latar biru/cyan e-KTP
 * 4. Contrast enhancement
 * 5. Binarization (Thresholding hitam-putih tegas) untuk mengeliminasi noise batik/hologram
 * 6. Manajemen memori ketat (offscreen canvas size zeroing saat cleanup)
 */
export async function preprocessImage(
  imageSource: HTMLImageElement,
  options: PreprocessOptions
): Promise<PreprocessResult> {
  const { threshold = DEFAULT_THRESHOLD, rotation = 0, maxWidth = DEFAULT_MAX_WIDTH } = options

  // Normalisasi rotasi ke (0, 90, 180, 270)
  const normRotation = ((rotation % 360) + 360) % 360
  const isPerpendicular = normRotation === 90 || normRotation === 270

  // 1. Safe Downscaling
  const downscaled = calculateDownscaledDimensions(
    imageSource.naturalWidth || imageSource.width,
    imageSource.naturalHeight || imageSource.height,
    maxWidth
  )

  const canvasWidth = isPerpendicular ? downscaled.height : downscaled.width
  const canvasHeight = isPerpendicular ? downscaled.width : downscaled.height

  // Buat offscreen canvas
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    canvas.width = 0
    canvas.height = 0
    throw new Error('Tidak dapat memperoleh 2D context dari Canvas.')
  }

  // 2. Gambar dengan penanganan rotasi
  ctx.save()
  ctx.translate(canvasWidth / 2, canvasHeight / 2)
  ctx.rotate((normRotation * Math.PI) / 180)

  // Gambarkan source image yang di-scale
  ctx.drawImage(
    imageSource,
    -downscaled.width / 2,
    -downscaled.height / 2,
    downscaled.width,
    downscaled.height
  )
  ctx.restore()

  // 3. Ekstraksi ImageData untuk manipulasi piksel langsung
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
  const data = imageData.data
  const totalPixels = data.length

  // Bobot kanal warna khusus untuk meredam cyan/biru e-KTP:
  // Latar e-KTP cyan/biru: R rendah, G & B tinggi. Teks hitam: R, G, B semua rendah.
  // Dengan memberi bobot dominan pada Green (0.45) dan Blue (0.40) serta Red (0.15),
  // latar biru/cyan akan memiliki nilai intensitas terang (>160-200),
  // sedangkan teks hitam laser tetap bernilai sangat gelap (<40).
  const weightR = 0.15
  const weightG = 0.45
  const weightB = 0.4

  // Contrast stretch multiplier
  const contrastFactor = 1.25

  for (let i = 0; i < totalPixels; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // 3a. Grayscale tertimbang anti-cyan
    const gray = weightR * r + weightG * g + weightB * b

    // 3b. Contrast Enhancement
    const enhanced = (gray - 128) * contrastFactor + 128

    // 4. Binarization / Thresholding
    // Jika lebih gelap dari threshold -> teks (hitam 0), jika lebih terang -> latar (putih 255)
    const binary = enhanced < threshold ? 0 : 255
    data[i] = binary
    data[i + 1] = binary
    data[i + 2] = binary
    data[i + 3] = 255 // Alpha penuh
  }

  // Tulis kembali hasil binarized ke canvas
  ctx.putImageData(imageData, 0, 0)

  // 5. Ekstraksi DataURL dan Blob
  let dataUrl = ''
  let blob: Blob
  try {
    dataUrl = canvas.toDataURL('image/png')
    const { promise: blobPromise, resolve: resolveBlob, reject: rejectBlob } =
      Promise.withResolvers<Blob>()
    canvas.toBlob((b) => {
      if (b) resolveBlob(b)
      else rejectBlob(new Error('Gagal mengekspor canvas ke Blob.'))
    }, 'image/png')
    blob = await blobPromise
  } catch (err) {
    canvas.width = 0
    canvas.height = 0
    throw err
  }
  const cleanup = () => {
    canvas.width = 0
    canvas.height = 0
  }

  return {
    dataUrl,
    blob,
    width: canvasWidth,
    height: canvasHeight,
    cleanup,
  }
}
