import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorker, type Worker } from 'tesseract.js'
import type {
  KtpExtractionResult,
  OcrProgress,
  OcrWorkerInstance,
  PreprocessMode,
  PreprocessResult,
} from '../types/ktp'
import { preprocessImage } from '../utils/imagePreprocessor'
import { mergeKtpResults, parseKtpText } from '../utils/ktpParser'
export interface RunOcrOptions {
  imageSource?: HTMLImageElement | null
  mode?: PreprocessMode
  rotation?: number
  onFallbackApplied?: (newMode: PreprocessMode, newResult: PreprocessResult) => void
}

function formatProgressStatus(status: string): string {
  switch (status) {
    case 'loading tesseract core':
      return 'Memuat WebAssembly Core Tesseract...'
    case 'initializing tesseract':
      return 'Menginisialisasi Engine OCR...'
    case 'loading language traineddata':
    case 'loading language traineddata (fast)':
      return 'Mengunduh traineddata Bahasa Indonesia (ind)...'
    case 'initializing api':
      return 'Menyiapkan API OCR...'
    case 'recognizing text':
      return 'Mengenali teks e-KTP...'
    default:
      return status
  }
}

/**
 * Menghitung skor kualitas hasil ekstraksi untuk membandingkan
 * hasil primary vs candidate fallback.
 * Prioritas 1: NIK 16 digit valid (+1000)
 * Prioritas 2: Confidence score (0-100)
 * Prioritas 3: Jumlah field terisi (+10 per field)
 */
function computeResultScore(res: KtpExtractionResult): number {
  let score = 0
  if (res.meta.nikValid) score += 1000
  score += res.meta.confidence
  const filledCount = Object.values(res.data).filter((v) => v && v.trim().length > 0).length
  score += filledCount * 10
  return score
}

export function useKtpOcr() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<OcrProgress>({
    status: '',
    progress: 0,
  })
  const [result, setResult] = useState<KtpExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ref untuk melacak active worker agar dapat di-terminate bersih saat unmount
  const workerRef = useRef<Worker | OcrWorkerInstance | null>(null)
  const isMountedRef = useRef(true)
  const isProcessingRef = useRef(false)

  // Cleanup worker saat unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (workerRef.current) {
        void workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const runOcr = useCallback(
    async (
      imageInput: string | HTMLCanvasElement | Blob,
      options?: RunOcrOptions
    ): Promise<KtpExtractionResult | null> => {
      if (isProcessingRef.current) return null
      isProcessingRef.current = true
      setIsProcessing(true)
      setError(null)
      setProgress({ status: 'Memulai inisialisasi OCR...', progress: 0 })

      const startTime = performance.now()

      try {
        // Buat atau gunakan kembali worker tesseract dengan bahasa 'ind'
        if (!workerRef.current) {
          const mockCreator =
            typeof window !== 'undefined' ? window.__MOCK_TESSERACT_CREATE_WORKER__ : undefined
          const worker = mockCreator
            ? await mockCreator('ind', 1, {
                logger: (m: { status: string; progress: number }) => {
                  if (!isMountedRef.current) return
                  const friendlyStatus = formatProgressStatus(m.status)
                  const pct = Math.round((m.progress || 0) * 100)
                  setProgress({
                    status: `${friendlyStatus} (${pct}%)`,
                    progress: pct,
                  })
                },
              })
            : await createWorker('ind', 1, {
                logger: (m: { status: string; progress: number }) => {
                  if (!isMountedRef.current) return
                  const friendlyStatus = formatProgressStatus(m.status)
                  const pct = Math.round((m.progress || 0) * 100)
                  setProgress({
                    status: `${friendlyStatus} (${pct}%)`,
                    progress: pct,
                  })
                },
              })

          if (!isMountedRef.current) {
            void worker.terminate()
            return null
          }
          workerRef.current = worker
        }

        setProgress({ status: 'Menganalisis teks e-KTP...', progress: 15 })

        const { data } = await workerRef.current.recognize(imageInput)

        const endTime = performance.now()
        const durationMs = endTime - startTime

        let parsed = parseKtpText(data.text, data.confidence, durationMs)
        parsed.meta.modeUsed = options?.mode ?? 'enhanced-grayscale'
        parsed.meta.retryFallbackUsed = false

        // Multi-Pass Fallback OCR Strategy:
        // Jika hasil ekstraksi pertama gagal memvalidasi NIK 16 digit atau confidence < 60%,
        // jalankan Pass kedua otomatis di latar belakang dengan mode alternatif (Adaptive Thresholding),
        // lalu gabungkan hasil terbaik dari kedua pass (field-level merging).
        if (
          options?.imageSource &&
          (!parsed.meta.nikValid || parsed.meta.confidence < 60)
        ) {
          if (isMountedRef.current) {
            setProgress({
              status: 'Hasil pertama kurang optimal. Menjalankan Pass 2 (Adaptive Thresholding)...',
              progress: 50,
            })
          }

          const fallbackMode: PreprocessMode =
            options.mode === 'adaptive-threshold' ? 'enhanced-grayscale' : 'adaptive-threshold'

          const fallbackResult = await preprocessImage(options.imageSource, {
            mode: fallbackMode,
            adaptiveSensitivity: 20,
            adaptiveWindowSize: 27,
            contrast: 1.4,
            rotation: options.rotation ?? 0,
            autoDeskew: true,
          })

          try {
            if (!workerRef.current || !isMountedRef.current) {
              fallbackResult.cleanup()
              return null
            }
            const { data: fallbackData } = await workerRef.current.recognize(fallbackResult.blob)
            const fallbackDurationMs = performance.now() - startTime
            const fallbackParsed = parseKtpText(
              fallbackData.text,
              fallbackData.confidence,
              fallbackDurationMs
            )
            fallbackParsed.meta.modeUsed = fallbackMode
            fallbackParsed.meta.retryFallbackUsed = true

            // Gabungkan hasil terbaik dari kedua pass (field-level merging)
            const mergedParsed = mergeKtpResults(parsed, fallbackParsed)

            const parsedScore = computeResultScore(parsed)
            const fallbackScore = computeResultScore(fallbackParsed)
            const mergedScore = computeResultScore(mergedParsed)

            let bestResult = parsed
            let shouldUpdatePreview = false

            if (mergedScore >= fallbackScore && mergedScore > parsedScore) {
              bestResult = mergedParsed
              shouldUpdatePreview = fallbackScore > parsedScore
            } else if (fallbackScore > parsedScore) {
              bestResult = fallbackParsed
              shouldUpdatePreview = true
            }

            if (shouldUpdatePreview && fallbackMode !== (options.mode ?? 'enhanced-grayscale')) {
              if (options.onFallbackApplied) {
                options.onFallbackApplied(fallbackMode, fallbackResult)
              } else {
                fallbackResult.cleanup()
              }
            } else {
              fallbackResult.cleanup()
            }

            parsed = bestResult
          } catch {
            fallbackResult.cleanup()
          }
        }

        if (isMountedRef.current) {
          setResult(parsed)
          setProgress({ status: 'Ekstraksi data KTP selesai!', progress: 100 })
        }
        return parsed
      } catch (err) {
        // Jika worker error / crashed, terminasi dan reset agar attempt berikutnya fresh
        if (workerRef.current) {
          void workerRef.current.terminate()
          workerRef.current = null
        }
        if (isMountedRef.current) {
          const errMsg =
            err instanceof Error
              ? err.message
              : 'Terjadi kesalahan saat memproses OCR pada gambar.'
          setError(errMsg)
        }
        return null
      } finally {
        isProcessingRef.current = false
        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    []
  )

  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      try {
        await workerRef.current.terminate()
      } catch {
        // ignore error during terminate
      }
      workerRef.current = null
    }
    isProcessingRef.current = false
    setIsProcessing(false)
    setProgress({ status: '', progress: 0 })
  }, [])

  const resetOcr = useCallback(() => {
    setResult(null)
    setError(null)
    setProgress({ status: '', progress: 0 })
  }, [])

  return {
    isProcessing,
    progress,
    result,
    setResult,
    error,
    runOcr,
    resetOcr,
    terminateWorker,
  }
}
