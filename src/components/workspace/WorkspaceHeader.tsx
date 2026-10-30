import { useState, useEffect, type ReactNode } from 'react'
import {
  ArrowLeft,
  Cpu,
  HelpCircle,
  Lock,
  RotateCcw,
  Scan,
  ShieldCheck,
  X,
} from 'lucide-react'

export interface WorkspaceHeaderProps {
  onBackToHub: () => void
  title?: string
  subtitle?: string
  badgeText?: string
  badgeVariant?: 'indigo' | 'emerald' | 'cyan' | 'purple' | 'amber'
  icon?: ReactNode
  iconGradient?: string
  statusSlot?: ReactNode
  actionsSlot?: ReactNode
  onResetAll?: () => void
  hasImage?: boolean
  canReset?: boolean
  isProcessing?: boolean
  helpTitle?: string
  helpDescription?: string
  helpTips?: string[]
}

const BADGE_STYLES: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
}

export function WorkspaceHeader({
  onBackToHub,
  title = 'Client-Side KTP OCR & JSON Extractor',
  subtitle,
  badgeText = 'v1.0 Stable',
  badgeVariant = 'emerald',
  icon,
  iconGradient = 'from-indigo-600 to-blue-500',
  statusSlot,
  actionsSlot,
  onResetAll,
  hasImage = false,
  canReset,
  isProcessing = false,
  helpTitle = 'Bantuan Workspace Demo OCR',
  helpDescription = 'Ekstraksi identitas e-KTP berjalan 100% di browser Anda dengan standar keamanan sandbox tinggi.',
  helpTips = [
    'Pastikan foto e-KTP tegak lurus, pencahayaan merata, dan tidak buram.',
    'Fitur Canvas Preprocessing & Chroma-Bleaching membantu menghilangkan watermark background.',
    'Gunakan tombol Reset untuk membersihkan memori canvas sebelum mengunggah gambar baru.',
  ],
}: WorkspaceHeaderProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  // Close modal on Escape key
  useEffect(() => {
    if (!isHelpOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsHelpOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHelpOpen])

  const showReset = Boolean(onResetAll && (canReset ?? hasImage))
  const badgeClass = BADGE_STYLES[badgeVariant] || BADGE_STYLES.emerald

  return (
    <>
      <header className="h-14 shrink-0 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between gap-2.5 sm:gap-3 z-30">
        {/* Left: Back to Hub + Active Demo Title & Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          {/* Tombol Kembali ke Hub */}
          <button
            type="button"
            data-testid="back-to-hub-btn"
            onClick={onBackToHub}
            disabled={isProcessing}
            aria-label="Kembali ke Demo Hub"
            title="Kembali ke Demo Hub (Ganti Versi)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 text-slate-300 group-hover:text-white shrink-0" />
            <span className="hidden sm:inline">← Ganti Versi Demo</span>
            <span className="sm:hidden text-[11px]">← Ganti</span>
            <span className="sr-only">Pilih Versi Demo</span>
          </button>

          <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

          {/* Icon, Title, & Version Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-6 h-6 rounded-md bg-linear-to-tr ${iconGradient} flex items-center justify-center text-white shadow-xs shrink-0`}
            >
              {icon || <Scan className="w-3.5 h-3.5" />}
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-400 tracking-tight shrink-0 hidden xl:inline">
                OcrCraft Studio
              </span>
              <span className="text-slate-600 shrink-0 hidden xl:inline">/</span>

              <h1 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                {title}
              </h1>
            </div>

            {badgeText && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 hidden md:inline-flex ${badgeClass}`}
              >
                {badgeText}
              </span>
            )}
          </div>
        </div>

        {/* Right: Status Indicators, Help/Settings, & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {statusSlot ? (
            statusSlot
          ) : (
            <>
              {/* Default Privacy Indicator */}
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs">
                <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-medium">100% Client-Side Private</span>
              </div>

              {/* Default WASM Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="text-[11px] font-medium">WASM Engine Ready</span>
              </div>
            </>
          )}

          {/* Quick Help Button */}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="Petunjuk & Informasi Workspace"
            title="Petunjuk & Informasi Workspace"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/70 hover:border-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Custom Actions Slot (e.g., Settings button) */}
          {actionsSlot}

          {/* Reset Workspace Button */}
          {showReset && (
            <button
              type="button"
              data-testid="reset-all-btn"
              onClick={onResetAll}
              disabled={isProcessing}
              aria-label="Reset semua proses dan data"
              title="Bersihkan input & hasil untuk scan baru"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </header>

      {/* Quick Help Dialog Modal */}
      {isHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-help-title"
            aria-describedby="workspace-help-desc"
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="workspace-help-title"
                    className="text-sm sm:text-base font-bold text-slate-100 tracking-tight"
                  >
                    {helpTitle}
                  </h2>
                  {subtitle && (
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                aria-label="Tutup petunjuk"
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-3 text-xs text-slate-300 leading-relaxed">
              <p
                id="workspace-help-desc"
                className="text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80"
              >
                {helpDescription}
              </p>

              {helpTips && helpTips.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                    Tips &amp; Praktik Terbaik
                  </span>
                  <ul className="flex flex-col gap-1.5 pl-4 list-disc text-slate-400 text-xs">
                    {helpTips.map((tip, idx) => (
                      <li key={idx} className="leading-normal">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
