import {
  AlertCircle,
  ChevronDown,
  FileText,
  Layers,
  Loader2,
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
import type { OcrProgress, PreprocessMode } from '../../types/ktp'
import { validateKtpImageFile } from '../../utils/fileValidator'
import { generateSampleKtpBlob } from '../../utils/sampleKtpGenerator'

interface ControlPanelProps {
  originalImageUrl: string | null
  mode: PreprocessMode
  threshold: number
  contrast: number
  adaptiveSensitivity: number
  adaptiveWindowSize: number
  rotation: number
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
  onResetAll?: () => void
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
    shortDesc: 'Cyan-suppression + kontras lembut. Tepi huruf halus',
    badge: 'DEFAULT',
  },
  {
    id: 'original-color',
    label: 'Original Color',
    shortDesc: 'Warna asli kamera untuk pembacaan gradien',
  },
  {
    id: 'adaptive-threshold',
    label: 'Adaptive Binarize',
    shortDesc: 'Windowing lokal untuk pencahayaan belang/bayangan',
  },
  {
    id: 'global-threshold',
    label: 'Manual Global',
    shortDesc: 'Otsu/Threshold biner statis dengan slider',
  },
]

export function ControlPanel({
  originalImageUrl,
  mode,
  threshold,
  contrast,
  adaptiveSensitivity,
  adaptiveWindowSize,
  rotation,
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
}: ControlPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isGeneratingSample, setIsGeneratingSample] = useState(false)
  const [isAdvancedManualOpen, setIsAdvancedManualOpen] = useState(false)

  // Otomatis buka accordion jika user memilih mode biner manual / adaptif
  const isAdvancedOpen =
    isAdvancedManualOpen ||
    mode === 'global-threshold' ||
    mode === 'adaptive-threshold'

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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isProcessing) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
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

  const handleLoadSample = async () => {
    if (isProcessing || isGeneratingSample) return
    setIsGeneratingSample(true)
    setErrorMessage(null)
    try {
      const sampleBlob = await generateSampleKtpBlob()
      const sampleFile = new File([sampleBlob], 'sample-ktp-budi-santoso.png', {
        type: 'image/png',
      })
      handleFile(sampleFile)
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal membuat sampel KTP demo.'
      )
    } finally {
      setIsGeneratingSample(false)
    }
  }

  return (
    <section
      role="region"
      aria-label="Panel Kontrol & Preprocessing"
      className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-lg flex flex-col h-full min-h-0"
    >
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider">
            Kontrol &amp; Preprocessing
          </h2>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800">
          Kolom 1 / 3
        </span>
      </div>

      {/* Scrollable controls content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pt-2.5">
        {/* Error message alert */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-200 text-xs"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">
              <strong className="font-semibold block text-red-300">Pemeriksaan File Gagal</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* 1. Upload & File Selection Section */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border border-dashed rounded-xl p-3 text-center transition-all ${
            isDragging
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
          } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-indigo-400">
              <UploadCloud className="w-4 h-4" />
            </div>

            <p className="text-xs font-medium text-slate-300">
              {originalImageUrl ? 'Ganti Foto KTP' : 'Unggah Foto KTP'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all">
                <FileText className="w-3 h-3" />
                <span>Pilih File</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInputChange}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                data-testid="load-sample-btn"
                onClick={handleLoadSample}
                disabled={isProcessing || isGeneratingSample}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingSample ? (
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                )}
                <span>Muat Sampel KTP Demo</span>
              </button>

              {originalImageUrl && onResetAll && (
                <button
                  type="button"
                  data-testid="reset-all-btn"
                  onClick={onResetAll}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <span className="text-[10px] text-slate-500 mt-0.5">
              Maks 10 MB (JPG, PNG, WEBP)
            </span>
          </div>
        </div>

        {/* 2. Primary Action Button (Start OCR) */}
        <div className="space-y-2">
          <button
            type="button"
            data-testid="start-ocr-button"
            aria-label="Ekstrak Teks & Data KTP dengan OCR"
            onClick={onStartOcr}
            disabled={isProcessing || !originalImageUrl}
            className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses OCR Tesseract...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>Ekstrak Teks &amp; Data KTP dengan OCR</span>
              </>
            )}
          </button>

          {/* Real-time OCR Progress Bar */}
          {isProcessing && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 truncate max-w-[70%]">
                  {progress.status}
                </span>
                <span className="font-mono text-indigo-400 font-bold">
                  {progress.progress}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progress.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progres Ekstraksi OCR"
                className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-200"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Image Orientation (Rotation) Controls */}
        {originalImageUrl && (
          <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-300 font-medium">Rotasi:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onRotate(-90)}
                disabled={isProcessing}
                aria-label="Putar 90° berlawanan jarum jam"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                title="Putar 90° berlawanan jarum jam"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                {rotation}°
              </span>

              <button
                type="button"
                onClick={() => onRotate(90)}
                disabled={isProcessing}
                aria-label="Putar 90° searah jarum jam"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                title="Putar 90° searah jarum jam"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {rotation !== 0 && (
                <button
                  type="button"
                  onClick={onResetRotation}
                  disabled={isProcessing}
                  aria-label="Reset (0°)"
                  title="Kembalikan orientasi ke 0°"
                  className="text-[10px] px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Reset ({rotation}°)
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. Preprocessing Modes */}
        {originalImageUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Mode Preprocessing:
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5" role="tablist">
              {MODES.map((m) => {
                const isActive = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    data-testid={`mode-tab-${m.id}`}
                    aria-selected={isActive}
                    onClick={() => onModeChange(m.id)}
                    disabled={isProcessing}
                    className={`p-2 rounded-lg text-left transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-xs'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold leading-tight truncate">
                        {m.label}
                      </span>
                      {m.badge && (
                        <span className="text-[9px] font-mono px-1 rounded bg-indigo-500/20 text-indigo-300">
                          {m.badge}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 5. Collapsible Advanced Options (Sliders) */}
            <div className="pt-1">
              <button
                type="button"
                data-testid="toggle-advanced-options"
                onClick={() => setIsAdvancedManualOpen(!isAdvancedManualOpen)}
                aria-expanded={isAdvancedOpen}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-950/60 rounded-lg border border-slate-800/80 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3 h-3 text-indigo-400" />
                  <span>Pengaturan Slider Lanjutan</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isAdvancedOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>

              {isAdvancedOpen && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
                  {/* Contrast Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                        <SunMedium className="w-3 h-3 text-indigo-400" />
                        Kontras Teks:
                      </span>
                      <span className="font-mono text-[11px] text-indigo-300 font-bold">
                        {contrast}
                      </span>
                    </div>
                    <input
                      id="contrast-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={contrast}
                      data-testid="contrast-slider"
                      onChange={(e) => onContrastChange(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Manual Global Threshold Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 text-[11px]">
                        Threshold Biner:
                      </span>
                      <span className="font-mono text-[11px] text-indigo-300 font-bold">
                        {threshold}
                      </span>
                    </div>
                    <input
                      id="threshold-slider"
                      type="range"
                      min={80}
                      max={200}
                      step={1}
                      value={threshold}
                      data-testid="threshold-slider"
                      onChange={(e) => onThresholdChange(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Adaptive Binarization Sliders */}
                  {mode === 'adaptive-threshold' && (
                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Sensitivitas:</span>
                          <span className="font-mono text-indigo-300 font-bold">
                            {adaptiveSensitivity}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={30}
                          step={1}
                          value={adaptiveSensitivity}
                          onChange={(e) =>
                            onAdaptiveSensitivityChange(Number(e.target.value))
                          }
                          disabled={isProcessing}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Ukuran Window:</span>
                          <span className="font-mono text-indigo-300 font-bold">
                            {adaptiveWindowSize} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={9}
                          max={39}
                          step={2}
                          value={adaptiveWindowSize}
                          onChange={(e) =>
                            onAdaptiveWindowSizeChange(Number(e.target.value))
                          }
                          disabled={isProcessing}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
