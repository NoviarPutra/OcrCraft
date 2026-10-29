import {
  AlertCircle,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import type { ChangeEvent, DragEvent } from 'react'
import { useCallback, useState } from 'react'
import type { OcrProgress } from '../types/ktp'
import { validateKtpImageFile } from '../utils/fileValidator'
import { generateSampleKtpBlob } from '../utils/sampleKtpGenerator'

interface UploadPreviewPanelProps {
  originalImageUrl: string | null
  previewCanvasUrl: string | null
  threshold: number
  rotation: number
  dimensions: { width: number; height: number } | null
  isProcessing: boolean
  progress: OcrProgress
  onImageSelected: (file: File) => void
  onThresholdChange: (value: number) => void
  onRotate: (delta: number) => void
  onResetRotation: () => void
  onStartOcr: () => void
  onResetAll: () => void
}

export function UploadPreviewPanel({
  originalImageUrl,
  previewCanvasUrl,
  threshold,
  rotation,
  dimensions,
  isProcessing,
  progress,
  onImageSelected,
  onThresholdChange,
  onRotate,
  onResetRotation,
  onStartOcr,
  onResetAll,
}: UploadPreviewPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isGeneratingSample, setIsGeneratingSample] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      const validation = validateKtpImageFile(file)
      if (!validation.valid) {
        setErrorMessage(validation.error ?? 'File tidak valid.')
        return
      }
      setErrorMessage(null)
      onImageSelected(file)
    },
    [onImageSelected]
  )

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    // Reset file input value agar file yang sama bisa dipilih ulang jika diperlukan
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (isProcessing) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isProcessing) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleLoadSample = async () => {
    if (isProcessing) return
    setIsGeneratingSample(true)
    setErrorMessage(null)
    try {
      const blob = await generateSampleKtpBlob()
      const sampleFile = new File([blob], 'sample-ktp-demo.png', { type: 'image/png' })
      handleFile(sampleFile)
    } catch (err) {
      setErrorMessage(
        'Gagal menghasilkan contoh KTP demo: ' +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setIsGeneratingSample(false)
    }
  }

  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Panel 1
          </span>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-400" />
            Upload & Pratinjau Preprocessing
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isProcessing || isGeneratingSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGeneratingSample ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            )}
            Muat Sampel KTP Demo
          </button>

          {originalImageUrl && (
            <button
              type="button"
              onClick={onResetAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Pesan Error Aksesibel (role="alert") */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3.5 flex items-start gap-3 text-sm animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="grow">
            <p className="font-semibold text-red-200">Gagal Memvalidasi File</p>
            <p className="text-red-300/90 mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 text-xs font-semibold cursor-pointer px-1.5 py-0.5 rounded-md"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Zona Upload Drag & Drop */}
      {!originalImageUrl ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-indigo-400 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-200">
              Tarik & lepaskan foto KTP ke sini, atau{' '}
              <label className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer font-bold">
                pilih file dari perangkat
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Hanya menerima file gambar JPG, PNG, atau WEBP (Maksimal 10 MB, tidak boleh 0 byte).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/60">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Validasi MIME + Ekstensi
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/60">
              🔒 100% Client-Side / Tanpa Upload Server
            </span>
          </div>
        </div>
      ) : (
        /* Kontrol Preprocessing & Tampilan Berdampingan Before/After */
        <div className="flex flex-col gap-4">
          {/* Bar Kontrol Preprocessing: Threshold Slider & Rotasi */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Slider Threshold */}
            <div className="grow max-w-lg">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="threshold-slider"
                  className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Threshold Filter Anti-Batik KTP:
                </label>
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                  {threshold}
                </span>
              </div>
              <input
                id="threshold-slider"
                type="range"
                min={80}
                max={200}
                value={threshold}
                disabled={isProcessing}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>80 (Lebih Terang)</span>
                <span className="text-indigo-400 font-medium">Optimal: 128 - 145</span>
                <span>200 (Lebih Pekat)</span>
              </div>
            </div>

            {/* Kontrol Rotasi Gambar */}
            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
              <span className="text-xs text-slate-400 mr-1">Rotasi:</span>
              <button
                type="button"
                onClick={() => onRotate(-90)}
                disabled={isProcessing}
                title="Putar 90° berlawanan arah jarum jam"
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onRotate(90)}
                disabled={isProcessing}
                title="Putar 90° searah jarum jam"
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              {rotation !== 0 && (
                <button
                  type="button"
                  onClick={onResetRotation}
                  disabled={isProcessing}
                  className="px-2 py-1 text-[11px] rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {rotation}° (Reset)
                </button>
              )}
            </div>
          </div>

          {/* Info Dimensi Safe Downscaling */}
          {dimensions && (
            <div className="text-xs text-slate-400 flex items-center justify-between px-1">
              <span>
                Resolusi Kanvas:{' '}
                <strong className="text-slate-300 font-mono">
                  {dimensions.width} × {dimensions.height} px
                </strong>
                {dimensions.width >= 1600 || dimensions.height >= 1600 ? (
                  <span className="ml-2 text-emerald-400 font-medium">
                    (Safe Downscaled ≤ 1600px untuk menghemat memori browser)
                  </span>
                ) : null}
              </span>
              <label className="text-indigo-400 hover:text-indigo-300 cursor-pointer underline text-xs">
                Ganti Gambar
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Tampilan Berdampingan: Before vs After */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Panel Kiri: Before (Gambar Asli) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Before: Foto KTP Asli
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {rotation !== 0 ? `Rotasi ${rotation}°` : '0°'}
                </span>
              </div>
              <div className="p-3 flex items-center justify-center min-h-[220px] bg-slate-950/40">
                <img
                  src={originalImageUrl}
                  alt="Foto KTP Asli"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease',
                  }}
                  className="max-h-[260px] w-auto max-w-full object-contain rounded-lg shadow-md"
                />
              </div>
            </div>

            {/* Panel Kanan: After (Hasil Preprocessed Canvas) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  After: Hasil Canvas Preprocessed (Teks Tegas, Anti-Batik)
                </span>
                <span className="text-indigo-400 font-mono text-[11px]">
                  Threshold: {threshold}
                </span>
              </div>
              <div className="p-3 flex items-center justify-center min-h-[220px] bg-slate-950/40">
                {previewCanvasUrl ? (
                  <img
                    src={previewCanvasUrl}
                    alt="Hasil Preprocessed Canvas KTP"
                    className="max-h-[260px] w-auto max-w-full object-contain rounded-lg shadow-md border border-slate-700/60"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    Memproses filter binarization...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Indikator Progres Real-Time OCR */}
          {isProcessing && (
            <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                <span className="flex items-center gap-2 text-indigo-300">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  {progress.status || 'Memproses OCR...'}
                </span>
                <span className="font-mono text-indigo-400 font-bold">{progress.progress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-linear-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, progress.progress)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Engine Tesseract.js (WASM + Worker bahasa Indonesia) sedang menganalisis piksel...
              </p>
            </div>
          )}

          {/* Tombol Eksekusi OCR Utama */}
          <button
            type="button"
            onClick={onStartOcr}
            disabled={isProcessing || !previewCanvasUrl}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Sedang Mengekstrak Data KTP...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <span>Ekstrak Teks & Data KTP dengan OCR (Tesseract.js)</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  )
}
