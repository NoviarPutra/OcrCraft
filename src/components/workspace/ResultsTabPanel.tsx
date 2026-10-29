import { useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  FileCheck2,
  FileText,
  XCircle,
} from 'lucide-react'
import type { KtpData, KtpExtractionResult } from '../../types/ktp'
import { AutoFillFormPanel } from '../AutoFillFormPanel'

interface ResultsTabPanelProps {
  result: KtpExtractionResult | null
  isProcessing: boolean
  onUpdateData: (updated: KtpData) => void
}

type TabKey = 'form' | 'json' | 'raw'

export function ResultsTabPanel({
  result,
  isProcessing,
  onUpdateData,
}: ResultsTabPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('form')
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setIsCopied(false)
    }
  }

  const jsonString = result ? JSON.stringify(result, null, 2) : ''
  const confidenceScore = result?.meta.confidence ?? 0
  const confidenceColor =
    confidenceScore >= 80
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      : confidenceScore >= 60
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        : 'bg-red-500/10 text-red-300 border-red-500/30'

  return (
    <section
      role="region"
      aria-label="Panel Hasil Ekstraksi"
      className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-lg flex flex-col h-full min-h-0"
    >
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
            <FileCheck2 className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider truncate">
            Hasil Ekstraksi &amp; Validasi
          </h2>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800 shrink-0">
          Kolom 3 / 3
        </span>
      </div>

      {/* Modern 3-Tab Navigation Bar */}
      <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-800/60 shrink-0" role="tablist">
        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
          {/* Tab 1: Form Auto-Fill */}
          <button
            type="button"
            role="tab"
            data-testid="tab-auto-fill"
            aria-selected={activeTab === 'form'}
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Form Auto-Fill</span>
          </button>

          {/* Tab 2: Structured JSON */}
          <button
            type="button"
            role="tab"
            data-testid="tab-json-raw"
            aria-selected={activeTab === 'json'}
            onClick={() => setActiveTab('json')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Structured JSON</span>
          </button>

          {/* Tab 3: Raw Text */}
          <button
            type="button"
            role="tab"
            data-testid="tab-raw-text"
            aria-selected={activeTab === 'raw'}
            onClick={() => setActiveTab('raw')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Raw Text</span>
          </button>
        </div>

        {/* Global Copy Button for Active View */}
        {result && activeTab !== 'form' && (
          <button
            type="button"
            onClick={() =>
              handleCopyText(activeTab === 'json' ? jsonString : result.rawText)
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 cursor-pointer shrink-0"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-[11px]">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">
                  {activeTab === 'json' ? 'Salin JSON' : 'Salin Teks'}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Tab Contents (Strictly bounded with inner localized scroll) */}
      <div className="flex-1 min-h-0 overflow-hidden pt-2 flex flex-col">
        {activeTab === 'form' && (
          <AutoFillFormPanel result={result} onUpdateData={onUpdateData} />
        )}

        {activeTab === 'json' && (
          <div className="flex flex-col h-full min-h-0 space-y-2">
            {/* Meta summary stats */}
            {result ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono border font-semibold ${confidenceColor}`}
                >
                  <span>Confidence:</span>
                  <span className="font-bold">{result.meta.confidence}%</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800 font-mono">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  <span>{result.meta.processingTimeMs} ms</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono border ${
                    result.meta.nikValid
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {result.meta.nikValid ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-amber-400" />
                  )}
                  <span>NIK 16-Digit: {result.meta.nikValid ? 'Valid' : 'Periksa'}</span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 shrink-0">
                {isProcessing
                  ? 'Sedang mengekstrak JSON dari OCR...'
                  : 'Hasil JSON akan muncul otomatis setelah proses OCR selesai.'}
              </p>
            )}

            {/* Scrollable JSON viewer */}
            <div className="flex-1 min-h-0 bg-slate-950/90 rounded-xl border border-slate-800 p-3 overflow-y-auto">
              {result ? (
                <pre className="font-mono text-xs text-indigo-200 whitespace-pre leading-relaxed select-all">
                  {jsonString}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 text-xs">
                  (Belum ada data JSON)
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="flex flex-col h-full min-h-0 space-y-2">
            {/* Meta summary stats for raw */}
            {result ? (
              <div className="flex items-center justify-between text-[11px] text-slate-400 shrink-0">
                <span className="font-mono">
                  {result.rawText.split('\n').length} baris teks terdeteksi
                </span>
                <span className="font-mono">
                  {result.rawText.length} karakter
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 shrink-0">
                {isProcessing
                  ? 'Sedang membaca teks KTP...'
                  : 'Teks mentah hasil pembacaan OCR Tesseract akan muncul di sini.'}
              </p>
            )}

            {/* Scrollable Raw Text viewer */}
            <div className="flex-1 min-h-0 bg-slate-950/90 rounded-xl border border-slate-800 p-3 overflow-y-auto">
              {result ? (
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                  {result.rawText || '(Teks kosong terdeteksi)'}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 text-xs">
                  (Belum ada data Raw Text)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
