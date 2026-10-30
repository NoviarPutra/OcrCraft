import {
  Cpu,
  Layers,
  Lock,
  Scan,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { DEMO_VERSIONS, type DemoVersionItem } from "../../demos/registry";
import { DemoCard } from "./DemoCard";
export type { DemoVersionItem };

const CURRENT_YEAR = new Date().getFullYear();

interface DemoHubProps {
  onSelectDemo: (demoId: string) => void;
}

export function DemoHub({ onSelectDemo }: DemoHubProps) {
  const readyDemosCount = DEMO_VERSIONS.filter((d) => d.isAvailable).length;

  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 overflow-x-hidden relative'>
      {/* Background radial glow */}
      <div className='absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_70%)] pointer-events-none' />

      {/* Header / Navbar */}
      <header className='border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30'>
        <div className='max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4'>
          {/* Logo & Brand */}
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20'>
              <Scan className='w-5 h-5' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h1 className='text-lg font-bold text-slate-100 tracking-tight'>
                  OcrCraft Studio
                </h1>
                <span className='text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'>
                  Sandbox Hub
                </span>
              </div>
              <p className='text-xs text-slate-400 hidden sm:block'>
                Multi-Version Client-Side OCR &amp; Machine Vision Playground
              </p>
            </div>
          </div>

          {/* Header Indicators */}
          <div className='flex items-center gap-2'>
            <div className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300'>
              <span className='relative flex h-2 w-2'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75' />
                <span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-500' />
              </span>
              <span className='font-medium text-slate-200'>
                {readyDemosCount} Versi Demo Tersedia
              </span>
            </div>

            <span className='hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'>
              <ShieldCheck className='w-3.5 h-3.5' />
              Zero-Backend
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero & Demo Selector */}
      <main className='flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-10'>
        {/* Hero Section */}
        <div className='text-center max-w-3xl mx-auto flex flex-col items-center gap-4'>
          <div className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-inner'>
            <Sparkles className='w-3.5 h-3.5 text-indigo-400' />
            <span>Pusat Uji Coba Model &amp; Pipeline OCR Dokumen Identitas</span>
          </div>

          <h2 className='text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight'>
            Eksplorasi Teknologi OCR{" "}
            <span className='text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-blue-400 to-cyan-400'>
              Kependudukan e-KTP
            </span>
          </h2>

          <p className='text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl'>
            Pilih arsitektur engine OCR kependudukan e-KTP berbasis browser atau cloud sesuai kebutuhan eksperimen Anda.
          </p>

          <div className='flex flex-wrap items-center justify-center gap-2 pt-1'>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'>
              <ShieldCheck className='w-3.5 h-3.5' />
              100% Zero-Backend Privacy
            </span>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20'>
              <Cpu className='w-3.5 h-3.5' />
              WASM &amp; WebGPU Neural Compute
            </span>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20'>
              <Zap className='w-3.5 h-3.5' />
              Multimodal Vision LLM
            </span>
          </div>
        </div>

        {/* Responsive & Fluid Grid Selector */}
        <section aria-label='Daftar Versi Demo OCR' className='w-full'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto'>
            {DEMO_VERSIONS.map((item) => (
              <DemoCard
                key={item.id}
                item={item}
                onSelect={onSelectDemo}
                className={
                  !item.isAvailable
                    ? "col-span-1 md:col-span-2 lg:col-span-3 mt-2"
                    : "col-span-1"
                }
              />
            ))}
          </div>
        </section>

        {/* Architectural Pillars / Privacy Guarantee Banner */}
        <section aria-label='Jaminan Keamanan & Rekayasa Arsitektur' className='w-full pt-4'>
          <div className='rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 sm:p-8 flex flex-col gap-6 backdrop-blur-xs'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6'>
              <div>
                <h3 className='text-base font-bold text-slate-100 flex items-center gap-2'>
                  <Lock className='w-4 h-4 text-emerald-400' />
                  Jaminan Keamanan &amp; Standar Rekayasa Sandbox
                </h3>
                <p className='text-xs sm:text-sm text-slate-400 mt-1'>
                  Seluruh pemrosesan identitas e-KTP berjalan dengan standar keamanan defensif tanpa risiko kebocoran data.
                </p>
              </div>
              <div className='flex items-center gap-2 shrink-0'>
                <span className='px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'>
                  ISO / PDP Ready Design
                </span>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-400'>
              <div className='flex flex-col gap-1.5'>
                <span className='font-semibold text-slate-200 flex items-center gap-2'>
                  <ShieldCheck className='w-4 h-4 text-emerald-400' />
                  1. Zero-Backend Transmission
                </span>
                <p className='leading-relaxed'>
                  Gambar identitas Anda diproses secara lokal di browser via Canvas API, WebAssembly, atau langsung ke endpoint Vision Anda sendiri. Tidak ada server perantara yang menyimpan gambar KTP.
                </p>
              </div>

              <div className='flex flex-col gap-1.5'>
                <span className='font-semibold text-slate-200 flex items-center gap-2'>
                  <Layers className='w-4 h-4 text-indigo-400' />
                  2. Lifecycle Cleanup &amp; Memory Safety
                </span>
                <p className='leading-relaxed'>
                  Setiap perpindahan sesi dan pengunggahan gambar dibersihkan secara deterministik dengan pemanggilan URL.revokeObjectURL dan worker termination untuk mencegah memory leak.
                </p>
              </div>

              <div className='flex flex-col gap-1.5'>
                <span className='font-semibold text-slate-200 flex items-center gap-2'>
                  <Cpu className='w-4 h-4 text-blue-400' />
                  3. Heuristik Khusus e-KTP Indonesia
                </span>
                <p className='leading-relaxed'>
                  Dilengkapi aturan parsing defensif untuk validasi 16 digit NIK, penyesuaian tanggal lahir perempuan (+40 hari), serta pembersihan artefak hologram/cyan background.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className='border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500'>
        <div className='max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3'>
          <p>© {CURRENT_YEAR} OcrCraft Studio — Modern Client-Side Vision &amp; OCR Sandbox</p>
          <div className='flex items-center gap-4 text-slate-400'>
            <span>Vite + React 19</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>ONNX WebGPU / Tesseract WASM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
