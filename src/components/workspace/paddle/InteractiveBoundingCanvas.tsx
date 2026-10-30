import { Eye, EyeOff, Info, Maximize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { BoundingBox } from '../../../types/paddleOcr'

interface InteractiveBoundingCanvasProps {
  imageUrl: string | null
  boxes: BoundingBox[]
  selectedBoxId: string | null
  onSelectBox: (box: BoundingBox | null) => void
  isProcessing: boolean
}

export function InteractiveBoundingCanvas({
  imageUrl,
  boxes,
  selectedBoxId,
  onSelectBox,
  isProcessing,
}: InteractiveBoundingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [showBoxes, setShowBoxes] = useState(true)
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null)
  const [naturalDimensions, setNaturalDimensions] = useState<{ w: number; h: number } | null>(null)
  const [displayedDimensions, setDisplayedDimensions] = useState<{
    w: number
    h: number
    offsetX: number
    offsetY: number
  }>({ w: 0, h: 0, offsetX: 0, offsetY: 0 })


  // Calculate rendered image position inside container to scale overlay boxes exactly
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      if (!container || !naturalDimensions) return

      const cW = container.clientWidth
      const cH = container.clientHeight
      if (cW <= 0 || cH <= 0) return

      const imgAspect = naturalDimensions.w / naturalDimensions.h
      const containerAspect = cW / cH

      let renderW = 0
      let renderH = 0
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > containerAspect) {
        renderW = cW
        renderH = cW / imgAspect
        offsetY = (cH - renderH) / 2
      } else {
        renderH = cH
        renderW = cH * imgAspect
        offsetX = (cW - renderW) / 2
      }

      setDisplayedDimensions({
        w: renderW,
        h: renderH,
        offsetX,
        offsetY,
      })
    }

    updateDimensions()
    const ro = new ResizeObserver(updateDimensions)
    ro.observe(container)
    return () => ro.disconnect()
  }, [naturalDimensions])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget
    setNaturalDimensions({ w: target.naturalWidth, h: target.naturalHeight })
  }

  // Active box for tooltip display
  const activeBoxId = hoveredBoxId ?? selectedBoxId
  const activeBox = boxes.find((b) => b.id === activeBoxId)

  const getBoxColorClasses = (confidence: number, isCurrent: boolean) => {
    if (isCurrent) {
      return 'border-indigo-400 bg-indigo-500/30 text-white ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-950 z-20 shadow-lg'
    }
    if (confidence >= 0.85) {
      return 'border-emerald-500/80 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/30 hover:border-emerald-400'
    }
    if (confidence >= 0.6) {
      return 'border-amber-500/80 bg-amber-500/15 text-amber-200 hover:bg-amber-500/30 hover:border-amber-400'
    }
    return 'border-rose-500/80 bg-rose-500/15 text-rose-200 hover:bg-rose-500/30 hover:border-rose-400'
  }

  const effectiveNatural = imageUrl ? naturalDimensions : null
  const effectiveDisplayed = imageUrl
    ? displayedDimensions
    : { w: 0, h: 0, offsetX: 0, offsetY: 0 }

  const scaleFactorX =
    effectiveNatural && effectiveDisplayed.w > 0
      ? effectiveDisplayed.w / effectiveNatural.w
      : 1
  const scaleFactorY =
    effectiveNatural && effectiveDisplayed.h > 0
      ? effectiveDisplayed.h / effectiveNatural.h
      : 1
  return (
    <div className="flex-1 flex flex-col bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden relative shadow-inner">
      {/* Canvas Toolbar */}
      <div className="h-11 shrink-0 px-4 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between z-10 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">
            Interactive Canvas Overlay
          </span>
          {boxes.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {boxes.length} Kotak Teks
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 mr-2">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/80" />
              ≥85%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/80" />
              60-84%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/80" />
              &lt;60%
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowBoxes((prev) => !prev)}
            disabled={boxes.length === 0}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              showBoxes
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-400'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {showBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showBoxes ? 'Sembunyikan Kotak' : 'Tampilkan Kotak'}</span>
          </button>
        </div>
      </div>

      {/* Main Visual Display Area */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center p-3 overflow-hidden select-none"
      >
        {!imageUrl ? (
          <div className="flex flex-col items-center justify-center text-center p-6 text-slate-500 max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-3 text-slate-600">
              <Maximize2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-400">Belum ada gambar KTP</p>
            <p className="text-xs text-slate-600 mt-1">
              Pilih foto KTP atau gunakan tombol sample di panel kontrol sebelah kiri.
            </p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Base KTP Image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="KTP Source"
              onLoad={handleImageLoad}
              className="max-w-full max-h-full object-contain pointer-events-none rounded-lg shadow-2xl"
            />

            {/* Bounding Boxes Overlay */}
            {showBoxes &&
              naturalDimensions &&
              displayedDimensions.w > 0 &&
              boxes.map((box) => {
                const isCurrent = box.id === activeBoxId
                const boxLeft = displayedDimensions.offsetX + box.x * scaleFactorX
                const boxTop = displayedDimensions.offsetY + box.y * scaleFactorY
                const boxWidth = Math.max(12, box.w * scaleFactorX)
                const boxHeight = Math.max(10, box.h * scaleFactorY)

                return (
                  <div
                    key={box.id}
                    onClick={() => onSelectBox(isCurrent ? null : box)}
                    onMouseEnter={() => setHoveredBoxId(box.id)}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    style={{
                      left: `${boxLeft}px`,
                      top: `${boxTop}px`,
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                    }}
                    className={`absolute border rounded-xs transition-all duration-150 cursor-pointer pointer-events-auto ${getBoxColorClasses(
                      box.confidence,
                      isCurrent
                    )}`}
                    title={`${box.text || '(Belum terbaca)'} (${Math.round(box.confidence * 100)}%)`}
                  />
                )
              })}

            {/* Floating Active Tooltip */}
            {activeBox && displayedDimensions.w > 0 && (
              <div
                style={{
                  left: `${Math.min(
                    displayedDimensions.offsetX + displayedDimensions.w - 180,
                    Math.max(
                      displayedDimensions.offsetX + 8,
                      displayedDimensions.offsetX + activeBox.x * scaleFactorX
                    )
                  )}px`,
                  top: `${Math.max(
                    displayedDimensions.offsetY + 8,
                    displayedDimensions.offsetY + activeBox.y * scaleFactorY - 38
                  )}px`,
                }}
                className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-900/95 text-white text-xs border border-indigo-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-xs animate-in fade-in zoom-in-95 duration-100"
              >
                <span className="font-semibold text-indigo-300 truncate">
                  {activeBox.text || '(Teks terdeteksi)'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 shrink-0">
                  {Math.round(activeBox.confidence * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-40">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl">
              <span className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold text-slate-200">
                Memproses Inferensi Neural...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="h-8 shrink-0 px-4 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Arahkan kursor atau klik kotak deteksi untuk melihat teks dan highlight field.</span>
        </div>
        {activeBox?.matchedField && (
          <span className="text-indigo-400 font-mono text-[10px] shrink-0 font-medium">
            Field: {activeBox.matchedField}
          </span>
        )}
      </div>
    </div>
  )
}
