import { useCallback, useEffect, useRef, useState } from 'react'

import { useKtpOcr } from '../../hooks/useKtpOcr'
import type { KtpData, PreprocessMode, PreprocessResult } from '../../types/ktp'
import {
  DEFAULT_ADAPTIVE_SENSITIVITY,
  DEFAULT_ADAPTIVE_WINDOW_SIZE,
  DEFAULT_CONTRAST,
  DEFAULT_PREPROCESS_MODE,
  DEFAULT_THRESHOLD,
  loadImage,
  preprocessImage,
} from '../../utils/imagePreprocessor'
import { ControlPanel } from './ControlPanel'
import { ResultsTabPanel } from './ResultsTabPanel'
import { VisualCanvasPanel } from './VisualCanvasPanel'
import { WorkspaceHeader } from './WorkspaceHeader'

interface TesseractWorkspaceProps {
  onBackToHub: () => void
}

export function TesseractWorkspace({ onBackToHub }: TesseractWorkspaceProps) {
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [previewCanvasUrl, setPreviewCanvasUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  // Opsi Preprocessing
  const [mode, setMode] = useState<PreprocessMode>(DEFAULT_PREPROCESS_MODE)
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD)
  const [contrast, setContrast] = useState<number>(DEFAULT_CONTRAST)
  const [adaptiveSensitivity, setAdaptiveSensitivity] = useState<number>(
    DEFAULT_ADAPTIVE_SENSITIVITY
  )
  const [adaptiveWindowSize, setAdaptiveWindowSize] = useState<number>(
    DEFAULT_ADAPTIVE_WINDOW_SIZE
  )
  const [rotation, setRotation] = useState<number>(0)

  // Ref untuk melacak ObjectURL agar selalu di-revoke saat diganti atau unmount
  const objectUrlRef = useRef<string | null>(null)
  const cleanupCanvasRef = useRef<(() => void) | null>(null)
  const loadedImageRef = useRef<HTMLImageElement | null>(null)
  const pipelineSeqRef = useRef<number>(0)

  const {
    isProcessing,
    progress,
    result,
    setResult,
    runOcr,
    resetOcr,
    terminateWorker,
  } = useKtpOcr()

  // Eksekusi pipeline preprocessing canvas
  const runPipeline = useCallback(
    async (
      img: HTMLImageElement,
      targetMode: PreprocessMode,
      targetThreshold: number,
      targetContrast: number,
      targetAdaptiveSens: number,
      targetAdaptiveWin: number,
      targetRotation: number
    ) => {
      const seq = ++pipelineSeqRef.current

      if (cleanupCanvasRef.current) {
        cleanupCanvasRef.current()
        cleanupCanvasRef.current = null
      }

      try {
        const res: PreprocessResult = await preprocessImage(img, {
          mode: targetMode,
          threshold: targetThreshold,
          contrast: targetContrast,
          adaptiveSensitivity: targetAdaptiveSens,
          adaptiveWindowSize: targetAdaptiveWin,
          rotation: targetRotation,
        })

        if (seq !== pipelineSeqRef.current) {
          res.cleanup()
          return
        }

        cleanupCanvasRef.current = res.cleanup
        setPreviewCanvasUrl(res.dataUrl)
        setPreviewBlob(res.blob)
        setDimensions({ width: res.width, height: res.height })
      } catch (err) {
        console.error('Error saat preprocessing canvas:', err)
      }
    },
    []
  )

  // Revoke object URL saat unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      if (cleanupCanvasRef.current) {
        cleanupCanvasRef.current()
        cleanupCanvasRef.current = null
      }
    }
  }, [])

  // Handler pemilihan file baru
  const handleImageSelected = useCallback(
    async (file: File) => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }

      const newUrl = URL.createObjectURL(file)
      objectUrlRef.current = newUrl
      setOriginalImageUrl(newUrl)
      setRotation(0)
      resetOcr()

      try {
        const img = await loadImage(newUrl)
        loadedImageRef.current = img
        await runPipeline(
          img,
          mode,
          threshold,
          contrast,
          adaptiveSensitivity,
          adaptiveWindowSize,
          0
        )
      } catch (err) {
        console.error('Gagal memuat elemen gambar KTP:', err)
      }
    },
    [
      mode,
      threshold,
      contrast,
      adaptiveSensitivity,
      adaptiveWindowSize,
      resetOcr,
      runPipeline,
    ]
  )

  // Handler rotasi
  const handleRotate = useCallback(
    (delta: number) => {
      const nextRotation = (rotation + delta + 360) % 360
      setRotation(nextRotation)
      if (loadedImageRef.current) {
        void runPipeline(
          loadedImageRef.current,
          mode,
          threshold,
          contrast,
          adaptiveSensitivity,
          adaptiveWindowSize,
          nextRotation
        )
      }
    },
    [
      rotation,
      mode,
      threshold,
      contrast,
      adaptiveSensitivity,
      adaptiveWindowSize,
      runPipeline,
    ]
  )

  const handleResetRotation = useCallback(() => {
    setRotation(0)
    if (loadedImageRef.current) {
      void runPipeline(
        loadedImageRef.current,
        mode,
        threshold,
        contrast,
        adaptiveSensitivity,
        adaptiveWindowSize,
        0
      )
    }
  }, [
    mode,
    threshold,
    contrast,
    adaptiveSensitivity,
    adaptiveWindowSize,
    runPipeline,
  ])

  // Handler perubahan mode
  const handleModeChange = useCallback(
    (newMode: PreprocessMode) => {
      setMode(newMode)
      if (loadedImageRef.current) {
        void runPipeline(
          loadedImageRef.current,
          newMode,
          threshold,
          contrast,
          adaptiveSensitivity,
          adaptiveWindowSize,
          rotation
        )
      }
    },
    [
      threshold,
      contrast,
      adaptiveSensitivity,
      adaptiveWindowSize,
      rotation,
      runPipeline,
    ]
  )

  // Handler slider threshold
  const handleThresholdChange = useCallback(
    (val: number) => {
      setThreshold(val)
      if (loadedImageRef.current) {
        void runPipeline(
          loadedImageRef.current,
          mode,
          val,
          contrast,
          adaptiveSensitivity,
          adaptiveWindowSize,
          rotation
        )
      }
    },
    [
      mode,
      contrast,
      adaptiveSensitivity,
      adaptiveWindowSize,
      rotation,
      runPipeline,
    ]
  )

  // Handler slider kontras
  const handleContrastChange = useCallback(
    (val: number) => {
      setContrast(val)
      if (loadedImageRef.current) {
        void runPipeline(
          loadedImageRef.current,
          mode,
          threshold,
          val,
          adaptiveSensitivity,
          adaptiveWindowSize,
          rotation
        )
      }
    },
    [
      mode,
      threshold,
      adaptiveSensitivity,
      adaptiveWindowSize,
      rotation,
      runPipeline,
    ]
  )

  // Handler adaptive sensitivity
  const handleAdaptiveSensitivityChange = useCallback(
    (val: number) => {
      setAdaptiveSensitivity(val)
      if (loadedImageRef.current) {
        void runPipeline(
          loadedImageRef.current,
          mode,
          threshold,
          contrast,
          val,
          adaptiveWindowSize,
          rotation
        )
      }
    },
    [
      mode,
      threshold,
      contrast,
      adaptiveWindowSize,
      rotation,
      runPipeline,
    ]
  )

  // Handler adaptive window size
  const handleAdaptiveWindowSizeChange = useCallback(
    (val: number) => {
      setAdaptiveWindowSize(val)
      if (loadedImageRef.current) {
        void runPipeline(
          loadedImageRef.current,
          mode,
          threshold,
          contrast,
          adaptiveSensitivity,
          val,
          rotation
        )
      }
    },
    [
      mode,
      threshold,
      contrast,
      adaptiveSensitivity,
      rotation,
      runPipeline,
    ]
  )

  // Mulai eksekusi OCR
  const handleStartOcr = useCallback(async () => {
    if (!previewBlob && !originalImageUrl) return
    const inputPayload = previewBlob ?? originalImageUrl
    if (!inputPayload) return

    await runOcr(inputPayload, {
      mode,
      rotation,
      imageSource: loadedImageRef.current,
      onFallbackApplied: (_newMode, newResult) => {
        setPreviewCanvasUrl(newResult.dataUrl)
        setPreviewBlob(newResult.blob)
        setDimensions({ width: newResult.width, height: newResult.height })
      },
    })
  }, [previewBlob, originalImageUrl, runOcr, mode, rotation])

  // Reset semua state gambar dan OCR
  const handleResetAll = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (cleanupCanvasRef.current) {
      cleanupCanvasRef.current()
      cleanupCanvasRef.current = null
    }
    loadedImageRef.current = null
    setOriginalImageUrl(null)
    setPreviewCanvasUrl(null)
    setPreviewBlob(null)
    setDimensions(null)
    setRotation(0)
    resetOcr()
  }, [resetOcr])

  // Lifecycle Cleanup Wajib saat Keluar Workspace (Back to Hub)
  const handleBackToHub = useCallback(async () => {
    // 1. Batalkan dan terminasi Tesseract worker jika aktif
    await terminateWorker()

    // 2. Bersihkan seluruh object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    // 3. Bersihkan memori canvas offscreen
    if (cleanupCanvasRef.current) {
      cleanupCanvasRef.current()
      cleanupCanvasRef.current = null
    }

    // 4. Reset state
    loadedImageRef.current = null
    setOriginalImageUrl(null)
    setPreviewCanvasUrl(null)
    setPreviewBlob(null)
    setDimensions(null)
    setRotation(0)
    resetOcr()

    // 5. Kembali ke Hub
    onBackToHub()
  }, [terminateWorker, resetOcr, onBackToHub])

  // Update data form hasil edit manual pengguna
  const handleUpdateData = useCallback(
    (updated: KtpData) => {
      if (!result) return
      setResult({
        ...result,
        meta: {
          ...result.meta,
          nikValid: updated.nik.length === 16 && /^\d{16}$/.test(updated.nik),
          isUserEdited: true,
        },
        data: updated,
      })
    },
    [result, setResult]
  )

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Top Header dengan tombol kembali & branding */}
      <WorkspaceHeader
        onBackToHub={handleBackToHub}
        title="Client-Side KTP OCR & JSON Extractor"
        subtitle="Zero-Backend WASM & HTML5 Canvas API"
        badgeText="v1.0 Stable (Zero-Backend)"
        badgeVariant="emerald"
        iconGradient="from-indigo-600 to-blue-500"
        onResetAll={handleResetAll}
        hasImage={Boolean(originalImageUrl)}
        isProcessing={isProcessing}
        helpTitle="Panduan Client-Side Tesseract OCR"
        helpDescription="Ekstraksi data e-KTP berjalan 100% di browser pengguna via WebAssembly tanpa mengirim gambar ke server mana pun."
        helpTips={[
          'Gunakan mode Chroma-Bleaching untuk foto dengan pantulan cahaya atau latar belakang biru/merah pekat.',
          'Sesuaikan slider kontras dan adaptive thresholding bila huruf/angka NIK terlihat tipis atau pecah.',
          'Ekstraksi memproses bounding box teks secara lokal dan memetakan field KTP lewat parser heuristik.',
          'Semua memori Canvas dibersihkan saat Anda menekan tombol Reset atau kembali ke Hub.',
        ]}
      />

      {/* Main Single-Viewport Body */}
      <main className="flex-1 min-h-0 overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3 max-w-[1750px] w-full mx-auto">
        {/* 3-Column Modern Grid Layout (Kiri: Kontrol, Tengah: Canvas, Kanan: Hasil Tab) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full min-h-0">
          {/* Kolom 1: Panel Kontrol & Preprocessing (Kiri) */}
          <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
            <ControlPanel
              originalImageUrl={originalImageUrl}
              mode={mode}
              threshold={threshold}
              contrast={contrast}
              adaptiveSensitivity={adaptiveSensitivity}
              adaptiveWindowSize={adaptiveWindowSize}
              rotation={rotation}
              isProcessing={isProcessing}
              progress={progress}
              onImageSelected={handleImageSelected}
              onModeChange={handleModeChange}
              onThresholdChange={handleThresholdChange}
              onContrastChange={handleContrastChange}
              onAdaptiveSensitivityChange={handleAdaptiveSensitivityChange}
              onAdaptiveWindowSizeChange={handleAdaptiveWindowSizeChange}
              onRotate={handleRotate}
              onResetRotation={handleResetRotation}
              onStartOcr={handleStartOcr}
              onResetAll={handleResetAll}
            />
          </div>

          {/* Kolom 2: Perbandingan Visual Canvas (Tengah) */}
          <div className="lg:col-span-5 h-full min-h-0 flex flex-col">
            <VisualCanvasPanel
              originalImageUrl={originalImageUrl}
              previewCanvasUrl={previewCanvasUrl}
              dimensions={dimensions}
              mode={mode}
              rotation={rotation}
            />
          </div>

          {/* Kolom 3: Tab Hasil Form & JSON (Kanan) */}
          <div className="lg:col-span-4 h-full min-h-0 flex flex-col">
            <ResultsTabPanel
              result={result}
              isProcessing={isProcessing}
              onUpdateData={handleUpdateData}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
