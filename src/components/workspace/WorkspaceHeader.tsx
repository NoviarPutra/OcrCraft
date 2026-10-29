import {
  ArrowLeft,
  Cpu,
  Lock,
  RotateCcw,
  Scan,
} from 'lucide-react'

interface WorkspaceHeaderProps {
  onBackToHub: () => void
  onResetAll: () => void
  hasImage: boolean
  isProcessing: boolean
}

export function WorkspaceHeader({
  onBackToHub,
  onResetAll,
  hasImage,
  isProcessing,
}: WorkspaceHeaderProps) {
  return (
    <header className="h-13 shrink-0 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between gap-3 z-30">
      {/* Left: Back to Hub + Studio Branding & Workspace Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          data-testid="back-to-hub-btn"
          onClick={onBackToHub}
          disabled={isProcessing}
          aria-label="Kembali ke Demo Hub"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>← Pilih Versi Demo</span>
        </button>

        <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <Scan className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight shrink-0">
            OcrCraft Studio
          </span>

          <span className="text-slate-600 shrink-0">/</span>

          <h1 className="text-xs font-semibold text-indigo-300 tracking-tight truncate">
            Client-Side KTP OCR &amp; JSON Extractor
          </h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0 hidden lg:inline-flex">
            v1.0 Stable
          </span>
        </div>
      </div>

      {/* Right: Engine badges & Reset Button */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-md border border-slate-800">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Zero Data Transfer</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-md border border-slate-800">
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span>Tesseract.js WASM</span>
        </div>

        {hasImage && (
          <button
            type="button"
            data-testid="reset-all-btn"
            onClick={onResetAll}
            disabled={isProcessing}
            aria-label="Reset semua proses dan data"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </header>
  )
}
