import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorker, type Worker } from 'tesseract.js'
import type { KtpExtractionResult, OcrProgress } from '../types/ktp'
import { parseKtpText } from '../utils/ktpParser'

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

export function useKtpOcr() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<OcrProgress>({
    status: '',
    progress: 0,
  })
  const [result, setResult] = useState<KtpExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ref untuk melacak active worker agar dapat di-terminate bersih saat unmount
  const workerRef = useRef<Worker | null>(null)
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
    async (imageInput: string | HTMLCanvasElement | Blob) => {
      if (isProcessingRef.current) return
      isProcessingRef.current = true
      setIsProcessing(true)
      setError(null)
      setProgress({ status: 'Memulai inisialisasi OCR...', progress: 0 })

      const startTime = performance.now()

      try {
        // Buat atau gunakan kembali worker tesseract dengan bahasa 'ind'
        if (!workerRef.current) {
          const worker = await createWorker(
            'ind',
            1,
            {
              logger: (m: { status: string; progress: number }) => {
                if (!isMountedRef.current) return
                const friendlyStatus = formatProgressStatus(m.status)
                const pct = Math.round((m.progress || 0) * 100)
                setProgress({
                  status: `${friendlyStatus} (${pct}%)`,
                  progress: pct,
                })
              },
            }
          )

          if (!isMountedRef.current) {
            void worker.terminate()
            return
          }
          workerRef.current = worker
        }

        setProgress({ status: 'Menganalisis teks e-KTP...', progress: 10 })

        const { data } = await workerRef.current.recognize(imageInput)

        const endTime = performance.now()
        const durationMs = endTime - startTime

        const parsed = parseKtpText(data.text, data.confidence, durationMs)

        if (isMountedRef.current) {
          setResult(parsed)
          setProgress({ status: 'Ekstraksi data KTP selesai!', progress: 100 })
        }
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
      } finally {
        isProcessingRef.current = false
        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    []
  )

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
  }
}
