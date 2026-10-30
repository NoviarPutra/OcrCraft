import {
  CheckCircle2,
  Cpu,
  Download,
  FileCode,
  FolderOpen,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Zap,
} from 'lucide-react'
import { useRef } from 'react'
import type {
  ExecutionProvider,
  ModelAssetKey,
  ModelManagerStatus,
  PipelineProgress,
} from '../../../types/paddleOcr'
import { generateSampleKtpBlob } from '../../../utils/sampleKtpGenerator'

interface PaddleControlPanelProps {
  onImageSelected: (file: File | Blob, dataUrl: string) => void
  hasImage: boolean
  isProcessing: boolean
  provider: ExecutionProvider
  onProviderChange: (provider: ExecutionProvider) => void
  modelStatus: ModelManagerStatus
  onDownloadModels: () => void
  onLoadLocalFile: (key: ModelAssetKey, file: File) => void
  progress: PipelineProgress
  onRunOcr: () => void
  onReset: () => void
}

export function PaddleControlPanel({
  onImageSelected,
  hasImage,
  isProcessing,
  provider,
  onProviderChange,
  modelStatus,
  onDownloadModels,
  onLoadLocalFile,
  progress,
  onRunOcr,
  onReset,
}: PaddleControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const localModelInputRef = useRef<HTMLInputElement>(null)
  const pendingAssetKeyRef = useRef<ModelAssetKey>('det')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onImageSelected(file, url)
    e.target.value = ''
  }

  const handleSampleClick = async () => {
    if (isProcessing) return
    const blob = await generateSampleKtpBlob()
    const url = URL.createObjectURL(blob)
    onImageSelected(blob, url)
  }

  const handlePickLocalAsset = (key: ModelAssetKey) => {
    pendingAssetKeyRef.current = key
    if (localModelInputRef.current) {
      localModelInputRef.current.accept = key === 'dict' ? '.txt' : '.onnx'
      localModelInputRef.current.click()
    }
  }

  const handleLocalModelSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onLoadLocalFile(pendingAssetKeyRef.current, file)
    e.target.value = ''
  }

  // Calculate overall model download progress
  const totalLoaded =
    modelStatus.det.loadedBytes + modelStatus.rec.loadedBytes + modelStatus.dict.loadedBytes
  const totalExpected =
    modelStatus.det.totalBytes + modelStatus.rec.totalBytes + modelStatus.dict.totalBytes
  const isDownloading =
    modelStatus.det.state === 'downloading' ||
    modelStatus.rec.state === 'downloading' ||
    modelStatus.dict.state === 'downloading'

  // Stepper Stage Status
  const getStepStatus = (stepIndex: number) => {
    // 0: loading-model, 1: detecting-boxes, 2: recognizing-text, 3: parsing-ktp
    const stageMap: Record<string, number> = {
      idle: -1,
      'loading-model': 0,
      'detecting-boxes': 1,
      'recognizing-text': 2,
      'parsing-ktp': 3,
      completed: 4,
      error: -1,
    }

    const currentStageIndex = stageMap[progress.stage] ?? -1
    if (progress.stage === 'error') return 'error'
    if (currentStageIndex > stepIndex) return 'done'
    if (currentStageIndex === stepIndex) return 'active'
    return 'pending'
  }

  return (
    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 overflow-y-auto">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={localModelInputRef}
        type="file"
        onChange={handleLocalModelSelected}
        className="hidden"
      />

      {/* 1. Image Dropzone */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Foto e-KTP</span>
          {hasImage && (
            <span className="text-[10px] text-emerald-400 font-normal">Foto Terpasang</span>
          )}
        </label>

        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group ${
            hasImage
              ? 'border-indigo-500/50 bg-indigo-500/5 hover:border-indigo-400'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:scale-105 transition-all">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div className="text-xs text-slate-300 font-medium">
            Klik untuk memilih foto e-KTP
          </div>
          <div className="text-[11px] text-slate-500">Mendukung JPEG, PNG, atau WebP</div>
        </div>

        <button
          type="button"
          onClick={handleSampleClick}
          disabled={isProcessing}
          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Gunakan Sample KTP Sintetis</span>
        </button>
      </div>

      {/* 2. Execution Provider Selector */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Execution Provider</span>
          <span className="text-[10px] text-slate-500 font-mono">ONNX Runtime</span>
        </label>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/70 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onProviderChange('wasm')}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
              provider === 'wasm'
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>WASM SIMD</span>
          </button>

          <button
            type="button"
            onClick={() => onProviderChange('webgpu')}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
              provider === 'webgpu'
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>WebGPU</span>
          </button>
        </div>
        <div className="text-[10px] text-slate-500">
          {provider === 'wasm'
            ? 'WebAssembly single-threaded dengan SIMD (kompatibilitas 100% stabil).'
            : 'WebGPU Shader Hardware Acceleration (auto-fallback ke WASM jika tidak didukung).'}
        </div>
      </div>

      {/* 3. Model Manager Card */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Model Manager & Cache</span>
          </label>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              modelStatus.allReady
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {modelStatus.allReady ? 'Ready in Cache' : 'Aset Belum Lengkap'}
          </span>
        </div>

        {/* Individual Asset Status */}
        <div className="flex flex-col gap-1.5 text-xs">
          {[modelStatus.det, modelStatus.rec, modelStatus.dict].map((asset) => {
            const isReady = asset.state === 'cached' || asset.state === 'ready'
            return (
              <div
                key={asset.key}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-[11px]"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isReady
                        ? 'bg-emerald-400'
                        : asset.state === 'downloading'
                          ? 'bg-indigo-400 animate-pulse'
                          : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-slate-300 truncate font-mono">{asset.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500">
                    {isReady
                      ? 'Tersedia'
                      : asset.state === 'downloading'
                        ? `${asset.progressPercent}%`
                        : 'Offline'}
                  </span>
                  <button
                    type="button"
                    title={`Pilih file ${asset.key} lokal`}
                    onClick={() => handlePickLocalAsset(asset.key)}
                    className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <FolderOpen className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Download Progress Bar */}
        {isDownloading && (
          <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30">
            <div className="flex items-center justify-between text-[11px] text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Mengunduh Aset Model...</span>
              </span>
              <span className="font-mono text-[10px]">
                {(totalLoaded / (1024 * 1024)).toFixed(1)} /{' '}
                {totalExpected > 0 ? (totalExpected / (1024 * 1024)).toFixed(1) : '?'} MB
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-indigo-500 to-blue-500 transition-all duration-200"
                style={{
                  width: `${
                    totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 10
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Download Action & Fallback */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownloadModels}
            disabled={isDownloading || isProcessing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>{modelStatus.allReady ? 'Perbarui Cache Model' : 'Unduh & Simpan ke Cache'}</span>
          </button>
        </div>
      </div>

      {/* 4. 4-Stage Stepper Progress */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Progres Inferensi</span>
          {progress.totalTimeMs > 0 && (
            <span className="text-[10px] text-emerald-400 font-mono">
              Total {progress.totalTimeMs} ms
            </span>
          )}
        </label>

        <div className="flex flex-col gap-1.5">
          {[
            { label: '1. Memuat Model (ONNX Engine)', index: 0 },
            { label: '2. Deteksi Kotak Teks (DBNet)', index: 1 },
            {
              label: `3. Rekognisi Baris (${progress.currentBox}/${progress.totalBoxes} Kotak)`,
              index: 2,
            },
            { label: '4. Pemetaan JSON e-KTP', index: 3 },
          ].map((step) => {
            const status = getStepStatus(step.index)
            return (
              <div
                key={step.index}
                className={`flex items-center justify-between p-2 rounded-lg text-xs border transition-colors ${
                  status === 'active'
                    ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200 font-medium'
                    : status === 'done'
                      ? 'bg-slate-950/40 border-slate-800 text-slate-300'
                      : 'bg-slate-950/20 border-slate-900 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {status === 'active' ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  ) : status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <span className="truncate">{step.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 5. Primary Action Buttons */}
      <div className="flex flex-col gap-2 pt-2 mt-auto border-t border-slate-800/60">
        <button
          type="button"
          onClick={onRunOcr}
          disabled={!hasImage || isProcessing || isDownloading}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses PaddleOCR...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Mulai Ekstraksi PaddleOCR</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={isProcessing}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent hover:border-slate-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Semua</span>
        </button>
      </div>
    </div>
  )
}
