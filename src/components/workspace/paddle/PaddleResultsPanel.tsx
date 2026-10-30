import {
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Cpu,
  FileCheck2,
  Table as TableIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { KtpData, KtpExtractionResult } from '../../../types/ktp'
import type { BoundingBox, ExecutionProvider, PaddleOcrResult } from '../../../types/paddleOcr'
import { AutoFillFormPanel } from '../../AutoFillFormPanel'

interface PaddleResultsPanelProps {
  ocrResult: PaddleOcrResult | null
  selectedBoxId: string | null
  onSelectBox: (box: BoundingBox | null) => void
  onUpdateKtpData: (data: KtpData) => void
  isProcessing: boolean
  provider: ExecutionProvider
}

export function PaddleResultsPanel({
  ocrResult,
  selectedBoxId,
  onSelectBox,
  onUpdateKtpData,
  isProcessing,
  provider,
}: PaddleResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<'json' | 'boxes' | 'form'>('json')
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyJson = async () => {
    if (!ocrResult) return
    try {
      const payload = {
        data: ocrResult.ktpData,
        metrics: ocrResult.metrics,
        provider: ocrResult.providerUsed,
        totalBoxes: ocrResult.boxes.length,
        rawText: ocrResult.rawText,
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setIsCopied(false)
    }
  }

  // Construct KtpExtractionResult wrapper for AutoFillFormPanel
  const formResult: KtpExtractionResult | null = ocrResult
    ? {
        meta: {
          confidence:
            ocrResult.boxes.length > 0
              ? Math.round(
                  (ocrResult.boxes.reduce((sum, b) => sum + b.confidence, 0) /
                    ocrResult.boxes.length) *
                    100
                )
              : 0,
          processingTimeMs: ocrResult.metrics.totalTimeMs,
          nikValid:
            ocrResult.ktpData.nik.length === 16 && /^\d{16}$/.test(ocrResult.ktpData.nik),
        },
        data: ocrResult.ktpData,
        rawText: ocrResult.rawText,
      }
    : null

  const getConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100)
    if (confidence >= 0.85) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          {pct}%
        </span>
      )
    }
    if (confidence >= 0.6) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
          {pct}%
        </span>
      )
    }
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30">
        {pct}%
      </span>
    )
  }

  return (
    <div className="w-full lg:w-96 xl:w-[28rem] shrink-0 flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm">
      {/* Tab Navigation Header */}
      <div className="h-11 shrink-0 px-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'json'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Structured JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('boxes')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'boxes'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Detected Boxes</span>
            {ocrResult && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                {ocrResult.boxes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'form'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Form Auto-Fill</span>
          </button>
        </div>

        {activeTab === 'json' && ocrResult && (
          <button
            type="button"
            onClick={handleCopyJson}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Salin JSON"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Latency Metrics Bar */}
      <div className="h-8 shrink-0 px-3 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>
            Det: {ocrResult ? `${ocrResult.metrics.detTimeMs}ms` : '0ms'} | Rec:{' '}
            {ocrResult ? `${ocrResult.metrics.recTimeMs}ms` : '0ms'} | Total:{' '}
            <strong className="text-indigo-400">
              {ocrResult ? `${ocrResult.metrics.totalTimeMs}ms` : '0ms'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          <Cpu className="w-3 h-3 text-slate-500" />
          <span className="uppercase text-slate-300">{provider}</span>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* TAB 1: Structured JSON */}
        {activeTab === 'json' && (
          <div className="h-full flex flex-col">
            {!ocrResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Code2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">
                  {isProcessing
                    ? 'Sedang mengekstrak teks e-KTP dengan PaddleOCR...'
                    : 'Hasil JSON e-KTP akan muncul di sini setelah ekstraksi.'}
                </p>
              </div>
            ) : (
              <pre className="flex-1 font-mono text-[11px] bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 overflow-x-auto text-slate-300 leading-relaxed shadow-inner">
                {JSON.stringify(
                  {
                    meta: {
                      engine: 'PaddleOCR ONNX Web (DBNet + CRNN/SVTR)',
                      provider: ocrResult.providerUsed,
                      metrics: ocrResult.metrics,
                      totalDetectedBoxes: ocrResult.boxes.length,
                    },
                    ktpData: ocrResult.ktpData,
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        )}

        {/* TAB 2: Detected Boxes Table */}
        {activeTab === 'boxes' && (
          <div className="h-full flex flex-col">
            {!ocrResult || ocrResult.boxes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <TableIcon className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">Daftar kotak teks hasil deteksi akan ditampilkan di sini.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {ocrResult.boxes.map((box, index) => {
                  const isCurrent = box.id === selectedBoxId
                  return (
                    <div
                      key={box.id}
                      onClick={() => onSelectBox(isCurrent ? null : box)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                          : 'bg-slate-950/40 hover:bg-slate-950/70 border-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-500">
                            #{index + 1}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {box.text || '(Belum terbaca)'}
                          </span>
                        </div>
                        {getConfidenceBadge(box.confidence)}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>
                          x:{box.x} y:{box.y} w:{box.w} h:{box.h}
                        </span>
                        {box.matchedField && (
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {box.matchedField}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Form Auto-Fill */}
        {activeTab === 'form' && (
          <div className="h-full">
            <AutoFillFormPanel result={formResult} onUpdateData={onUpdateKtpData} />
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      {ocrResult && (
        <div className="h-8 shrink-0 px-3 bg-slate-950/70 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekstraksi Selesai</span>
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            {ocrResult.boxes.length} Teks Terpetakan
          </span>
        </div>
      )}
    </div>
  )
}
