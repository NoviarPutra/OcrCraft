import { useState } from 'react'
import {
  Columns,
  Eye,
  ImageIcon,
  Split,
} from 'lucide-react'
import type { PreprocessMode } from '../../types/ktp'

interface VisualCanvasPanelProps {
  originalImageUrl: string | null
  previewCanvasUrl: string | null
  dimensions: { width: number; height: number } | null
  mode: PreprocessMode
  rotation: number
}

export function VisualCanvasPanel({
  originalImageUrl,
  previewCanvasUrl,
  dimensions,
  mode,
  rotation,
}: VisualCanvasPanelProps) {
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('side-by-side')
  const [activeSingleTab, setActiveSingleTab] = useState<'before' | 'after'>('after')

  return (
    <section
      role="region"
      aria-label="Perbandingan Visual Canvas"
      className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-lg flex flex-col h-full min-h-0"
    >
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider truncate">
            Visual Canvas
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {dimensions && (
            <span className="text-[10px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {dimensions.width} × {dimensions.height}
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            Kolom 2 / 3
          </span>
        </div>
      </div>

      {/* Mode Status Bar & View Mode Switcher */}
      <div className="flex items-center justify-between gap-2 py-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 min-w-0">
          <span className="font-semibold text-indigo-400 truncate">
            {mode === 'enhanced-grayscale'
              ? 'Grayscale'
              : mode === 'original-color'
                ? 'Color'
                : mode === 'adaptive-threshold'
                  ? 'Adaptive'
                  : 'Manual Global'}
          </span>
          {rotation !== 0 && (
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
              {rotation}°
            </span>
          )}
        </div>

        {originalImageUrl && (
          <div className="flex items-center rounded-lg bg-slate-950/80 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('side-by-side')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                viewMode === 'side-by-side'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Berdampingan</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Split className="w-3 h-3" />
              <span>Tab Tunggal</span>
            </button>
          </div>
        )}
      </div>

      {/* Visual Canvas Display Area */}
      <div className="flex-1 min-h-0 flex flex-col justify-center bg-slate-950/50 rounded-xl border border-slate-800/80 p-2 overflow-hidden">
        {!originalImageUrl ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2 h-full">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-600">
              <ImageIcon className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-400">
              Kanvas Visual Belum Tersedia
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              Unggah foto KTP atau gunakan tombol Muat Sampel di Kolom 1 untuk melihat perbandingan canvas.
            </p>
          </div>
        ) : viewMode === 'side-by-side' ? (
          /* Side-by-Side: Before vs After */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full h-full min-h-0">
            {/* Before Canvas */}
            <div className="flex flex-col h-full min-h-0 bg-slate-950/70 rounded-lg p-2 border border-slate-800/60 overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-900 shrink-0">
                <span className="font-semibold text-slate-300">Before: Foto KTP Asli</span>
                <span className="text-[9px] text-slate-500">Kamera / File</span>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center p-1 overflow-hidden">
                <img
                  data-testid="original-image-preview"
                  src={originalImageUrl}
                  alt="Foto KTP Asli"
                  className="max-h-full max-w-full object-contain rounded"
                />
              </div>
            </div>

            {/* After Canvas */}
            <div className="flex flex-col h-full min-h-0 bg-slate-950/70 rounded-lg p-2 border border-slate-800/60 overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-900 shrink-0">
                <span className="font-semibold text-indigo-300">After: Preprocessed Canvas</span>
                <span className="text-[9px] text-emerald-400 font-mono">WASM Input</span>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center p-1 overflow-hidden">
                {previewCanvasUrl ? (
                  <img
                    data-testid="preview-canvas-image"
                    src={previewCanvasUrl}
                    alt="Hasil Preprocessed Canvas KTP"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                ) : (
                  <span className="text-xs text-slate-500">Merender canvas...</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Single Tab View */
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div className="flex items-center gap-1 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSingleTab('before')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  activeSingleTab === 'before'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                Before (Asli)
              </button>
              <button
                type="button"
                onClick={() => setActiveSingleTab('after')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  activeSingleTab === 'after'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                After (Preprocessed Canvas)
              </button>
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center p-2 bg-slate-950/70 rounded-lg border border-slate-800/60 overflow-hidden">
              {activeSingleTab === 'before' ? (
                <img
                  data-testid="original-image-preview"
                  src={originalImageUrl}
                  alt="Foto KTP Asli"
                  className="max-h-full max-w-full object-contain rounded"
                />
              ) : previewCanvasUrl ? (
                <img
                  data-testid="preview-canvas-image"
                  src={previewCanvasUrl}
                  alt="Hasil Preprocessed Canvas KTP"
                  className="max-h-full max-w-full object-contain rounded"
                />
              ) : (
                <span className="text-xs text-slate-500">Merender canvas...</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
