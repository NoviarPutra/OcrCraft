import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  Globe,
  Loader2,
  Play,
  RotateCcw,
  Server,
  Sparkles,
  UploadCloud,
  Zap,
} from 'lucide-react'
import type { ChangeEvent, DragEvent } from 'react'
import { useRef, useState } from 'react'
import { validateKtpImageFile } from '../../../utils/fileValidator'
import { generateSampleKtpBlob } from '../../../utils/sampleKtpGenerator'

export type ServerStatus = 'online' | 'offline' | 'checking' | 'untested'

export interface RapidControlPanelProps {
  onImageSelected: (file: File | Blob, dataUrl: string) => void
  hasImage: boolean
  isProcessing: boolean
  apiUrl: string
  onApiUrlChange: (url: string) => void
  serverStatus: ServerStatus
  serverError?: string | null
  onTestConnection: () => void
  onRunOcr: () => void
  onReset: () => void
}

export function RapidControlPanel({
  onImageSelected,
  hasImage,
  isProcessing,
  apiUrl,
  onApiUrlChange,
  serverStatus,
  serverError,
  onTestConnection,
  onRunOcr,
  onReset,
}: RapidControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isGeneratingSample, setIsGeneratingSample] = useState(false)
  const [fileValidationError, setFileValidationError] = useState<string | null>(null)

  const processSelectedFile = (file: File) => {
    const validation = validateKtpImageFile(file)
    if (!validation.valid) {
      setFileValidationError(validation.error ?? 'File tidak valid.')
      return
    }
    setFileValidationError(null)
    const url = URL.createObjectURL(file)
    onImageSelected(file, url)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processSelectedFile(file)
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    processSelectedFile(file)
  }

  const handleLoadSample = async () => {
    try {
      setIsGeneratingSample(true)
      setFileValidationError(null)
      const blob = await generateSampleKtpBlob()
      const url = URL.createObjectURL(blob)
      onImageSelected(blob, url)
    } finally {
      setIsGeneratingSample(false)
    }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 1. Image Dropzone */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Dokumen e-KTP
          </label>
          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isProcessing || isGeneratingSample}
            className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isGeneratingSample ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Muat Contoh KTP
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10'
              : hasImage
              ? 'border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-500'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
          }`}
        >
          <UploadCloud
            className={`w-7 h-7 mb-2 ${
              hasImage ? 'text-emerald-400' : 'text-slate-400'
            }`}
          />
          <p className="text-xs font-medium text-slate-200 text-center">
            {hasImage ? 'Ganti Foto e-KTP' : 'Klik atau Tarik Foto e-KTP'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP (Maks. 10 MB)</p>
        </div>
        {fileValidationError && (
          <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
            {fileValidationError}
          </p>
        )}
      </div>

      {/* 2. Backend Server Settings */}
      <div className="flex flex-col gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>FastAPI Server</span>
          </div>

          {/* Status Badge */}
          {serverStatus === 'online' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Online
            </span>
          )}
          {serverStatus === 'offline' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              Offline
            </span>
          )}
          {serverStatus === 'checking' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              Checking
            </span>
          )}
          {serverStatus === 'untested' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              Belum Diuji
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Globe className="w-3 h-3 text-slate-400" />
            Backend API URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => onApiUrlChange(e.target.value)}
              placeholder="http://localhost:8000"
              disabled={isProcessing}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={onTestConnection}
              disabled={isProcessing || serverStatus === 'checking'}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              {serverStatus === 'checking' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3 text-amber-400" />
              )}
              Test
            </button>
          </div>
          {serverError && (
            <p className="text-[10px] text-rose-400 leading-tight">
              {serverError}
            </p>
          )}
        </div>

        <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/70 flex flex-col gap-1">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <FileCode className="w-3 h-3 text-cyan-400" />
            Endpoint Target:
          </span>
          <code className="text-cyan-300 font-mono text-[9.5px]">
            POST {apiUrl.replace(/\/$/, '')}/api/v1/ocr/extract-ktp
          </code>
        </div>
      </div>

      {/* 3. Action Buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-2">
        <button
          type="button"
          onClick={onRunOcr}
          disabled={!hasImage || isProcessing}
          className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Memproses RapidOCR...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Jalankan Ekstraksi RapidOCR</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={isProcessing || (!hasImage && serverStatus === 'untested')}
          className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Form & Input</span>
        </button>
      </div>
    </div>
  )
}
