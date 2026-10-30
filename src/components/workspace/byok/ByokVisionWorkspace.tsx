import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  Scan,
  ShieldCheck,
  Sliders,
  Sparkles,
  UploadCloud,
  XCircle,
  Zap,
} from 'lucide-react'
import { useByokProviders } from '../../../hooks/useByokProviders'
import { useByokVision } from '../../../hooks/useByokVision'
import type { ByokOptimizedImage } from '../../../types/byok'
import type { KtpData, KtpExtractionResult } from '../../../types/ktp'
import { optimizeImageForVision } from '../../../utils/byokImageOptimizer'
import { validateKtpImageFile } from '../../../utils/fileValidator'
import { generateSampleKtpBlob } from '../../../utils/sampleKtpGenerator'
import { AutoFillFormPanel } from '../../AutoFillFormPanel'
import { ByokSettingsDrawer } from './ByokSettingsDrawer'
import { WorkspaceHeader } from '../WorkspaceHeader'

interface ByokVisionWorkspaceProps {
  onBackToHub: () => void
}

export function ByokVisionWorkspace({ onBackToHub }: ByokVisionWorkspaceProps) {
  // BYOK Provider & Configuration Store (Lazy State Hydration via localStorage)
  const {
    providers,
    activeProviderId,
    activeProvider,
    activeConfig,
    selectProvider,
    saveProvider,
    deleteProvider,
    markProviderVerified,
    markProviderUnverified,
  } = useByokProviders()

  const config = activeConfig
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'json' | 'quality'>('form')
  const [isCopied, setIsCopied] = useState(false)

  // Image State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [optimizedImage, setOptimizedImage] = useState<ByokOptimizedImage | null>(null)
  const [isOptimizingImage, setIsOptimizingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Object URL Ref untuk cleanup deterministik (Zero Memory Leak)
  const objectUrlRef = useRef<string | null>(null)

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupObjectUrl()
    }
  }, [cleanupObjectUrl])

  // Hook Network Vision
  const {
    isProcessing,
    statusMessage,
    result,
    error,
    extractKtp,
    cancelExtraction,
    resetResult,
    updateResultData,
  } = useByokVision(config)

  // Proses gambar yang diunggah
  const processImageFile = useCallback(
    async (fileOrBlob: File | Blob) => {
      cleanupObjectUrl()
      setImageError(null)
      resetResult()
      setIsOptimizingImage(true)

      try {
        if (fileOrBlob instanceof File) {
          const validation = validateKtpImageFile(fileOrBlob)
          if (!validation.valid) {
            throw new Error(validation.error || 'File tidak valid.')
          }
        }

        const opt = await optimizeImageForVision(fileOrBlob, {
          maxDimension: 1536,
          quality: 0.85,
        })
        setOptimizedImage(opt)

        const url = URL.createObjectURL(opt.blob)
        objectUrlRef.current = url
        setPreviewUrl(url)
      } catch (err) {
        setImageError(`Gagal memproses gambar: ${err instanceof Error ? err.message : String(err)}`)
        setPreviewUrl(null)
        setOptimizedImage(null)
      } finally {
        setIsOptimizingImage(false)
      }
    },
    [cleanupObjectUrl, resetResult]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const handleLoadSample = async () => {
    const sampleBlob = await generateSampleKtpBlob()
    await processImageFile(sampleBlob)
  }

  const handleStartExtraction = async () => {
    if (!optimizedImage) return
    const res = await extractKtp(optimizedImage.dataUrl)
    if (res) {
      markProviderVerified(activeProviderId, res.meta.processingTimeMs)
    }
  }

  const handleResetAll = () => {
    cleanupObjectUrl()
    setPreviewUrl(null)
    setOptimizedImage(null)
    setImageError(null)
    resetResult()
  }

  const handleCopyJson = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setIsCopied(false)
    }
  }

  // Adapter agar result kompatibel dengan AutoFillFormPanel
  const ktpResult: KtpExtractionResult | null = result
    ? {
        meta: {
          confidence: result.meta.confidence,
          processingTimeMs: result.meta.processingTimeMs,
          nikValid: result.meta.nikValid,
        },
        data: result.data,
        rawText: result.rawText,
      }
    : null

  const handleUpdateData = (updated: KtpData) => {
    updateResultData((prev) => ({
      ...prev,
      data: updated,
    }))
  }

  const isKeyConfigured = Boolean(
    config.apiKey.trim() ||
      config.baseUrl.includes('localhost') ||
      config.baseUrl.includes('127.0.0.1')
  )

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* 1. Header Studio Bar */}
      <WorkspaceHeader
        onBackToHub={onBackToHub}
        title="BYOK Vision OCR Studio"
        subtitle="Bring Your Own Key Multimodal Vision API"
        badgeText="v2.0 Beta (OpenAI-Compatible)"
        badgeVariant="indigo"
        iconGradient="from-indigo-500 via-purple-500 to-pink-500"
        isProcessing={isProcessing}
        canReset={Boolean(previewUrl || result)}
        onResetAll={handleResetAll}
        statusSlot={
          <button
            type="button"
            data-testid="byok-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/80 hover:border-slate-600 text-xs text-slate-300 transition-colors cursor-pointer shrink-0"
            title="Klik untuk konfigurasi Base URL & Model"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeProvider.isVerified
                  ? 'bg-emerald-400'
                  : isKeyConfigured
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-slate-200 hidden sm:inline">
              {activeProvider.name}:
            </span>
            <span className="font-mono text-[11px] hidden sm:inline">
              {config.modelId}
            </span>
            {activeProvider.isVerified && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hidden md:inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                {activeProvider.lastLatencyMs ? `${activeProvider.lastLatencyMs}ms` : 'Verified'}
              </span>
            )}
            {config.useLocalProxy && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hidden sm:inline-flex">
                Proxy
              </span>
            )}
            <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        }
        helpTitle="Panduan BYOK Vision OCR Studio"
        helpDescription="Hubungkan API Key multimodal Anda sendiri (OpenAI GPT-4o, OpenRouter, Google Gemini, Ollama/vLLM) untuk ekstraksi teks e-KTP presisi tinggi."
        helpTips={[
          'Kunci API Anda tersimpan 100% lokal di browser dan tidak pernah dikirim ke server aplikasi ini.',
          'Gunakan tombol Status/Settings di header untuk mengganti model atau menguji koneksi endpoint.',
          'Aktifkan opsi Local CORS Proxy jika Anda menggunakan model local Ollama/vLLM yang tidak mendukung browser CORS.',
          'Gambar KTP secara otomatis dioptimalkan ukurannya (Canvas Pre-Flight) sebelum dikirim ke API vision.',
        ]}
      />
      {/* 2. Main Studio Workspace (Above-The-Fold Grid) */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 sm:p-4 overflow-hidden">
        {/* Left Panel: Upload, Pre-Flight Optimization & Controls (Col 5) */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-h-0 h-full">
          {/* Image & Pre-Flight Card */}
          <div className="flex-1 min-h-0 bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-lg flex flex-col gap-3 overflow-hidden">
            {/* Top Card Bar */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs sm:text-sm font-semibold text-slate-200">
                  Visual e-KTP &amp; Pre-Flight
                </h3>
              </div>
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={isProcessing || isOptimizingImage}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                <span>Muat Contoh e-KTP</span>
              </button>
            </div>

            {/* Preview Area / Dropzone */}
            <div className="flex-1 min-h-0 relative rounded-lg border border-dashed border-slate-700/80 bg-slate-950/60 flex flex-col items-center justify-center overflow-hidden group">
              {previewUrl ? (
                <div className="relative w-full h-full flex items-center justify-center p-2 bg-slate-950">
                  <img
                    src={previewUrl}
                    alt="Preview e-KTP"
                    className="max-h-full max-w-full object-contain rounded shadow-md"
                  />
                  {/* Floating Dimension Tag */}
                  {optimizedImage && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-300 backdrop-blur-xs">
                      {optimizedImage.width}×{optimizedImage.height}px •{' '}
                      {(optimizedImage.optimizedSizeBytes / 1024).toFixed(0)} KB (JPEG 0.85)
                    </div>
                  )}
                </div>
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer p-4 text-center hover:bg-slate-900/40 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Klik untuk Unggah Foto e-KTP
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      JPG, PNG, atau WEBP (Maksimal 10 MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}

              {isOptimizingImage && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <span className="text-xs text-slate-300">Mengompresi Gambar di Canvas...</span>
                </div>
              )}
            </div>

            {/* Pre-Flight Spec Banner */}
            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 shrink-0 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Strategi Visual Pre-Flight:
                </span>
                <span className="font-semibold text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  Zero Binarization (True Color)
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                Warna RGB dan struktur spasial e-KTP dipertahankan murni tanpa filter biner agar
                model Vision LLM mengekstrak teks berlatar hologram dengan akurasi optimal.
              </p>
            </div>

            {/* Error Message if any */}
            {(imageError || error) && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 flex items-start gap-2 text-xs text-red-200 shrink-0">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {imageError || error?.message}
                  </div>
                  {error?.details && (
                    <div className="text-[10px] text-red-300 font-mono mt-0.5 truncate">
                      {error.details}
                    </div>
                  )}
                  {error?.code === 'AUTH_FAILED' && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="mt-1.5 text-[11px] underline font-semibold text-amber-300 hover:text-amber-200 block cursor-pointer"
                    >
                      Buka Pengaturan untuk Memasukkan API Key →
                    </button>
                  )}
                  {error?.code === 'CORS_OR_NETWORK' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          saveProvider({ ...activeProvider, useLocalProxy: true })
                          if (optimizedImage) {
                            void extractKtp(optimizedImage.dataUrl)
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        Aktifkan Dev Proxy Lokal &amp; Coba Lagi
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-[11px] underline text-slate-300 hover:text-white cursor-pointer py-1"
                      >
                        Buka Pengaturan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="shrink-0 flex items-center gap-2">
              {isProcessing ? (
                <button
                  type="button"
                  onClick={cancelExtraction}
                  className="w-full py-2.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Batalkan Permintaan (Cancel)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartExtraction}
                  disabled={!optimizedImage || isOptimizingImage}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  <span>Jalankan Ekstraksi Vision ({config.modelId})</span>
                  {!activeProvider.isVerified && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                      Belum Dites
                    </span>
                  )}
                </button>
              )}
            </div>

            {isProcessing && statusMessage && (
              <div className="flex items-center gap-2 text-[11px] text-indigo-300 justify-center">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Tabs Form / JSON / Quality (Col 7) */}
        <div className="lg:col-span-7 flex flex-col min-h-0 h-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-lg overflow-hidden">
          {/* Header Panel Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Simulasi Form</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('json')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'json'
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JSON Raw</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quality')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'quality'
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Quality &amp; Vision Check</span>
              </button>
            </div>

            {/* Confidence & Timing Badges */}
            {result && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {result.meta.processingTimeMs}ms
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    result.meta.confidence >= 80
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {result.meta.confidence}% Akurasi
                </span>
              </div>
            )}
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 min-h-0 pt-3 overflow-hidden">
            {activeTab === 'form' && (
              <AutoFillFormPanel
                result={ktpResult}
                onUpdateData={handleUpdateData}
              />
            )}

            {activeTab === 'json' && (
              <div className="h-full flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">
                    Output Terstruktur e-KTP
                  </span>
                  {result && (
                    <button
                      type="button"
                      onClick={() => handleCopyJson(JSON.stringify(result.data, null, 2))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin JSON</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex-1 min-h-0 bg-slate-950 rounded-lg p-3 overflow-y-auto border border-slate-800/80 font-mono text-xs text-indigo-200">
                  {result ? (
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600">
                      Jalankan ekstraksi untuk melihat payload JSON terstruktur.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'quality' && (
              <div className="h-full flex flex-col gap-3 overflow-y-auto pr-1 text-xs">
                {result ? (
                  <>
                    {/* Execution Meta */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col gap-2">
                      <span className="font-semibold text-slate-300">Metadata Eksekusi</span>
                      <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                        <div>
                          Model:{' '}
                          <span className="text-slate-200 font-mono">
                            {result.meta.modelUsed}
                          </span>
                        </div>
                        <div>
                          Base URL:{' '}
                          <span className="text-slate-200 font-mono truncate block">
                            {result.meta.baseUrlUsed}
                          </span>
                        </div>
                        <div>
                          Status NIK:{' '}
                          <span
                            className={
                              result.meta.nikValid
                                ? 'text-emerald-400 font-semibold'
                                : 'text-amber-400 font-semibold'
                            }
                          >
                            {result.meta.nikValid
                              ? 'Valid (16 Digit & Format Sesuai)'
                              : 'Perlu Tinjauan'}
                          </span>
                        </div>
                        <div>
                          Fallback Mode:{' '}
                          <span className="text-slate-200">
                            {result.meta.fallbackWithoutJsonFormatUsed
                              ? 'Aktif (Tanpa response_format)'
                              : 'Murni JSON Object'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quality Assessment */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col gap-2">
                      <span className="font-semibold text-slate-300">
                        Pemeriksaan Kualitas Visual (Quality Check)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Ketajaman:</span>
                          {result.qualityCheck.isClear ? (
                            <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Jelas
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Buram
                            </span>
                          )}
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Blur:</span>
                          <span
                            className={`font-semibold text-[11px] ${
                              result.qualityCheck.blurDetected
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {result.qualityCheck.blurDetected ? 'Terdeteksi' : 'Nihil'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Glare / Pantulan:</span>
                          <span
                            className={`font-semibold text-[11px] ${
                              result.qualityCheck.glareDetected
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {result.qualityCheck.glareDetected ? 'Terdeteksi' : 'Nihil'}
                          </span>
                        </div>
                      </div>

                      {result.qualityCheck.issues.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1">
                          <span className="text-[11px] text-amber-400 font-medium">
                            Catatan Visual:
                          </span>
                          <ul className="list-disc list-inside text-[11px] text-slate-400">
                            {result.qualityCheck.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Raw Text Output */}
                    <div className="flex-1 min-h-[140px] flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-300 text-xs">
                        Raw Completion Text dari Model
                      </span>
                      <div className="flex-1 min-h-0 bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-slate-300 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">{result.rawText}</pre>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600">
                    Jalankan ekstraksi untuk melihat evaluasi kualitas foto dan metadata respons model.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 3. BYOK Settings Modal / Drawer */}
      <ByokSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        providers={providers}
        activeProviderId={activeProviderId}
        onSelectProvider={selectProvider}
        onSaveProvider={saveProvider}
        onDeleteProvider={deleteProvider}
        onMarkVerified={markProviderVerified}
        onMarkUnverified={markProviderUnverified}
      />
    </div>
  )
}
