import { ShieldCheck } from 'lucide-react'
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
import { WorkspaceHeader } from '../WorkspaceHeader'

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
      <WorkspaceHeader
        onBackToHub={onBackToHub}
        title="PaddleOCR ONNX (Local Neural Engine)"
        subtitle="DBNet Detection & SVTR Recognition in Browser"
        badgeText="v2.1 • Local AI"
        badgeVariant="indigo"
        iconGradient="from-indigo-600 to-blue-500"
        isProcessing={isProcessing}
        canReset={Boolean(imageUrl)}
        onResetAll={handleResetAll}
        statusSlot={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-medium">100% In-Browser Privacy</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  modelStatus.allReady
                    ? 'bg-emerald-400'
                    : modelStatus.det.state === 'downloading' || modelStatus.rec.state === 'downloading'
                      ? 'bg-blue-400 animate-pulse'
                      : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300 font-medium hidden sm:inline text-[11px]">
                {modelStatus.allReady
                  ? 'Neural Engine Ready'
                  : modelStatus.det.state === 'downloading' || modelStatus.rec.state === 'downloading'
                    ? 'Memuat Model...'
                    : 'Model Pending'}
              </span>
            </div>
          </div>
        }
        helpTitle="Panduan PaddleOCR ONNX Local Engine"
        helpDescription="Ekstraksi deep learning multi-stage (DBNet text detection + SVTR recognition) dijalankan 100% di browser memanfaatkan ONNX Runtime Web dengan akselerasi WASM SIMD dan WebGPU."
        helpTips={[
          'Model deteksi dan rekognisi diunduh sekali lalu disimpan di browser (IndexedDB / Cache API).',
          'Bounding box yang terdeteksi dapat diklik dan ditelusuri di canvas interaktif tengah.',
          'Algoritma spatial sorting menyusun teks baris demi baris sebelum dipetakan ke field e-KTP.',
          'Pilih provider WebGPU pada browser yang kompatibel untuk akselerasi hingga 3x lebih cepat dibanding WASM.',
        ]}
      />

      {/* 3-Column Single Screen Viewport Container */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
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
