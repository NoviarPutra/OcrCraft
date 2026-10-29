import type { PreprocessMode, PreprocessOptions, PreprocessResult } from '../types/ktp'

export const DEFAULT_PREPROCESS_MODE: PreprocessMode = 'enhanced-grayscale'
export const DEFAULT_THRESHOLD = 135
export const DEFAULT_CONTRAST = 1.25
export const DEFAULT_ADAPTIVE_SENSITIVITY = 15 // T persentase perbedaan dari rata-rata lokal (5 - 30%)
export const DEFAULT_ADAPTIVE_WINDOW = 31
export const DEFAULT_ADAPTIVE_WINDOW_SIZE = 31
export const DEFAULT_MAX_WIDTH = 1600

/**
 * Rumus "e-KTP Cyan-Suppressing Grayscale":
 * Mengikuti spesifikasi: const gray = Math.round(0.10 * r + 0.55 * g + 0.35 * b)
 * Bobot hijau (0.55) dan biru (0.35) yang dominan memutihkan latar belakang
 * cyan/biru e-KTP secara bersih dan mempertahankan ketajaman teks hitam pekat.
 */
export function cyanSuppressingGrayscale(r: number, g: number, b: number): number {
  return Math.round(0.10 * r + 0.55 * g + 0.35 * b)
}
/**
 * Peningkatan kontras linear terpusat (Soft Contrast Stretch)
 * Menjaga tepi teks tetap anti-aliased halus untuk model LSTM Tesseract.
 */
export function applySoftContrast(gray: number, factor = DEFAULT_CONTRAST): number {
  const enhanced = (gray - 128) * factor + 128
  return Math.min(255, Math.max(0, Math.round(enhanced)))
}

/**
 * Mode 1: Enhanced Grayscale / Soft Contrast (DEFAULT - Terbaik untuk Foto Jelas)
 * Mengubah piksel ke e-KTP Cyan-Suppressing Grayscale + Auto Contrast Stretch
 * TANPA memotong piksel menjadi biner kasar (tanpa binarization).
 */
export function applyEnhancedGrayscale(imageData: ImageData, contrast = DEFAULT_CONTRAST): void {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = cyanSuppressingGrayscale(data[i], data[i + 1], data[i + 2])
    const enhanced = applySoftContrast(gray, contrast)
    data[i] = enhanced
    data[i + 1] = enhanced
    data[i + 2] = enhanced
    data[i + 3] = 255
  }
}

/**
 * Mode 3: Bradley-Roth Adaptive Thresholding berbasis Integral Image
 * Kompleksitas waktu O(1) per piksel independen dari ukuran window.
 * Menghitung ambang batas adaptif lokal untuk mengeliminasi bayangan atau pencahayaan tidak merata.
 */
export function applyBradleyRothThreshold(
  imageData: ImageData,
  width: number,
  height: number,
  sensitivityT = DEFAULT_ADAPTIVE_SENSITIVITY,
  windowSize = DEFAULT_ADAPTIVE_WINDOW
): void {
  const data = imageData.data
  const totalPixels = width * height

  // 1. Konversi ke array grayscale tertimbang e-KTP
  const gray = new Uint8ClampedArray(totalPixels)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = cyanSuppressingGrayscale(data[i], data[i + 1], data[i + 2])
  }

  // 2. Hitung 2D Integral Image dalam O(width * height)
  // Max possible sum untuk 1600x1600x255 = 652,800,000 (aman di dalam Int32Array bertanda)
  const intImg = new Int32Array(totalPixels)
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    const yOffset = y * width
    const prevYOffset = (y - 1) * width
    for (let x = 0; x < width; x++) {
      rowSum += gray[yOffset + x]
      intImg[yOffset + x] = (y > 0 ? intImg[prevYOffset + x] : 0) + rowSum
    }
  }

  // 3. Evaluasi ambang batas adaptif lokal O(1) per piksel
  const halfWindow = Math.floor(windowSize / 2)
  const tFactor = (100 - sensitivityT) / 100

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - halfWindow)
    const y2 = Math.min(height - 1, y + halfWindow)
    const yOffset = y * width
    const y2Offset = y2 * width
    const y1PrevOffset = (y1 - 1) * width

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfWindow)
      const x2 = Math.min(width - 1, x + halfWindow)
      const count = (x2 - x1 + 1) * (y2 - y1 + 1)

      let sum = intImg[y2Offset + x2]
      if (x1 > 0) sum -= intImg[y2Offset + (x1 - 1)]
      if (y1 > 0) sum -= intImg[y1PrevOffset + x2]
      if (x1 > 0 && y1 > 0) sum += intImg[y1PrevOffset + (x1 - 1)]

      const pIdx = (yOffset + x) * 4
      const isBlack = gray[yOffset + x] * count <= sum * tFactor
      const val = isBlack ? 0 : 255
      data[pIdx] = val
      data[pIdx + 1] = val
      data[pIdx + 2] = val
      data[pIdx + 3] = 255
    }
  }
}

/**
 * Mode 4: Manual Global Thresholding
 * Binarisasi hitam-putih klasik dengan slider threshold (80 - 200).
 */
export function applyGlobalThreshold(imageData: ImageData, threshold = DEFAULT_THRESHOLD): void {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = cyanSuppressingGrayscale(data[i], data[i + 1], data[i + 2])
    const binary = gray < threshold ? 0 : 255
    data[i] = binary
    data[i + 1] = binary
    data[i + 2] = binary
    data[i + 3] = 255
  }
}

/**
 * Memuat gambar dari URL atau Blob ke HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error('Gagal memuat elemen gambar dari sumber yang diberikan.'))
    img.src = src
  })
}

/**
 * Menghitung dimensi baru dengan mempertahankan rasio aspek
 * Jika lebar atau tinggi gambar melebihi maxWidth (default 1600px),
 * skalakan secara proporsional agar memori browser dan WASM tetap aman.
 */
/**
 * Rasio standar internasional ISO/IEC 7810 ID-1 (Kartu Identitas KTP) = 85.60 mm : 53.98 mm ≈ 1.58577 : 1
 */
export const ISO_ID1_ASPECT_RATIO = 1.58577

/**
 * Safe Scaling Dimensions:
 * 1. Jika citra terlalu besar (> maxWidth), downscale proporsional ke maxWidth (default 1600px).
 * 2. Jika citra beresolusi rendah (< minUpscaleWidth, default 800px) dan autoUpscale diaktifkan:
 *    Upscale 2x agar tinggi huruf kapital memenuhi standar minimum OCR (>= 30px).
 */
export function calculateScaledDimensions(
  width: number,
  height: number,
  maxWidth: number = DEFAULT_MAX_WIDTH,
  autoUpscale = true,
  minUpscaleWidth = 800
): { width: number; height: number; scaleFactor: number } {
  if (width <= 0 || height <= 0) {
    throw new Error('Dimensi gambar tidak valid (lebar dan tinggi harus lebih dari 0).')
  }

  const aspectRatio = width / height
  let scaleFactor = 1

  if (width > maxWidth || height > maxWidth) {
    if (width >= height) {
      const targetWidth = Math.min(width, maxWidth)
      scaleFactor = targetWidth / width
      return {
        width: Math.round(targetWidth),
        height: Math.round(targetWidth / aspectRatio),
        scaleFactor,
      }
    } else {
      const targetHeight = Math.min(height, maxWidth)
      scaleFactor = targetHeight / height
      return {
        width: Math.round(targetHeight * aspectRatio),
        height: Math.round(targetHeight),
        scaleFactor,
      }
    }
  }

  // Safe 2x upscaling untuk gambar kecil < 800px
  if (autoUpscale && width < minUpscaleWidth) {
    scaleFactor = 2
    return {
      width: Math.round(width * 2),
      height: Math.round(height * 2),
      scaleFactor: 2,
    }
  }

  return { width: Math.round(width), height: Math.round(height), scaleFactor: 1 }
}

/**
 * Backward compatible wrapper untuk calculateDownscaledDimensions
 */
export function calculateDownscaledDimensions(
  width: number,
  height: number,
  maxWidth: number = DEFAULT_MAX_WIDTH
): { width: number; height: number } {
  const res = calculateScaledDimensions(width, height, maxWidth, false)
  return { width: res.width, height: res.height }
}

/**
 * Estimasi kemiringan teks (Auto-Deskew Angle Estimation):
 * Menganalisis variansi intensitas horizontal pada rentang sudut -5° s.d. +5°
 * untuk menemukan sudut rotasi yang menghasilkan baris teks paling horizontal.
 */
export function estimateDeskewAngle(
  imageData: ImageData,
  minAngle = -5,
  maxAngle = 5,
  step = 0.5
): number {
  const { width, height, data } = imageData
  if (width < 30 || height < 30) return 0

  let bestAngle = 0
  let maxVariance = -1

  const startY = Math.floor(height * 0.2)
  const endY = Math.floor(height * 0.85)
  const startX = Math.floor(width * 0.05)
  const endX = Math.floor(width * 0.65)

  for (let angle = minAngle; angle <= maxAngle; angle += step) {
    const rad = (angle * Math.PI) / 180
    const sin = Math.sin(rad)
    const cos = Math.cos(rad)
    const rowSums = new Float64Array(endY - startY)
    const rowCounts = new Uint32Array(endY - startY)

    for (let y = startY; y < endY; y += 4) {
      for (let x = startX; x < endX; x += 4) {
        const cx = x - width / 2
        const cy = y - height / 2
        const rx = Math.round(cx * cos - cy * sin + width / 2)
        const ry = Math.round(cx * sin + cy * cos + height / 2)

        if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
          const idx = (ry * width + rx) * 4
          const gray = data[idx]
          const binY = y - startY
          rowSums[binY] += gray
          rowCounts[binY]++
        }
      }
    }

    let sum = 0
    let count = 0
    for (let i = 0; i < rowSums.length; i++) {
      if (rowCounts[i] > 0) {
        const avg = rowSums[i] / rowCounts[i]
        sum += avg
        count++
      }
    }
    if (count === 0) continue
    const mean = sum / count
    let variance = 0
    for (let i = 0; i < rowSums.length; i++) {
      if (rowCounts[i] > 0) {
        const diff = rowSums[i] / rowCounts[i] - mean
        variance += diff * diff
      }
    }

    if (variance > maxVariance) {
      maxVariance = variance
      bestAngle = angle
    }
  }
  // Jika variansi sangat kecil (gambar polos atau tanpa garis teks horizontal yang jelas), pertahankan orientasi awal (0°)
  if (maxVariance <= 0.05) {
    return 0
  }
  return bestAngle
}

/**
 * Auto-Orientation Detection (Projection Profile Histogram):
 * Menganalisis variansi proyeksi profil piksel horizontal vs vertikal untuk mendeteksi
 * apakah kartu KTP berada dalam orientasi 0°, 90°, 180°, atau 270°.
 *
 * Pada lanskap normal (0°):
 * - Teks e-KTP berjajar horizontal -> profil horizontal memiliki variansi tinggi.
 * - Foto berada di kuadran kanan kartu (x > 0.55).
 *
 * Pada potret (90° / 270°):
 * - Rasio tinggi > lebar atau variansi profil vertikal mendominasi.
 * - Diputar otomatis agar teks kembali sejajar horizontal untuk OCR.
 */
export function detectCoarseOrientation(imageData: ImageData): 0 | 90 | 180 | 270 {
  const { width: W, height: H, data } = imageData
  if (W < 20 || H < 20) return 0

  const step = Math.max(1, Math.floor(Math.min(W, H) / 160))
  const subW = Math.floor(W / step)
  const subH = Math.floor(H / step)

  const hProj = new Float64Array(subH)
  const vProj = new Float64Array(subW)

  const midX = Math.floor(subW * 0.55)
  const midY = Math.floor(subH * 0.55)
  const hLeft = new Float64Array(subH)
  const hRight = new Float64Array(subH)
  const vTop = new Float64Array(subW)
  const vBot = new Float64Array(subW)

  let rowIdx = 0
  for (let y = 0; y < H && rowIdx < subH; y += step) {
    let colIdx = 0
    for (let x = 0; x < W && colIdx < subW; x += step) {
      const idx = (y * W + x) * 4
      const gray = cyanSuppressingGrayscale(data[idx], data[idx + 1], data[idx + 2])
      const darkScore = gray < 140 ? 1 : 0

      hProj[rowIdx] += darkScore
      vProj[colIdx] += darkScore

      if (colIdx < midX) {
        hLeft[rowIdx] += darkScore
      } else {
        hRight[rowIdx] += darkScore
      }

      if (rowIdx < midY) {
        vTop[colIdx] += darkScore
      } else {
        vBot[colIdx] += darkScore
      }

      colIdx++
    }
    rowIdx++
  }

  function variance(arr: Float64Array, start = 0, end = arr.length): number {
    const n = end - start
    if (n <= 1) return 0
    let mean = 0
    for (let i = start; i < end; i++) mean += arr[i]
    mean /= n
    let v = 0
    for (let i = start; i < end; i++) v += (arr[i] - mean) ** 2
    return v / n
  }

  const varH = variance(hProj)
  const varV = variance(vProj)

  const isPortrait = H > W * 1.05 || (varV > varH * 1.25 && H >= W * 0.95)

  if (!isPortrait) {
    // Lanskap: bedakan 0° vs 180°
    const varLeft = variance(hLeft)
    const varRight = variance(hRight)
    return varLeft >= varRight ? 0 : 180
  } else {
    // Potret: bedakan 90° vs 270°
    const varTop = variance(vTop)
    const varBot = variance(vBot)
    return varTop >= varBot ? 90 : 270
  }
}

/**
 * Menghitung Region of Interest (ROI) untuk memotong padding luar / watermark bawah
 * sehingga rasio citra kembali proporsional ke standar ISO/IEC 7810 ID-1 (1.586 : 1).
 */
export function calculateId1CropBounds(
  width: number,
  height: number,
  targetRatio = ISO_ID1_ASPECT_RATIO
): { sx: number; sy: number; sWidth: number; sHeight: number } {
  const currentRatio = width / height
  // Jangan potong agresif jika citra bukan rasio kartu landscape (portrait < 1.15 atau panoramic > 2.20)
  if (currentRatio < 1.15 || currentRatio > 2.20 || Math.abs(currentRatio - targetRatio) < 0.03) {
    return { sx: 0, sy: 0, sWidth: width, sHeight: height }
  }

  if (currentRatio < targetRatio) {
    // Citra terlalu tinggi (misal ada watermark atau margin putih di bawah kartu seperti CamScanner)
    // Potong tinggi dari bagian bawah
    const targetHeight = Math.round(width / targetRatio)
    return {
      sx: 0,
      sy: 0,
      sWidth: width,
      sHeight: Math.min(height, targetHeight),
    }
  } else {
    // Citra terlalu lebar, potong simetris dari kiri dan kanan
    const targetWidth = Math.round(height * targetRatio)
    const offset = Math.round((width - targetWidth) / 2)
    return {
      sx: Math.max(0, offset),
      sy: 0,
      sWidth: Math.min(width, targetWidth),
      sHeight: height,
    }
  }
}

/**
 * Pipeline Canvas Preprocessing:
 * Mendukung 4 Mode:
 * 1. 'enhanced-grayscale' (DEFAULT): Cyan-suppressing grayscale + soft contrast stretch.
 * 2. 'original-color': Full color tanpa modifikasi piksel kanvas.
 * 3. 'adaptive-threshold': Bradley-Roth Integral Image thresholding O(1).
 * 4. 'global-threshold': Hard binarization dengan slider threshold.
 */
export async function preprocessImage(
  imageSource: HTMLImageElement,
  options: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const {
    mode = DEFAULT_PREPROCESS_MODE,
    threshold = DEFAULT_THRESHOLD,
    contrast = DEFAULT_CONTRAST,
    adaptiveSensitivity = DEFAULT_ADAPTIVE_SENSITIVITY,
    adaptiveWindowSize = DEFAULT_ADAPTIVE_WINDOW,
    rotation = 0,
    maxWidth = DEFAULT_MAX_WIDTH,
    autoOrientation = false,
    autoDeskew = false,
    autoCropId1 = true,
    autoUpscaleLowRes = true,
    deskewAngleDeg,
  } = options

  const naturalW = imageSource.naturalWidth || imageSource.width
  const naturalH = imageSource.naturalHeight || imageSource.height

  // 0. Auto-Orientation Detection via Projection Profile Histogram
  let orientationCorrection = 0
  let detectedOrientation = 0
  if (autoOrientation) {
    try {
      const probeCanvas = document.createElement('canvas')
      const probeW = Math.min(naturalW, 240)
      const probeH = Math.max(20, Math.round(probeW / (naturalW / naturalH)))
      probeCanvas.width = probeW
      probeCanvas.height = probeH
      const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true })
      if (probeCtx) {
        probeCtx.drawImage(imageSource, 0, 0, probeW, probeH)
        const imgData = probeCtx.getImageData(0, 0, probeW, probeH)
        detectedOrientation = detectCoarseOrientation(imgData)
        orientationCorrection = (360 - detectedOrientation) % 360
      }
      probeCanvas.width = 0
      probeCanvas.height = 0
    } catch {
      orientationCorrection = 0
    }
  }

  // Normalisasi rotasi ke (0, 90, 180, 270)
  const totalRotation = (rotation + orientationCorrection) % 360
  const normRotation = ((totalRotation % 360) + 360) % 360
  const isPerpendicular = normRotation === 90 || normRotation === 270
  // 1. Automated Border & Watermark Cropping ke rasio ID-1 jika autoCropId1 aktif dan orientasi kartu landscape unrotated
  const crop =
    autoCropId1 && !isPerpendicular
      ? calculateId1CropBounds(naturalW, naturalH)
      : { sx: 0, sy: 0, sWidth: naturalW, sHeight: naturalH }

  // 2. Safe Scaling & Bicubic Upscaling 2x untuk gambar resolusi rendah (< 800px)
  const scaled = calculateScaledDimensions(
    crop.sWidth,
    crop.sHeight,
    maxWidth,
    autoUpscaleLowRes,
    800
  )

  // 3. Auto-Deskewing (deteksi atau sudut manual)
  let deskew = deskewAngleDeg ?? 0
  if (autoDeskew && deskewAngleDeg === undefined) {
    try {
      const probeCanvas = document.createElement('canvas')
      const probeW = Math.min(scaled.width, 320)
      const probeH = Math.max(20, Math.round(probeW / (scaled.width / scaled.height)))
      probeCanvas.width = probeW
      probeCanvas.height = probeH
      const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true })
      if (probeCtx) {
        probeCtx.drawImage(
          imageSource,
          crop.sx,
          crop.sy,
          crop.sWidth,
          crop.sHeight,
          0,
          0,
          probeW,
          probeH
        )
        const probeData = probeCtx.getImageData(0, 0, probeW, probeH)
        applyEnhancedGrayscale(probeData)
        deskew = estimateDeskewAngle(probeData, -5, 5, 0.5)
      }
      probeCanvas.width = 0
      probeCanvas.height = 0
    } catch {
      deskew = 0
    }
  }

  const canvasWidth = isPerpendicular ? scaled.height : scaled.width
  const canvasHeight = isPerpendicular ? scaled.width : scaled.height

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

  // Aktifkan kualitas sampling bicubic/high untuk upscaling gambar resolusi rendah
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Gambarkan dengan orientasi rotasi + deskew
  ctx.save()
  ctx.translate(canvasWidth / 2, canvasHeight / 2)
  const totalAngleDeg = normRotation + deskew
  ctx.rotate((totalAngleDeg * Math.PI) / 180)

  // Gambarkan source image yang di-crop dan di-scale
  ctx.drawImage(
    imageSource,
    crop.sx,
    crop.sy,
    crop.sWidth,
    crop.sHeight,
    -scaled.width / 2,
    -scaled.height / 2,
    scaled.width,
    scaled.height
  )
  ctx.restore()
  // 3. Manipulasi piksel berdasarkan mode yang dipilih
  if (mode !== 'original-color') {
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)

    switch (mode) {
      case 'enhanced-grayscale':
        applyEnhancedGrayscale(imageData, contrast)
        break
      case 'adaptive-threshold':
        applyBradleyRothThreshold(
          imageData,
          canvasWidth,
          canvasHeight,
          adaptiveSensitivity,
          adaptiveWindowSize
        )
        break
      case 'global-threshold':
        applyGlobalThreshold(imageData, threshold)
        break
    }

    ctx.putImageData(imageData, 0, 0)
  }

  // 4. Ekstraksi DataURL dan Blob
  let dataUrl = ''
  let blob: Blob
  try {
    dataUrl = canvas.toDataURL('image/png')
    blob = await new Promise<Blob>((resolveBlob, rejectBlob) => {
      canvas.toBlob((b) => {
        if (b) resolveBlob(b)
        else rejectBlob(new Error('Gagal mengekspor canvas ke Blob.'))
      }, 'image/png')
    })
  } catch (err) {
    canvas.width = 0
    canvas.height = 0
    throw err
  }

  // Cleanup handler untuk offscreen canvas
  const cleanup = () => {
    canvas.width = 0
    canvas.height = 0
  }

  return {
    dataUrl,
    blob,
    width: canvasWidth,
    height: canvasHeight,
    mode,
    orientationApplied: detectedOrientation,
    deskewAngleApplied: deskew,
    upscaled: scaled.scaleFactor > 1,
    cleanup,
  }
}
