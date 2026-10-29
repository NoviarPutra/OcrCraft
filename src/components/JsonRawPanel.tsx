import {
  Check,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  FileText,
  Percent,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import type { KtpExtractionResult } from '../types/ktp'

interface JsonRawPanelProps {
  result: KtpExtractionResult | null
  isProcessing: boolean
}

export function JsonRawPanel({ result, isProcessing }: JsonRawPanelProps) {
  const [activeTab, setActiveTab] = useState<'json' | 'raw'>('json')
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setIsCopied(false)
    }
  }

  const jsonString = result ? JSON.stringify(result, null, 2) : ''

  // Penentuan warna badge confidence
  const confidenceScore = result?.meta.confidence ?? 0
  const confidenceColor =
    confidenceScore >= 80
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      : confidenceScore >= 60
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        : 'bg-red-500/10 text-red-300 border-red-500/30'

  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Panel 2
          </span>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-400" />
            Hasil JSON & Raw Text
          </h2>
        </div>

        {/* Tab Switcher & Copy Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'json'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Structured JSON
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Raw OCR Text
            </button>
          </div>

          {result && (
            <button
              type="button"
              onClick={() => handleCopy(activeTab === 'json' ? jsonString : result.rawText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin {activeTab === 'json' ? 'JSON' : 'Teks'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Meta Indicators: Confidence, Processing Time, NIK Valid */}
      {result ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Confidence Score */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${confidenceColor}`}
          >
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-80">
                  OCR Confidence
                </span>
                <span className="text-sm font-mono font-bold">{confidenceScore}%</span>
              </div>
            </div>
            <span className="text-[11px] font-medium opacity-90">
              {confidenceScore >= 80 ? 'Tinggi' : confidenceScore >= 60 ? 'Sedang' : 'Rendah'}
            </span>
          </div>

          {/* Processing Time */}
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Waktu Eksekusi
                </span>
                <span className="text-sm font-mono font-bold text-slate-100">
                  {result.meta.processingTimeMs.toLocaleString()} ms
                </span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Client WASM</span>
          </div>

          {/* NIK Valid Check */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              result.meta.nikValid
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {result.meta.nikValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-80">
                  Format NIK
                </span>
                <span className="text-sm font-mono font-bold">
                  {result.meta.nikValid ? '16 Digit Valid' : 'Belum 16 Digit'}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono">
              {result.data.nik ? `${result.data.nik.length} digit` : 'Kosong'}
            </span>
          </div>
        </div>
      ) : null}

      {/* Konten Tab: JSON vs Raw Text */}
      <div className="bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col min-h-[320px]">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center p-12 grow text-slate-400 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-sm font-medium">Sedang memproses dan mengurai teks KTP...</p>
          </div>
        ) : !result ? (
          <div className="flex flex-col items-center justify-center p-12 grow text-slate-400 gap-2">
            <Code className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">Belum ada hasil ekstraksi.</p>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              Unggah foto KTP atau gunakan Sampel KTP Demo di Panel 1, lalu klik "Ekstrak Teks &
              Data KTP".
            </p>
          </div>
        ) : activeTab === 'json' ? (
          <div className="relative p-4 font-mono text-xs overflow-x-auto max-h-[420px] select-text">
            <pre className="text-slate-300 whitespace-pre leading-relaxed">
              <code>{jsonString}</code>
            </pre>
          </div>
        ) : (
          <div className="relative p-4 font-mono text-xs overflow-x-auto max-h-[420px] select-text">
            <p className="text-[11px] font-sans text-slate-400 pb-2 mb-2 border-b border-slate-800">
              Hasil teks mentah langsung dari OCR Engine Tesseract.js:
            </p>
            <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">
              <code>{result.rawText || '(Teks mentah kosong)'}</code>
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
