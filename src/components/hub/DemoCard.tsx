import React from "react";
import { ArrowRight, Brain, Clock, Cloud, FileText, Layers, Zap } from "lucide-react";
import type { DemoVersionItem } from "../../demos/registry";

interface DemoCardProps {
  item: DemoVersionItem;
  onSelect: (demoId: string) => void;
  className?: string;
}

interface EngineVisualConfig {
  icon: React.ReactNode;
  iconBg: string;
  statusBadge: string;
  cardBorderHover: string;
  buttonBg: string;
}

function getEngineConfig(demoId: string): EngineVisualConfig {
  switch (demoId) {
    case "client-side-tesseract":
      return {
        icon: <FileText className='w-5 h-5 text-emerald-400' />,
        iconBg: "bg-emerald-500/10 border-emerald-500/20",
        statusBadge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        cardBorderHover: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
        buttonBg: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25",
      };
    case "byok-vision-ocr":
      return {
        icon: <Cloud className='w-5 h-5 text-blue-400' />,
        iconBg: "bg-blue-500/10 border-blue-500/20",
        statusBadge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        cardBorderHover: "hover:border-blue-500/50 hover:shadow-blue-500/10",
        buttonBg: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25",
      };
    case "paddleocr-onnx":
      return {
        icon: <Brain className='w-5 h-5 text-purple-400' />,
        iconBg: "bg-purple-500/10 border-purple-500/20",
        statusBadge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
        cardBorderHover: "hover:border-purple-500/50 hover:shadow-purple-500/10",
        buttonBg: "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25",
      };
    case "rapidocr-fastapi":
      return {
        icon: <Zap className='w-5 h-5 text-cyan-400' />,
        iconBg: "bg-cyan-500/10 border-cyan-500/20",
        statusBadge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        cardBorderHover: "hover:border-cyan-500/50 hover:shadow-cyan-500/10",
        buttonBg: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/25",
      };
    default:
      return {
        icon: <Layers className='w-5 h-5 text-slate-400' />,
        iconBg: "bg-slate-800 text-slate-400 border-slate-700",
        statusBadge: "bg-slate-800 text-slate-400 border-slate-700",
        cardBorderHover: "hover:border-slate-700",
        buttonBg: "bg-slate-800/80 text-slate-500 cursor-not-allowed",
      };
  }
}

export function DemoCard({ item, onSelect, className = "" }: DemoCardProps) {
  const isReady = item.isAvailable;
  const config = getEngineConfig(item.id);
  const capabilities = item.keyCapabilities ?? [];

  // Dedicated layout for non-available / roadmap version spanning full width
  if (!isReady) {
    return (
      <div
        data-testid={`demo-card-${item.id}`}
        role='region'
        tabIndex={-1}
        aria-disabled='true'
        className={`relative flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-2xl p-5 sm:p-6 transition-all duration-200 border border-dashed border-slate-800 bg-slate-900/30 text-left ${className}`}>
        <div className='flex items-start gap-4'>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${config.iconBg}`}>
            {config.icon}
          </div>
          <div>
            <div className='flex items-center gap-2.5 flex-wrap'>
              <h3 className='text-base sm:text-lg font-bold text-slate-300 tracking-tight'>
                {item.title}
              </h3>
              <span className='text-xs font-mono font-medium text-slate-500 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50'>
                {item.version}
              </span>
              <span className='text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-slate-700'>
                {item.badge}
              </span>
            </div>
            <p className='mt-1.5 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed'>
              {item.description}
            </p>
            <div className='flex flex-wrap gap-1.5 mt-3'>
              {capabilities.map((capability) => (
                <span
                  key={capability}
                  className='px-2.5 py-0.5 text-[11px] font-medium rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/40'>
                  {capability}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className='shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60'>
          <button
            type='button'
            disabled
            className='w-full md:w-auto min-h-11 h-11 px-5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 bg-slate-800/60 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-80'>
            <Clock className='w-4 h-4 text-slate-400' />
            <span>Segera Hadir</span>
          </button>
        </div>
      </div>
    );
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    // Allows keyboard activation on the card container if focused
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSelect(item.id);
    }
  };

  return (
    <article
      data-testid={`demo-card-${item.id}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-disabled='false'
      className={`group relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 transition-all duration-200 border text-left bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/90 shadow-sm hover:shadow-xl cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 focus:outline-none ${config.cardBorderHover} ${className}`}>
      {/* Top Header: Icon & Status Badge */}
      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between gap-3'>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${config.iconBg}`}>
            {config.icon}
          </div>
          <div className='flex items-center gap-2'>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${config.statusBadge}`}>
              {item.badge}
            </span>
          </div>
        </div>

        {/* Title & Version */}
        <div>
          <div className='flex items-baseline justify-between gap-2'>
            <h3 className='text-base sm:text-lg font-bold text-slate-100 group-hover:text-white transition-colors tracking-tight'>
              {item.title}
            </h3>
            <span className='text-xs font-mono font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 shrink-0'>
              {item.version}
            </span>
          </div>

          {/* Description */}
          <p className='mt-2.5 text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-3'>
            {item.description}
          </p>
        </div>

        {/* Key Capabilities Pills */}
        <div className='flex flex-wrap gap-1.5 pt-1'>
          {capabilities.map((capability) => (
            <span
              key={capability}
              className='px-2.5 py-0.5 text-[11px] font-medium rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/50'>
              {capability}
            </span>
          ))}
        </div>
      </div>

      {/* Action Button Footer */}
      <div className='mt-6 pt-4 border-t border-slate-800/60'>
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.id);
          }}
          aria-label={`Coba Demo ${item.title}`}
          className={`w-full min-h-11 h-11 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-sm focus:outline-none ${config.buttonBg}`}>
          <span>Coba Demo</span>
          <ArrowRight className='w-4 h-4 transition-transform group-hover:translate-x-1' />
        </button>
      </div>
    </article>
  );
}
