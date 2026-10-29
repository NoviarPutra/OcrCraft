import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CreditCard,
  Info,
  Lock,
  RotateCw,
  Sliders,
  Sparkles,
} from 'lucide-react'
import { AutoFillFormPanel } from './components/AutoFillFormPanel'
import { JsonRawPanel } from './components/JsonRawPanel'
import { UploadPreviewPanel } from './components/UploadPreviewPanel'
import { useKtpOcr } from './hooks/useKtpOcr'
import type { KtpData, PreprocessResult } from './types/ktp'
import { DEFAULT_THRESHOLD, loadImage, preprocessImage } from './utils/imagePreprocessor'

export function App() {
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [previewCanvasUrl, setPreviewCanvasUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD)
  const [rotation, setRotation] = useState<number>(0)

  // Ref untuk melacak ObjectURL agar selalu di-revoke saat diganti atau unmount
  const objectUrlRef = useRef<string | null>(null)
  const cleanupCanvasRef = useRef<(() => void) | null>(null)
  const loadedImageRef = useRef<HTMLImageElement | null>(null)
  const pipelineSeqRef = useRef<number>(0)
  const { isProcessing, progress, result, setResult, error, runOcr, resetOcr } = useKtpOcr()

  // Fungsi helper pencabutan ObjectURL (Anti-Memory Leak)
  const revokeCurrentObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  // Cleanup ObjectURL dan Canvas saat unmount
  useEffect(() => {
    return () => {
      revokeCurrentObjectUrl()
      loadedImageRef.current = null
      if (cleanupCanvasRef.current) {
        cleanupCanvasRef.current()
        cleanupCanvasRef.current = null
      }
    }
  }, [revokeCurrentObjectUrl])

  // Menjalankan pipeline preprocessing canvas dengan token sekuensial (Anti-Race Condition)
  const runPipeline = useCallback(
    async (img: HTMLImageElement, thresh: number, rot: number) => {
      const currentSeq = ++pipelineSeqRef.current

      try {
        const preprocessed: PreprocessResult = await preprocessImage(img, {
          threshold: thresh,
          rotation: rot,
        })

        // Jika ada perubahan slider/rotasi yang lebih baru, buang hasil basi dan bersihkan kanvasnya
        if (currentSeq !== pipelineSeqRef.current) {
          preprocessed.cleanup()
          return
        }

        // Bersihkan canvas sebelumnya jika ada
        if (cleanupCanvasRef.current) {
          cleanupCanvasRef.current()
          cleanupCanvasRef.current = null
        }

        cleanupCanvasRef.current = preprocessed.cleanup
        setPreviewCanvasUrl(preprocessed.dataUrl)
        setPreviewBlob(preprocessed.blob)
        setDimensions({ width: preprocessed.width, height: preprocessed.height })
      } catch (err) {
        if (currentSeq === pipelineSeqRef.current) {
          console.error('Gagal menjalankan preprocessing canvas:', err)
        }
      }
    },
    []
  )

  // Handler saat file dipilih atau diunggah
  const handleImageSelected = useCallback(
    async (file: File) => {
      setRotation(0)
      resetOcr()

      // Cabut URL sebelumnya jika ada
      revokeCurrentObjectUrl()
      const newUrl = URL.createObjectURL(file)
      objectUrlRef.current = newUrl
      setOriginalImageUrl(newUrl)

      try {
        const img = await loadImage(newUrl)
        loadedImageRef.current = img
        void runPipeline(img, threshold, 0)
      } catch (err) {
        console.error('Gagal memuat gambar yang dipilih:', err)
      }
    },
    [resetOcr, revokeCurrentObjectUrl, runPipeline, threshold]
  )


  // Handler saat slider threshold digeser
  const handleThresholdChange = useCallback(
    (newThresh: number) => {
      setThreshold(newThresh)
      if (loadedImageRef.current) {
        void runPipeline(loadedImageRef.current, newThresh, rotation)
      }
    },
    [rotation, runPipeline]
  )

  // Handler rotasi gambar 90 derajat
  const handleRotate = useCallback(
    (delta: number) => {
      const newRot = ((rotation + delta) % 360 + 360) % 360
      setRotation(newRot)
      if (loadedImageRef.current) {
        void runPipeline(loadedImageRef.current, threshold, newRot)
      }
    },
    [runPipeline, rotation, threshold]
  )

  // Handler reset rotasi ke 0
  const handleResetRotation = useCallback(() => {
    setRotation(0)
    if (loadedImageRef.current) {
      void runPipeline(loadedImageRef.current, threshold, 0)
    }
  }, [runPipeline, threshold])
  // Eksekusi OCR dengan input Blob hasil binarisasi anti-batik
  const handleStartOcr = useCallback(() => {
    if (previewBlob) {
      void runOcr(previewBlob)
    }
  }, [previewBlob, runOcr])

  // Reset semua kondisi
  const handleResetAll = useCallback(() => {
    revokeCurrentObjectUrl()
    loadedImageRef.current = null
    pipelineSeqRef.current++
    if (cleanupCanvasRef.current) {
      cleanupCanvasRef.current()
      cleanupCanvasRef.current = null
    }
    setOriginalImageUrl(null)
    setPreviewCanvasUrl(null)
    setPreviewBlob(null)
    setDimensions(null)
    setThreshold(DEFAULT_THRESHOLD)
    setRotation(0)
    resetOcr()
  }, [resetOcr, revokeCurrentObjectUrl])

  // Handler saat data di form Panel 3 diedit manual
  const handleUpdateData = useCallback(
    (updated: KtpData) => {
      if (result) {
        setResult({
          ...result,
          data: updated,
          meta: {
            ...result.meta,
            nikValid: updated.nik.length === 16 && /^\d{16}$/.test(updated.nik),
          },
        })
      }
    },
    [result, setResult]
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-100 leading-tight flex items-center gap-2">
                Client-Side KTP OCR & JSON Extractor
              </h1>
              <p className="text-xs text-slate-400">
                Ekstraksi teks e-KTP 100% di browser dengan Canvas Preprocessing & Tesseract.js
              </p>
            </div>
          </div>

          {/* Badges Keamanan & Arsitektur */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-3 h-3" />
              100% Client-Side
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Zero-Backend
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              WASM + Web Worker
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Banner Penjelasan Arsitektur 5 Pilar */}
        <section className="bg-linear-to-r from-indigo-950/40 via-slate-900 to-slate-900/60 border border-indigo-500/20 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1 grow">
              <h3 className="text-sm font-bold text-indigo-200">
                Arsitektur Privasi Penuh (Zero-Backend KTP Scanner)
              </h3>
              <p className="text-xs text-slate-300/90 leading-relaxed">
                Foto KTP Anda tidak pernah dikirim ke server manapun. Pemrosesan dilakukan langsung di
                dalam thread browser melalui Web Worker <strong>Tesseract.js</strong> dengan{' '}
                <strong>HTML5 Canvas Preprocessing</strong> (downscaling otomatis ≤ 1600px, pembobotan
                kanal anti-cyan untuk melenyapkan motif batik latar e-KTP, serta thresholding adaptif)
                dan <strong>Heuristic Parser</strong> dengan koreksi karakter OCR otomatis.
              </p>
            </div>
          </div>
        </section>

        {/* Global OCR Error Alert jika ada */}
        {error && (
          <div
            role="alert"
            className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 flex items-start gap-3 text-sm animate-in fade-in"
          >
            <div className="grow">
              <p className="font-semibold text-red-200">Terjadi Kesalahan Engine OCR:</p>
              <p className="text-red-300/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Grid 3 Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panel 1: Upload & Pratinjau Preprocessing (Span 12 di mobile, Span 7 di desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <UploadPreviewPanel
              originalImageUrl={originalImageUrl}
              previewCanvasUrl={previewCanvasUrl}
              threshold={threshold}
              rotation={rotation}
              dimensions={dimensions}
              isProcessing={isProcessing}
              progress={progress}
              onImageSelected={handleImageSelected}
              onThresholdChange={handleThresholdChange}
              onRotate={handleRotate}
              onResetRotation={handleResetRotation}
              onStartOcr={handleStartOcr}
              onResetAll={handleResetAll}
            />

            {/* Panel 2: Hasil JSON & Raw Text */}
            <JsonRawPanel result={result} isProcessing={isProcessing} />
          </div>

          {/* Panel 3: Simulasi Auto-Fill Form (Span 12 di mobile, Span 5 di desktop) */}
          <div className="lg:col-span-5 sticky top-20">
            <AutoFillFormPanel result={result} onUpdateData={handleUpdateData} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 Client-Side KTP OCR & JSON Extractor. 100% Zero-Backend Browser Architecture.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Canvas Preprocessing
            </span>
            <span className="flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
              Rotation Support
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Data Aman di Klien
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
