import * as ort from 'onnxruntime-web'
import type {
  BoundingBox,
  ExecutionProvider,
  PaddleOcrResult,
  PipelineProgress,
} from '../types/paddleOcr'
import { buildPaddleDictionary, ctcGreedyDecode } from './ctcDecoder'
import { parsePaddleBoxesToKtp } from './paddleKtpParser'
import { sortBoundingBoxesSpatially } from './spatialSorter'

// Initialize ONNX Runtime Web WASM configuration safely
if (typeof window !== 'undefined' && ort?.env?.wasm) {
  try {
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/'
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true
  } catch (err) {
    console.warn('Gagal mengonfigurasi ort.env.wasm:', err)
  }
}

export interface EngineInitOptions {
  detAsset: ArrayBuffer | string
  recAsset: ArrayBuffer | string
  dictAsset: string
  provider?: ExecutionProvider
}

export class PaddleOcrEngine {
  private detSession: ort.InferenceSession | null = null
  private recSession: ort.InferenceSession | null = null
  private dictionary: string[] = []
  private activeProvider: ExecutionProvider = 'wasm'
  private offscreenCanvas: HTMLCanvasElement | null = null
  private offscreenCtx: CanvasRenderingContext2D | null = null

  /**
   * Initializes or re-initializes the ONNX inference sessions.
   */
  async initialize(options: EngineInitOptions): Promise<void> {
    await this.release()

    this.dictionary = buildPaddleDictionary(options.dictAsset)
    const provider = options.provider ?? 'wasm'
    this.activeProvider = provider

    // Create Det and Rec sessions with WebGPU/WASM fallback
    this.detSession = await this.createSession(options.detAsset, provider)
    this.recSession = await this.createSession(options.recAsset, provider)

    if (typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas')
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })
    }
  }

  private async createSession(
    asset: ArrayBuffer | string,
    provider: ExecutionProvider
  ): Promise<ort.InferenceSession> {
    const sessionOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: provider === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
      graphOptimizationLevel: 'all',
    }

    if (provider === 'webgpu') {
      try {
        if (typeof asset === 'string') {
          return await ort.InferenceSession.create(asset, sessionOptions)
        }
        return await ort.InferenceSession.create(new Uint8Array(asset), sessionOptions)
      } catch (err) {
        console.warn('WebGPU gagal diinisialisasi, fallback otomatis ke WASM:', err)
        this.activeProvider = 'wasm'
        sessionOptions.executionProviders = ['wasm']
      }
    }

    if (typeof asset === 'string') {
      return await ort.InferenceSession.create(asset, sessionOptions)
    }
    return await ort.InferenceSession.create(new Uint8Array(asset), sessionOptions)
  }

  /**
   * - Longest side <= 960px, rounded to multiples of 32
   * - ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225]
   * - Shape [1, 3, H, W]
   */
  preprocessDetImage(
    source: CanvasImageSource,
    origW: number,
    origH: number,
    maxSide: number = 960
  ): { tensor: ort.Tensor; newW: number; newH: number } {
    let ratio = Math.min(maxSide / Math.max(origW, origH), 1.0)
    let newW = Math.max(32, Math.round((origW * ratio) / 32) * 32)
    let newH = Math.max(32, Math.round((origH * ratio) / 32) * 32)

    // Ensure within limits
    if (newW > maxSide) newW = Math.floor(maxSide / 32) * 32
    if (newH > maxSide) newH = Math.floor(maxSide / 32) * 32

    this.getOffscreenCanvas(newW, newH)
    const ctx = this.offscreenCtx!
    ctx.drawImage(source, 0, 0, newW, newH)
    const imgData = ctx.getImageData(0, 0, newW, newH)
    const pixels = imgData.data

    const totalPixels = newW * newH
    const floatArray = new Float32Array(3 * totalPixels)

    const mean = [0.485, 0.456, 0.406]
    const std = [0.229, 0.224, 0.225]

    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4
      const r = pixels[pIdx] / 255.0
      const g = pixels[pIdx + 1] / 255.0
      const b = pixels[pIdx + 2] / 255.0

      floatArray[i] = (r - mean[0]) / std[0] // Channel R
      floatArray[totalPixels + i] = (g - mean[1]) / std[1] // Channel G
      floatArray[2 * totalPixels + i] = (b - mean[2]) / std[2] // Channel B
    }

    const tensor = new ort.Tensor('float32', floatArray, [1, 3, newH, newW])
    return { tensor, newW, newH }
  }

  /**
   * Post-processes DBNet probability map into bounding boxes:
   * - Binarization threshold 0.3
   * - Connected component extraction
   * - 1.5x unclip expansion
   * - Coordinates scaled back to original image dimensions
   */
  postprocessDetBoxes(
    probMap: Float32Array,
    detW: number,
    detH: number,
    origW: number,
    origH: number,
    thresh: number = 0.3,
    minArea: number = 24
  ): BoundingBox[] {
    const visited = new Uint8Array(detW * detH)
    const rawBoxes: { x: number; y: number; w: number; h: number; score: number }[] = []
    const scaleX = origW / detW
    const scaleY = origH / detH

    for (let y = 0; y < detH; y++) {
      for (let x = 0; x < detW; x++) {
        const idx = y * detW + x
        if (visited[idx] === 1 || probMap[idx] < thresh) continue

        let minX = x
        let maxX = x
        let minY = y
        let maxY = y
        let sumScore = 0
        let count = 0

        // Iterative DFS stack
        const stack: number[] = [idx]
        visited[idx] = 1

        while (stack.length > 0) {
          const cur = stack.pop()!
          const cy = Math.floor(cur / detW)
          const cx = cur % detW
          const s = probMap[cur]
          sumScore += s
          count++

          if (cx < minX) minX = cx
          if (cx > maxX) maxX = cx
          if (cy < minY) minY = cy
          if (cy > maxY) maxY = cy

          // 4-neighborhood
          if (cx > 0) {
            const left = cur - 1
            if (visited[left] === 0 && probMap[left] >= thresh) {
              visited[left] = 1
              stack.push(left)
            }
          }
          if (cx < detW - 1) {
            const right = cur + 1
            if (visited[right] === 0 && probMap[right] >= thresh) {
              visited[right] = 1
              stack.push(right)
            }
          }
          if (cy > 0) {
            const up = cur - detW
            if (visited[up] === 0 && probMap[up] >= thresh) {
              visited[up] = 1
              stack.push(up)
            }
          }
          if (cy < detH - 1) {
            const down = cur + detW
            if (visited[down] === 0 && probMap[down] >= thresh) {
              visited[down] = 1
              stack.push(down)
            }
          }
        }

        const bw = maxX - minX + 1
        const bh = maxY - minY + 1

        if (count >= minArea && bw >= 6 && bh >= 6) {
          // Unclip expansion (1.8x)
          const unclipRatio = 1.8
          const dw = Math.round((bw * (unclipRatio - 1)) / 2)
          const dh = Math.round((bh * (unclipRatio - 1)) / 2)
          const unclipX0 = Math.max(0, minX - dw)
          const unclipY0 = Math.max(0, minY - dh)
          const unclipX1 = Math.min(detW, maxX + dw)
          const unclipY1 = Math.min(detH, maxY + dh)
          rawBoxes.push({
            x: unclipX0,
            y: unclipY0,
            w: unclipX1 - unclipX0,
            h: unclipY1 - unclipY0,
            score: sumScore / count,
          })
        }
      }
    }

    // Convert to BoundingBox scaled to original coordinates
    const boxes: BoundingBox[] = rawBoxes.map((rb, index) => {
      const origBoxX = Math.max(0, Math.round(rb.x * scaleX))
      const origBoxY = Math.max(0, Math.round(rb.y * scaleY))
      const origBoxW = Math.min(origW - origBoxX, Math.round(rb.w * scaleX))
      const origBoxH = Math.min(origH - origBoxY, Math.round(rb.h * scaleY))

      return {
        id: `box-${index + 1}`,
        x: origBoxX,
        y: origBoxY,
        w: origBoxW,
        h: origBoxH,
        text: '',
        confidence: Math.round(rb.score * 100) / 100,
      }
    })

    return sortBoundingBoxesSpatially(boxes, {
      yThresholdRatio: 0.5,
      imageWidth: origW,
      imageHeight: origH,
      filterPhotoZone: true,
    })
  }

  /**
   * Preprocesses text crop for CRNN/SVTR Recognition:
   * - Fixed height 48px, proportional dynamic width (min 32px)
   * - PaddleOCR CRNN normalization: (pixel / 255.0 - 0.5) / 0.5 (range -1.0 to 1.0)
   * - Shape [1, 3, 48, recW]
   */
  preprocessRecCrop(
    source: CanvasImageSource,
    box: BoundingBox
  ): { tensor: ort.Tensor; recW: number; recH: number } {
    const recH = 48
    // Horizontal padding 4px-6px so first/last characters and spacing are not truncated
    const padX = 5
    const safeX = Math.max(0, Math.round(box.x - padX))
    const safeY = Math.max(0, Math.round(box.y))
    const safeW = Math.max(1, Math.round(box.w + padX * 2))
    const safeH = Math.max(1, Math.round(box.h))
    const aspect = Math.max(0.1, safeW / safeH)
    const recW = Math.max(32, Math.round(aspect * recH))
    this.getOffscreenCanvas(recW, recH)
    const ctx = this.offscreenCtx!

    // Draw cropped region from source image
    ctx.drawImage(source, safeX, safeY, safeW, safeH, 0, 0, recW, recH)
    const imgData = ctx.getImageData(0, 0, recW, recH)
    const pixels = imgData.data

    const totalPixels = recW * recH
    const floatArray = new Float32Array(3 * totalPixels)

    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4
      // Normalize to -1.0 to 1.0
      floatArray[i] = (pixels[pIdx] / 255.0 - 0.5) / 0.5 // R
      floatArray[totalPixels + i] = (pixels[pIdx + 1] / 255.0 - 0.5) / 0.5 // G
      floatArray[2 * totalPixels + i] = (pixels[pIdx + 2] / 255.0 - 0.5) / 0.5 // B
    }

    const tensor = new ort.Tensor('float32', floatArray, [1, 3, recH, recW])
    return { tensor, recW, recH }
  }

  /**
   * Runs the full 2-stage PaddleOCR pipeline on an e-KTP image.
   */
  async runPipeline(
    source: CanvasImageSource,
    origW: number,
    origH: number,
    options?: {
      onProgress?: (progress: PipelineProgress) => void
      signal?: AbortSignal
    }
  ): Promise<PaddleOcrResult> {
    const startTime = performance.now()
    const report = (partial: Partial<PipelineProgress>) => {
      options?.onProgress?.({
        stage: 'idle',
        message: '',
        currentBox: 0,
        totalBoxes: 0,
        detTimeMs: 0,
        recTimeMs: 0,
        totalTimeMs: 0,
        ...partial,
      })
    }

    if (!this.detSession || !this.recSession) {
      throw new Error('Sesi inferensi PaddleOCR belum diinisialisasi.')
    }

    // --- TAHAP 1: Deteksi Kotak Teks (DBNet) ---
    report({ stage: 'detecting-boxes', message: 'Mendeteksi kotak teks (DBNet ONNX)...' })
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const detStart = performance.now()
    const { tensor: detTensor, newW: detW, newH: detH } = this.preprocessDetImage(
      source,
      origW,
      origH
    )

    let detOutput: ort.Tensor | null = null
    try {
      const feeds: Record<string, ort.Tensor> = {}
      feeds[this.detSession.inputNames[0]] = detTensor
      const results = await this.detSession.run(feeds)
      detOutput = results[this.detSession.outputNames[0]]
    } finally {
      this.safeDisposeTensor(detTensor)
    }

    const detTimeMs = Math.round(performance.now() - detStart)

    if (!detOutput) {
      throw new Error('Model det.onnx tidak menghasilkan output tensor.')
    }

    let detectedBoxes: BoundingBox[]
    try {
      const probMap = detOutput.data as Float32Array
      detectedBoxes = this.postprocessDetBoxes(probMap, detW, detH, origW, origH)
    } finally {
      this.safeDisposeTensor(detOutput)
    }
    // --- TAHAP 2: Rekognisi Karakter (CRNN/SVTR + CTC Decoder) ---
    report({
      stage: 'recognizing-text',
      message: `Membaca teks per baris (0/${detectedBoxes.length} kotak)...`,
      totalBoxes: detectedBoxes.length,
      currentBox: 0,
      detTimeMs,
    })

    const recStart = performance.now()
    const recognizedBoxes: BoundingBox[] = []

    for (let i = 0; i < detectedBoxes.length; i++) {
      if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      const box = detectedBoxes[i]
      report({
        stage: 'recognizing-text',
        message: `Membaca baris (${i + 1}/${detectedBoxes.length})...`,
        currentBox: i + 1,
        totalBoxes: detectedBoxes.length,
        detTimeMs,
      })

      const { tensor: recTensor } = this.preprocessRecCrop(source, box)
      let recOutput: ort.Tensor | null = null

      try {
        const feeds: Record<string, ort.Tensor> = {}
        feeds[this.recSession.inputNames[0]] = recTensor
        const results = await this.recSession.run(feeds)
        recOutput = results[this.recSession.outputNames[0]]

        if (recOutput) {
          const decode = ctcGreedyDecode(
            recOutput.data as Float32Array,
            recOutput.dims,
            this.dictionary
          )
          recognizedBoxes.push({
            ...box,
            text: decode.text,
            confidence: decode.confidence,
          })
        }
      } finally {
        this.safeDisposeTensor(recTensor)
        if (recOutput) this.safeDisposeTensor(recOutput)
      }
    }

    const recTimeMs = Math.round(performance.now() - recStart)

    // --- TAHAP 3: Pemetaan Spatial & Heuristik e-KTP ---
    report({
      stage: 'parsing-ktp',
      message: 'Memetakan baris teks ke format JSON e-KTP...',
      detTimeMs,
      recTimeMs,
    })

    const parseStart = performance.now()
    const { ktpData, rawText, annotatedBoxes } = parsePaddleBoxesToKtp(
      recognizedBoxes,
      origW,
      origH
    )
    const parseTimeMs = Math.round(performance.now() - parseStart)
    const totalTimeMs = Math.round(performance.now() - startTime)

    report({
      stage: 'completed',
      message: 'Ekstraksi PaddleOCR selesai.',
      currentBox: recognizedBoxes.length,
      totalBoxes: recognizedBoxes.length,
      detTimeMs,
      recTimeMs,
      totalTimeMs,
    })

    return {
      boxes: annotatedBoxes,
      rawText,
      ktpData,
      metrics: {
        detTimeMs,
        recTimeMs,
        parseTimeMs,
        totalTimeMs,
      },
      providerUsed: this.activeProvider,
    }
  }

  private safeDisposeTensor(tensor: ort.Tensor | null | undefined): void {
    if (!tensor) return
    try {
      if ('dispose' in tensor && typeof tensor.dispose === 'function') {
        tensor.dispose()
      }
    } catch {
      // Ignored if runtime manages tensor automatically
    }
  }

  private getOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      if (typeof document !== 'undefined') {
        this.offscreenCanvas = document.createElement('canvas')
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })
      } else {
        throw new Error('Canvas tidak didukung di lingkungan ini.')
      }
    }
    this.offscreenCanvas.width = w
    this.offscreenCanvas.height = h
    return this.offscreenCanvas
  }

  /**
   * Deterministic Teardown:
   * Releases ONNX sessions, clears offscreen canvas dimensions, and frees memories.
   */
  async release(): Promise<void> {
    if (this.detSession) {
      try {
        await this.detSession.release()
      } catch (err) {
        console.warn('Gagal release detSession:', err)
      }
      this.detSession = null
    }

    if (this.recSession) {
      try {
        await this.recSession.release()
      } catch (err) {
        console.warn('Gagal release recSession:', err)
      }
      this.recSession = null
    }

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = 0
      this.offscreenCanvas.height = 0
      this.offscreenCanvas = null
      this.offscreenCtx = null
    }

    this.dictionary = []
  }
}
