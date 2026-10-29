import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  SunMedium,
  UploadCloud,
  Wand2,
} from 'lucide-react'
import type { ChangeEvent, DragEvent } from 'react'
import { useCallback, useState } from 'react'
import type { OcrProgress, PreprocessMode } from '../types/ktp'
import { validateKtpImageFile } from '../utils/fileValidator'
import { generateSampleKtpBlob } from '../utils/sampleKtpGenerator'

interface UploadPreviewPanelProps {
  originalImageUrl: string | null
  previewCanvasUrl: string | null
  mode: PreprocessMode
  threshold: number
  contrast: number
  adaptiveSensitivity: number
  adaptiveWindowSize: number
  rotation: number
  dimensions: { width: number; height: number } | null
  isProcessing: boolean
  progress: OcrProgress
  onImageSelected: (file: File) => void
  onModeChange: (mode: PreprocessMode) => void
  onThresholdChange: (value: number) => void
  onContrastChange: (value: number) => void
  onAdaptiveSensitivityChange: (value: number) => void
  onAdaptiveWindowSizeChange: (value: number) => void
  onRotate: (delta: number) => void
  onResetRotation: () => void
  onStartOcr: () => void
  onResetAll: () => void
}

const MODES: Array<{
  id: PreprocessMode
  label: string
  shortDesc: string
  badge?: string
}> = [
  {
    id: 'enhanced-grayscale',
    label: 'Enhanced Grayscale',
    shortDesc: 'Cyan-suppression + soft contrast. Tepi huruf halus anti-aliased (Terbaik untuk foto jelas)',
    badge: 'DEFAULT',
  },
  {
    id: 'original-color',
    label: 'Original Color',
    shortDesc: 'Warna asli kamera (downscaled). Membiarkan Tesseract membaca gradien warna langsung',
  },
  {
    id: 'adaptive-threshold',
    label: 'Adaptive Local',
    shortDesc: 'Bradley-Roth O(1) integral image. Menghilangkan bayangan tanpa menggelapkan separuh KTP',
    badge: 'ANTI-BAYANGAN',
  },
  {
    id: 'global-threshold',
    label: 'Manual Global',
    shortDesc: 'Binarisasi biner tegas hitam-putih klasik dengan slider threshold manual (80 - 200)',
  },
]

export function UploadPreviewPanel({
  originalImageUrl,
  previewCanvasUrl,
  mode,
  threshold,
  contrast,
  adaptiveSensitivity,
  adaptiveWindowSize,
  rotation,
  dimensions,
  isProcessing,
  progress,
  onImageSelected,
  onModeChange,
  onThresholdChange,
  onContrastChange,
  onAdaptiveSensitivityChange,
  onAdaptiveWindowSizeChange,
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 hover:text-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGeneratingSample ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            )}
            Muat Sampel KTP Demo
          </button>

          {originalImageUrl && (
            <button
              type="button"
              onClick={onResetAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Pesan Error Validasi */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="grow">
            <strong className="font-semibold block">Validasi Berkas Gagal</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* State A: Belum ada gambar diunggah */}
      {!originalImageUrl ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-4 ${
            isDragging
              ? 'border-indigo-400 bg-indigo-500/10 scale-[0.99]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="max-w-md">
            <p className="text-base font-semibold text-slate-200">
              Tarik & lepas foto e-KTP ke area ini
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Atau klik tombol di bawah untuk memilih file dari komputer Anda
            </p>
            <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-slate-500">
              <span className="px-2 py-0.5 bg-slate-800 rounded-md">JPG, JPEG</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-md">PNG</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-md">WEBP</span>
              <span>(Maks. 10 MB)</span>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer">
            <FileText className="w-4 h-4" />
            Pilih Foto KTP
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        /* State B: Gambar telah dimuat */
        <div className="flex flex-col gap-4">
          {/* Pilihan 4 Mode Preprocessing */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Mode Preprocessing:
              </span>
              <span className="text-[11px] text-slate-400">
                Pilih metode manipulasi sebelum OCR
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="tablist">
              {MODES.map((m) => {
                const isActive = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    disabled={isProcessing}
                    onClick={() => onModeChange(m.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold leading-tight flex items-center gap-1">
                        {isActive && <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />}
                        {m.label}
                      </span>
                      {m.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            m.badge === 'DEFAULT'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                      {m.shortDesc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bar Kontrol Dinamis Berdasarkan Mode & Rotasi */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Kontrol Dinamis sesuai mode aktif */}
            <div className="grow max-w-xl">
              {mode === 'enhanced-grayscale' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="contrast-slider"
                      className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                    >
                      <SunMedium className="w-3.5 h-3.5 text-indigo-400" />
                      Soft Contrast Multiplier:
                    </label>
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                      {contrast.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    id="contrast-slider"
                    type="range"
                    min={1.0}
                    max={1.8}
                    step={0.05}
                    value={contrast}
                    disabled={isProcessing}
                    onChange={(e) => onContrastChange(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>1.0x (Alami)</span>
                    <span className="text-emerald-400 font-medium">Optimal: 1.25x</span>
                    <span>1.8x (Kontras Kuat)</span>
                  </div>
                </div>
              )}

              {mode === 'original-color' && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Mode Warna Asli:</strong> Mengirim citra RGB asli tanpa manipulasi warna
                    kanvas (maksimal 1600px proporsional).
                  </span>
                </div>
              )}

              {mode === 'adaptive-threshold' && (
                <div className="flex flex-col gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="adaptive-sensitivity-slider"
                        className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                        Sensitivitas Bradley-Roth (T):
                      </label>
                      <span className="px-2 py-0.5 text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                        {adaptiveSensitivity}%
                      </span>
                    </div>
                    <input
                      id="adaptive-sensitivity-slider"
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={adaptiveSensitivity}
                      disabled={isProcessing}
                      onChange={(e) => onAdaptiveSensitivityChange(Number(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>5% (Lebih Gelap)</span>
                      <span className="text-amber-400 font-medium">Optimal: 15%</span>
                      <span>30% (Lebih Terang)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="adaptive-window-slider"
                        className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                      >
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        Window Lokal (S):
                      </label>
                      <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded-md">
                        {adaptiveWindowSize} px
                      </span>
                    </div>
                    <input
                      id="adaptive-window-slider"
                      type="range"
                      min={15}
                      max={65}
                      step={2}
                      value={adaptiveWindowSize}
                      disabled={isProcessing}
                      onChange={(e) => onAdaptiveWindowSizeChange(Number(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {mode === 'global-threshold' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="threshold-slider"
                      className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      Global Threshold:
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
                    <span>80 (Terang)</span>
                    <span className="text-indigo-400 font-medium">Optimal: 128 - 145</span>
                    <span>200 (Pekat)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Kontrol Rotasi Gambar */}
            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4 shrink-0">
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
                  title="Kembalikan orientasi ke 0°"
                  className="px-2 py-1 text-xs rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Reset ({rotation}°)
                </button>
              )}
            </div>
          </div>

          {/* Info Dimensi & Ganti Gambar */}
          {dimensions && (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Resolusi Canvas:{' '}
                <strong className="text-slate-300 font-mono">
                  {dimensions.width} × {dimensions.height} px
                </strong>
                {dimensions.width >= 1600 || dimensions.height >= 1600 ? (
                  <span className="ml-2 text-emerald-400 font-medium">
                    (Safe Downscaled ≤ 1600px untuk menghemat memori)
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
              <div className="p-3 flex items-center justify-center min-h-[260px] bg-slate-950">
                <img
                  src={originalImageUrl}
                  alt="Foto KTP Asli"
                  className="max-h-72 w-auto object-contain rounded-lg shadow-md transition-transform duration-200"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              </div>
            </div>

            {/* Panel Kanan: After (Hasil Preprocessing Canvas) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  After: Hasil Canvas Preprocessed
                </span>
                <span className="text-slate-400 font-mono text-[11px] uppercase">
                  {mode.replace('-', ' ')}
                </span>
              </div>
              <div className="p-3 flex items-center justify-center min-h-[260px] bg-slate-950">
                {previewCanvasUrl ? (
                  <img
                    src={previewCanvasUrl}
                    alt="Hasil Preprocessed Canvas KTP"
                    className="max-h-72 w-auto object-contain rounded-lg shadow-md border border-slate-800 bg-white"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    <span className="text-xs">Memproses kanvas...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tombol Aksi Eksekusi OCR */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onStartOcr}
              disabled={isProcessing || !previewCanvasUrl}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses OCR (Tesseract.js)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>Ekstrak Teks & Data KTP dengan OCR (Tesseract.js)</span>
                </>
              )}
            </button>
          </div>

          {/* Bar Progres Real-Time saat OCR Berjalan */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 flex flex-col gap-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  {progress.status || 'Memproses OCR...'}
                </span>
                <span className="font-mono font-bold text-indigo-400">{progress.progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progress.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progres Ekstraksi OCR"
                className="w-full h-2 rounded-full bg-slate-800 overflow-hidden"
              >
                <div
                  className="h-full bg-linear-to-r from-indigo-500 to-emerald-400 transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, progress.progress)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
