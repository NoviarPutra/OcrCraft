import {
  Check,
  Clock,
  Code2,
  Copy,
  Cpu,
  FileCheck2,
  FileText,
  Loader2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import type { KtpData, KtpExtractionResult } from '../../../types/ktp'
import type { RapidKtpParseResult } from '../../../utils/rapidKtpParser'
import { AutoFillFormPanel } from '../../AutoFillFormPanel'

export interface RapidResultsPanelProps {
  result: RapidKtpParseResult | null
  metrics: {
    detMs: number
    recMs: number
    totalMs: number
  } | null
  isProcessing: boolean
  onUpdateKtpData: (data: KtpData) => void
}

export function RapidResultsPanel({
  result,
  metrics,
  isProcessing,
  onUpdateKtpData,
}: RapidResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<'json' | 'raw' | 'form'>('json')
  const [isCopiedJson, setIsCopiedJson] = useState(false)
  const [isCopiedRaw, setIsCopiedRaw] = useState(false)

  const handleCopyJson = async () => {
    if (!result) return
    try {
      const payload = {
        data: result.standardJson,
        metrics: metrics ?? {
          detMs: 0,
          recMs: 0,
          totalMs: 0,
        },
        boxesCount: result.annotatedBoxes.length,
        confidence: result.confidence,
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setIsCopiedJson(true)
      setTimeout(() => setIsCopiedJson(false), 2000)
    } catch {
      setIsCopiedJson(false)
    }
  }

  const handleCopyRaw = async () => {
    if (!result?.rawText) return
    try {
      await navigator.clipboard.writeText(result.rawText)
      setIsCopiedRaw(true)
      setTimeout(() => setIsCopiedRaw(false), 2000)
    } catch {
      setIsCopiedRaw(false)
    }
  }

  // Construct KtpExtractionResult wrapper for AutoFillFormPanel
  const formResult: KtpExtractionResult | null = result
    ? {
        meta: {
          confidence: result.confidence,
          processingTimeMs: metrics?.totalMs ?? 0,
          nikValid:
            result.standardJson.nik.length === 16 &&
            /^\d{16}$/.test(result.standardJson.nik),
        },
        data: result.ktpData,
        rawText: result.rawText,
      }
    : null

  return (
    <div className="w-full lg:w-96 xl:w-[28rem] shrink-0 flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm">
      {/* Tab Navigation Header */}
      <div className="h-11 shrink-0 px-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Structured JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Raw OCR Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Form Auto-Fill</span>
          </button>
        </div>

        {/* Copy Button for current tab */}
        {result && activeTab === 'json' && (
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            {isCopiedJson ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Salin</span>
              </>
            )}
          </button>
        )}

        {result && activeTab === 'raw' && (
          <button
            type="button"
            onClick={handleCopyRaw}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            {isCopiedRaw ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Salin</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Latency Metrics Sub-bar (Visible if metrics present) */}
      {metrics && (
        <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Total:</span>
              <strong className="text-cyan-300 font-semibold">{metrics.totalMs} ms</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-slate-400" />
              <span>Det: {metrics.detMs}ms</span>
            </span>
            <span className="flex items-center gap-1">
              <span>Rec: {metrics.recMs}ms</span>
            </span>
          </div>

          {result && (
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-sm border border-emerald-500/20">
              {result.annotatedBoxes.length} Boxes ({result.confidence}%)
            </span>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs z-10 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-200">
              Menjalankan Ekstraksi RapidOCR...
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              PaddleOCR C++ / ONNXRuntime via FastAPI
            </p>
          </div>
        )}

        {!result && !isProcessing && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Zap className="w-9 h-9 text-slate-600 mb-3" />
            <p className="text-xs font-medium text-slate-300">
              Belum Ada Data Hasil Ekstraksi
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[240px]">
              Pilih foto e-KTP dan klik tombol &quot;Jalankan Ekstraksi RapidOCR&quot; untuk memulai.
            </p>
          </div>
        )}

        {result && (
          <>
            {/* Tab: Structured JSON */}
            {activeTab === 'json' && (
              <div className="flex-1 overflow-auto p-3 font-mono text-[11px] text-slate-300">
                <pre className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-emerald-300/95 overflow-x-auto">
                  {JSON.stringify(result.standardJson, null, 2)}
                </pre>
              </div>
            )}

            {/* Tab: Raw OCR Text */}
            {activeTab === 'raw' && (
              <div className="flex-1 overflow-auto p-3 font-mono text-xs text-slate-300 flex flex-col gap-2">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col gap-1.5 whitespace-pre-wrap">
                  {result.rawText || (
                    <span className="text-slate-500 italic">Teks mentah kosong</span>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Form Auto-Fill */}
            {activeTab === 'form' && (
              <div className="flex-1 overflow-auto p-3">
                <AutoFillFormPanel result={formResult} onUpdateData={onUpdateKtpData} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
