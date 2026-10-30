import {
  ArrowLeft,
  RotateCcw,
  Scan,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KtpData } from '../../../types/ktp'
import type {
  BoundingBox,
  ExecutionProvider,
  ModelAssetKey,
  ModelManagerStatus,
  PaddleOcrResult,
  PipelineProgress,
} from '../../../types/paddleOcr'
import {
  checkAllModelAssetsStatus,
  DEFAULT_MODEL_URLS,
  downloadModelAssetWithProgress,
  loadLocalModelAsset,
} from '../../../utils/modelCacheManager'
import { PaddleOcrEngine } from '../../../utils/paddleOcrEngine'
import { InteractiveBoundingCanvas } from './InteractiveBoundingCanvas'
import { PaddleControlPanel } from './PaddleControlPanel'
import { PaddleResultsPanel } from './PaddleResultsPanel'

interface PaddleOcrWorkspaceProps {
  onBackToHub: () => void
}

const INITIAL_PROGRESS: PipelineProgress = {
  stage: 'idle',
  message: '',
  currentBox: 0,
  totalBoxes: 0,
  detTimeMs: 0,
  recTimeMs: 0,
  totalTimeMs: 0,
}

const INITIAL_MODEL_STATUS: ModelManagerStatus = {
  det: {
    key: 'det',
    name: 'det.onnx (DBNet Detection)',
    state: 'idle',
    progressPercent: 0,
    loadedBytes: 0,
    totalBytes: 0,
    source: 'none',
  },
  rec: {
    key: 'rec',
    name: 'rec.onnx (CRNN/SVTR Recognition)',
    state: 'idle',
    progressPercent: 0,
    loadedBytes: 0,
    totalBytes: 0,
    source: 'none',
  },
  dict: {
    key: 'dict',
    name: 'ppocr_keys_v1.txt (Dictionary)',
    state: 'idle',
    progressPercent: 0,
    loadedBytes: 0,
    totalBytes: 0,
    source: 'none',
  },
  allReady: false,
}

export function PaddleOcrWorkspace({ onBackToHub }: PaddleOcrWorkspaceProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [provider, setProvider] = useState<ExecutionProvider>('wasm')
  const [modelStatus, setModelStatus] = useState<ModelManagerStatus>(INITIAL_MODEL_STATUS)
  const [progress, setProgress] = useState<PipelineProgress>(INITIAL_PROGRESS)
  const [ocrResult, setOcrResult] = useState<PaddleOcrResult | null>(null)
  const [selectedBox, setSelectedBox] = useState<BoundingBox | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const engineRef = useRef<PaddleOcrEngine | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const trackedObjectUrlsRef = useRef<string[]>([])

  // Track ObjectURL for safe teardown
  const trackUrl = useCallback((url: string) => {
    trackedObjectUrlsRef.current.push(url)
    return url
  }, [])

  // Check cache status on mount
  useEffect(() => {
    checkAllModelAssetsStatus().then(setModelStatus)
  }, [])

  // Anti-leak cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort active inference
      abortControllerRef.current?.abort()

      // Release ONNX sessions and offscreen canvas
      if (engineRef.current) {
        engineRef.current.release().catch(console.warn)
        engineRef.current = null
      }

      // Revoke all Object URLs
      for (const url of trackedObjectUrlsRef.current) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // Ignore
        }
      }
      trackedObjectUrlsRef.current = []
    }
  }, [])

  const handleImageSelected = useCallback(
    (_file: File | Blob, url: string) => {
      trackUrl(url)
      setImageUrl(url)
      setOcrResult(null)
      setSelectedBox(null)
      setProgress(INITIAL_PROGRESS)
    },
    [trackUrl]
  )

  const handleDownloadModels = useCallback(async () => {
    const ac = new AbortController()
    abortControllerRef.current = ac

    try {
      // Download DET
      setModelStatus((prev) => ({
        ...prev,
        det: { ...prev.det, state: 'downloading', progressPercent: 0 },
      }))
      await downloadModelAssetWithProgress(
        'det',
        DEFAULT_MODEL_URLS.det,
        (loaded, total, pct) => {
          setModelStatus((prev) => ({
            ...prev,
            det: { ...prev.det, loadedBytes: loaded, totalBytes: total, progressPercent: pct },
          }))
        },
        ac.signal
      )

      // Download REC
      setModelStatus((prev) => ({
        ...prev,
        det: { ...prev.det, state: 'cached', progressPercent: 100 },
        rec: { ...prev.rec, state: 'downloading', progressPercent: 0 },
      }))
      await downloadModelAssetWithProgress(
        'rec',
        DEFAULT_MODEL_URLS.rec,
        (loaded, total, pct) => {
          setModelStatus((prev) => ({
            ...prev,
            rec: { ...prev.rec, loadedBytes: loaded, totalBytes: total, progressPercent: pct },
          }))
        },
        ac.signal
      )

      // Download DICT
      setModelStatus((prev) => ({
        ...prev,
        rec: { ...prev.rec, state: 'cached', progressPercent: 100 },
        dict: { ...prev.dict, state: 'downloading', progressPercent: 0 },
      }))
      await downloadModelAssetWithProgress(
        'dict',
        DEFAULT_MODEL_URLS.dict,
        (loaded, total, pct) => {
          setModelStatus((prev) => ({
            ...prev,
            dict: { ...prev.dict, loadedBytes: loaded, totalBytes: total, progressPercent: pct },
          }))
        },
        ac.signal
      )

      const refreshed = await checkAllModelAssetsStatus()
      setModelStatus(refreshed)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Download model gagal:', err)
        alert(`Gagal mengunduh aset model: ${(err as Error).message}`)
      }
      const refreshed = await checkAllModelAssetsStatus()
      setModelStatus(refreshed)
    }
  }, [])

  const handleLoadLocalFile = useCallback(async (key: ModelAssetKey, file: File) => {
    try {
      await loadLocalModelAsset(key, file)
      const refreshed = await checkAllModelAssetsStatus()
      setModelStatus(refreshed)
    } catch (err) {
      alert(`Gagal memuat file lokal ${key}: ${(err as Error).message}`)
    }
  }, [])

  const handleRunOcr = useCallback(async () => {
    if (!imageUrl || isProcessing) return

    setIsProcessing(true)
    const ac = new AbortController()
    abortControllerRef.current = ac

    try {
      // 1. Ensure models are ready
      setProgress({
        stage: 'loading-model',
        message: 'Menyiapkan sesi ONNX Runtime...',
        currentBox: 0,
        totalBoxes: 0,
        detTimeMs: 0,
        recTimeMs: 0,
        totalTimeMs: 0,
      })

      // Get assets from cache
      const detAsset = await downloadModelAssetWithProgress(
        'det',
        DEFAULT_MODEL_URLS.det,
        undefined,
        ac.signal
      )
      const recAsset = await downloadModelAssetWithProgress(
        'rec',
        DEFAULT_MODEL_URLS.rec,
        undefined,
        ac.signal
      )
      const dictAsset = (await downloadModelAssetWithProgress(
        'dict',
        DEFAULT_MODEL_URLS.dict,
        undefined,
        ac.signal
      )) as string

      // Create engine if needed or re-init
      if (!engineRef.current) {
        engineRef.current = new PaddleOcrEngine()
      }

      await engineRef.current.initialize({
        detAsset,
        recAsset,
        dictAsset,
        provider,
      })

      // 2. Load image into HTMLImageElement
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Gagal memuat gambar KTP untuk inferensi.'))
        img.src = imageUrl
      })
      // 3. Run Pipeline
      const result = await engineRef.current.runPipeline(img, img.naturalWidth, img.naturalHeight, {
        onProgress: setProgress,
        signal: ac.signal,
      })

      setOcrResult(result)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Ekstraksi PaddleOCR gagal:', err)
        setProgress((prev) => ({
          ...prev,
          stage: 'error',
          error: (err as Error).message,
          message: `Gagal: ${(err as Error).message}`,
        }))
      }
    } finally {
      setIsProcessing(false)
    }
  }, [imageUrl, isProcessing, provider])

  const handleResetAll = useCallback(() => {
    abortControllerRef.current?.abort()
    for (const url of trackedObjectUrlsRef.current) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // Ignore
      }
    }
    trackedObjectUrlsRef.current = []
    setImageUrl(null)
    setOcrResult(null)
    setSelectedBox(null)
    setProgress(INITIAL_PROGRESS)
  }, [])

  const handleUpdateKtpData = useCallback((updated: KtpData) => {
    setOcrResult((prev) => {
      if (!prev) return null
      return {
        ...prev,
        ktpData: updated,
      }
    })
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Workspace Header */}
      <header className="h-13 shrink-0 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between gap-3 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            data-testid="back-to-hub-btn"
            onClick={onBackToHub}
            disabled={isProcessing}
            aria-label="Kembali ke Demo Hub"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-hidden shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>← Pilih Versi Demo</span>
          </button>

          <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-linear-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Scan className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight shrink-0">
              PaddleOCR ONNX (Local Neural Engine)
            </span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              v2.1 Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% In-Browser Privacy</span>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            disabled={isProcessing || !imageUrl}
            title="Reset Workspace"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* 3-Column Single Screen Viewport Container */}
      <main className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden h-[calc(100vh-3.25rem)]">
        {/* Left Column: Control Panel */}
        <PaddleControlPanel
          onImageSelected={handleImageSelected}
          hasImage={Boolean(imageUrl)}
          isProcessing={isProcessing}
          provider={provider}
          onProviderChange={setProvider}
          modelStatus={modelStatus}
          onDownloadModels={handleDownloadModels}
          onLoadLocalFile={handleLoadLocalFile}
          progress={progress}
          onRunOcr={handleRunOcr}
          onReset={handleResetAll}
        />

        {/* Center Column: Interactive Bounding Canvas */}
        <InteractiveBoundingCanvas
          imageUrl={imageUrl}
          boxes={ocrResult ? ocrResult.boxes : []}
          selectedBoxId={selectedBox?.id ?? null}
          onSelectBox={setSelectedBox}
          isProcessing={isProcessing}
        />

        {/* Right Column: Tabbed Output */}
        <PaddleResultsPanel
          ocrResult={ocrResult}
          selectedBoxId={selectedBox?.id ?? null}
          onSelectBox={setSelectedBox}
          onUpdateKtpData={handleUpdateKtpData}
          isProcessing={isProcessing}
          provider={provider}
        />
      </main>
    </div>
  )
}
