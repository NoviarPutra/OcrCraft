import { Server, Zap } from 'lucide-react'
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
import { WorkspaceHeader } from '../WorkspaceHeader'

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
      <WorkspaceHeader
        onBackToHub={onBackToHub}
        title="RapidOCR Backend (FastAPI)"
        subtitle="High-Speed ONNX C++ Pipeline with Sub-150ms Profile"
        badgeText="High-Speed API"
        badgeVariant="cyan"
        icon={<Zap className="w-3.5 h-3.5" />}
        iconGradient="from-cyan-600 to-teal-500"
        isProcessing={isProcessing}
        canReset={Boolean(imageUrl)}
        onResetAll={handleResetAll}
        statusSlot={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs">
              <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-medium">FastAPI + C++ ONNX</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverStatus === 'online'
                    ? 'bg-emerald-400'
                    : serverStatus === 'checking'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-400'
                }`}
              />
              <span className="text-slate-300 font-medium hidden sm:inline text-[11px]">
                {serverStatus === 'online'
                  ? 'Backend Live'
                  : serverStatus === 'checking'
                    ? 'Menghubungkan...'
                    : 'Backend Offline'}
              </span>
            </div>
          </div>
        }
        helpTitle="Panduan RapidOCR Backend Studio"
        helpDescription="Microservice ekstraksi e-KTP berbasis Python FastAPI dengan engine RapidOCR (C++ ONNXRuntime) untuk performa inferensi berkecepatan tinggi."
        helpTips={[
          'Pastikan backend lokal berjalan di http://localhost:8000 via perintah npm run dev:all.',
          'Endpoint menerima unggahan gambar multipart/form-data dan mengembalikan koordinat bounding box, confidence score, dan teks hasil ekstraksi.',
          'Sistem secara otomatis mengoreksi kesalahan ketik angka/huruf umum pada nomor NIK dan memvalidasi tanggal lahir.',
          'Visualisasi bounding box interaktif memetakan setiap kata langsung pada canvas e-KTP.',
        ]}
      />

      {/* 3-Column Single Screen Viewport Container */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
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
