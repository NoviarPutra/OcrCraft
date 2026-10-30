import {
  ArrowLeft,
  RotateCcw,
  Server,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KtpData } from '../../../types/ktp'
import type { BoundingBox } from '../../../types/paddleOcr'
import {
  parseRapidOcrResponse,
  type RapidKtpParseResult,
} from '../../../utils/rapidKtpParser'
import { InteractiveBoundingCanvas } from '../paddle/InteractiveBoundingCanvas'
import {
  RapidControlPanel,
  type ServerStatus,
} from './RapidControlPanel'
import { RapidResultsPanel } from './RapidResultsPanel'

interface RapidOcrWorkspaceProps {
  onBackToHub: () => void
}

interface RapidBackendRawResponse {
  success: boolean
  boxes?: number[][][]
  txts?: string[]
  scores?: number[]
  raw_text?: string
  det_ms?: number
  rec_ms?: number
  total_ms?: number
}

const DEFAULT_API_URL = 'http://localhost:8000'

export function RapidOcrWorkspace({ onBackToHub }: RapidOcrWorkspaceProps) {
  const [imageFile, setImageFile] = useState<File | Blob | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [apiUrl, setApiUrl] = useState<string>(() => {
    return sessionStorage.getItem('rapidocr_api_url') || DEFAULT_API_URL
  })
  const [serverStatus, setServerStatus] = useState<ServerStatus>('untested')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrResult, setOcrResult] = useState<RapidKtpParseResult | null>(null)
  const [metrics, setMetrics] = useState<{
    detMs: number
    recMs: number
    totalMs: number
  } | null>(null)
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)

  // ObjectURL ref for zero-leak teardown
  const objectUrlRef = useRef<string | null>(null)
  // AbortController ref for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const testAbortControllerRef = useRef<AbortController | null>(null)
  // Persist API URL changes to sessionStorage
  const handleApiUrlChange = (newUrl: string) => {
    setApiUrl(newUrl)
    sessionStorage.setItem('rapidocr_api_url', newUrl)
    setServerStatus('untested')
    setServerError(null)
  }

  // Handle image selection with object URL cleanup
  const handleImageSelected = useCallback((file: File | Blob, url: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    objectUrlRef.current = url
    setImageFile(file)
    setImageUrl(url)
    setOcrResult(null)
    setMetrics(null)
    setSelectedBoxId(null)
    setServerError(null)
  }, [])

  // Test backend connectivity (/api/health)
  const handleTestConnection = useCallback(async () => {
    setServerStatus('checking')
    setServerError(null)

    if (testAbortControllerRef.current) {
      testAbortControllerRef.current.abort()
    }
    const testController = new AbortController()
    testAbortControllerRef.current = testController

    const cleanUrl = apiUrl.trim().replace(/\/$/, '')
    const timer = setTimeout(() => testController.abort('Health-check timeout (4 detik)'), 4000)

    try {
      const res = await fetch(`${cleanUrl}/api/health`, {
        signal: testController.signal,
      })
      if (res.ok) {
        setServerStatus('online')
        setServerError(null)
      } else {
        setServerStatus('offline')
        setServerError(`HTTP ${res.status}: ${res.statusText}`)
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setServerStatus('offline')
      const msg = err instanceof Error ? err.message : String(err)
      setServerError(`Gagal terhubung: ${msg}. Pastikan FastAPI uvicorn berjalan di port 8000.`)
    } finally {
      clearTimeout(timer)
      testAbortControllerRef.current = null
    }
  }, [apiUrl])

  // Run RapidOCR extraction
  const handleRunOcr = useCallback(async () => {
    if (!imageFile) return

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Timeout protection: abort after 30 seconds if backend freezes
    const timeoutId = setTimeout(() => {
      controller.abort('Timeout eksekusi OCR (30 detik)')
    }, 30000)

    setIsProcessing(true)
    setServerError(null)
    const cleanUrl = apiUrl.trim().replace(/\/$/, '')

    try {
      const formData = new FormData()
      formData.append('file', imageFile, 'ktp-image.jpg')

      const res = await fetch(`${cleanUrl}/api/v1/ocr/extract-ktp`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        const detail = errorData?.detail || `HTTP ${res.status}: ${res.statusText}`
        throw new Error(detail)
      }

      const data: RapidBackendRawResponse = await res.json()
      const parsed = parseRapidOcrResponse({
        boxes: data.boxes,
        txts: data.txts,
        scores: data.scores,
        raw_text: data.raw_text,
      })

      setOcrResult(parsed)
      setMetrics({
        detMs: data.det_ms ?? 0,
        recMs: data.rec_ms ?? 0,
        totalMs: data.total_ms ?? 0,
      })
      setServerStatus('online')
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (controller.signal.reason === 'Timeout eksekusi OCR (30 detik)') {
          setServerError('Ekstraksi gagal: Batas waktu permintaan habis (timeout 30 detik).')
        }
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setServerError(`Ekstraksi gagal: ${msg}`)
    } finally {
      clearTimeout(timeoutId)
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [apiUrl, imageFile])

  // Reset workspace
  const handleResetAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setImageFile(null)
    setImageUrl(null)
    setOcrResult(null)
    setMetrics(null)
    setSelectedBoxId(null)
    setServerError(null)
  }, [])

  // Update KtpData from form edits
  const handleUpdateKtpData = useCallback(
    (updated: KtpData) => {
      if (!ocrResult) return
      setOcrResult({
        ...ocrResult,
        ktpData: updated,
        standardJson: {
          ...ocrResult.standardJson,
          nik: updated.nik,
          nama: updated.nama,
          tempat_lahir: updated.tempatLahir,
          tanggal_lahir: updated.tanggalLahir,
          jenis_kelamin: updated.jenisKelamin,
          alamat: {
            jalan: updated.alamat,
            rt_rw: updated.rtRw,
            kel_desa: updated.kelDesa,
            kecamatan: updated.kecamatan,
          },
          agama: updated.agama,
          status_perkawinan: updated.statusPerkawinan,
          pekerjaan: updated.pekerjaan,
          kewarganegaraan: updated.kewarganegaraan,
        },
      })
    },
    [ocrResult]
  )

  // Zero-leak teardown on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (testAbortControllerRef.current) {
        testAbortControllerRef.current.abort()
      }
    }
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
            <div className="w-6 h-6 rounded-md bg-linear-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight shrink-0">
              RapidOCR Backend (FastAPI)
            </span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              High-Speed API
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs">
            <Server className="w-3.5 h-3.5" />
            <span>FastAPI + C++ ONNXRuntime</span>
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
        {/* Column 1: Control & API Panel */}
        <RapidControlPanel
          onImageSelected={handleImageSelected}
          hasImage={Boolean(imageUrl)}
          isProcessing={isProcessing}
          apiUrl={apiUrl}
          onApiUrlChange={handleApiUrlChange}
          serverStatus={serverStatus}
          serverError={serverError}
          onTestConnection={handleTestConnection}
          onRunOcr={handleRunOcr}
          onReset={handleResetAll}
        />

        {/* Column 2: Center Interactive Image & Bounding Box Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm">
          <InteractiveBoundingCanvas
            imageUrl={imageUrl}
            boxes={ocrResult?.annotatedBoxes ?? []}
            selectedBoxId={selectedBoxId}
            onSelectBox={(box: BoundingBox | null) => setSelectedBoxId(box?.id ?? null)}
            isProcessing={isProcessing}
          />
        </div>

        {/* Column 3: Results Panel (Tabs: Structured JSON, Raw Text, Form Auto-Fill) */}
        <RapidResultsPanel
          result={ocrResult}
          metrics={metrics}
          isProcessing={isProcessing}
          onUpdateKtpData={handleUpdateKtpData}
        />
      </main>
    </div>
  )
}
