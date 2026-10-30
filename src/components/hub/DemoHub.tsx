import {
  CheckCircle2,
  Clock,
  Cloud,
  Cpu,
  Lock,
  Milestone,
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
  const activeDemos = DEMO_VERSIONS.filter((d) => d.isAvailable);
  const readyDemosCount = activeDemos.length;

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

        {/* Responsive & Fluid Grid Selector for Active Demos */}
        <section aria-label='Daftar Versi Demo OCR' className='w-full'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-6xl mx-auto'>
            {activeDemos.map((item) => (
              <DemoCard
                key={item.id}
                item={item}
                onSelect={onSelectDemo}
                className='col-span-1'
              />
            ))}
          </div>
        </section>

        {/* Gateway, Roadmap & Security Feature Grid / Info Cards */}
        <section aria-label='Arsitektur Gateway, Roadmap & Standar Keamanan' className='w-full pt-4'>
          <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6'>
            <div>
              <div className='flex items-center gap-2 mb-1.5'>
                <div className='w-2 h-2 rounded-full bg-indigo-500 animate-pulse' />
                <span className='text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono'>
                  Arsitektur, Roadmap &amp; Kepatuhan
                </span>
              </div>
              <h2 className='text-xl sm:text-2xl font-bold text-slate-100 tracking-tight'>
                Gateway Terpadu, Roadmap v3.0 &amp; Keamanan Sandbox
              </h2>
              <p className='text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed'>
                Standar rekayasa masa depan, peta jalan rilis teknologi vision, dan jaminan perlindungan data pribadi e-KTP tanpa kompromi.
              </p>
            </div>
            <div className='shrink-0 hidden sm:flex items-center gap-2'>
              <span className='px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'>
                ISO / PDP Ready Design
              </span>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6'>
            {/* Card 1: Serverless Hybrid Gateway */}
            <div
              data-testid='demo-card-serverless-hybrid-gateway'
              role='region'
              aria-disabled='true'
              className='bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm'
            >
              <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between gap-2'>
                  <div className='w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner'>
                    <Cloud className='w-5 h-5' />
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs font-mono font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50'>
                      v3.0
                    </span>
                    <span className='text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-cyan-500/10 text-cyan-400 border-cyan-500/20'>
                      Roadmap
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className='text-base font-bold text-slate-100 tracking-tight'>
                    Serverless Hybrid Gateway
                  </h3>
                  <p className='mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed'>
                    Pipeline hybrid zero-logging: validasi crop dan checksum NIK di sisi klien sebelum dikirim ke inference microservices terenkripsi untuk akurasi enterprise.
                  </p>
                </div>

                <ul className='mt-2 flex flex-col gap-2 text-xs text-slate-300'>
                  <li className='flex items-start gap-2'>
                    <CheckCircle2 className='w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5' />
                    <span>Zero-Persistence End-to-End Encryption</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <CheckCircle2 className='w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5' />
                    <span>Dual Checksum &amp; Dukcapil Hash Matching</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <CheckCircle2 className='w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5' />
                    <span>Fallback ke Cloud GPU Vision Clusters</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <CheckCircle2 className='w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5' />
                    <span>Audit Trail Kepatuhan PDP / GDPR</span>
                  </li>
                </ul>
              </div>

              <div className='mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between'>
                <span className='text-[11px] font-mono text-cyan-300/90 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded-md flex items-center gap-1.5'>
                  <Clock className='w-3 h-3 text-cyan-400' /> Dalam Pengembangan
                </span>
                <span className='text-[11px] text-slate-500 font-mono'>Edge Workers</span>
              </div>
            </div>

            {/* Card 2: Roadmap v3.0 & Visi Platform */}
            <div className='bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm'>
              <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between gap-2'>
                  <div className='w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner'>
                    <Milestone className='w-5 h-5' />
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs font-mono font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50'>
                      Roadmap v3.0
                    </span>
                    <span className='text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20'>
                      Fase Desain
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className='text-base font-bold text-slate-100 tracking-tight'>
                    Roadmap v3.0 Platform
                  </h3>
                  <p className='mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed'>
                    Peta jalan evolusi arsitektur OCR kependudukan berbasis edge &amp; browser dengan peningkatan akselerasi grafis native dan proteksi privasi otomatis.
                  </p>
                </div>

                <ul className='mt-2 flex flex-col gap-2 text-xs text-slate-300'>
                  <li className='flex items-start gap-2'>
                    <Sparkles className='w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5' />
                    <span>Q1: Native WebGPU WGSL Direct Shader Kernels</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Sparkles className='w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5' />
                    <span>Q2: Automasi Redaksi PII &amp; Watermark e-KTP</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Sparkles className='w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5' />
                    <span>Q3: Offline PWA Zero-Download Model Cache</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Sparkles className='w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5' />
                    <span>Q4: Multi-Dokumen (SIM, Paspor &amp; NPWP)</span>
                  </li>
                </ul>
              </div>

              <div className='mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between'>
                <span className='text-[11px] font-mono text-indigo-300/90 bg-indigo-950/40 border border-indigo-800/40 px-2.5 py-1 rounded-md flex items-center gap-1.5'>
                  <Sparkles className='w-3 h-3 text-indigo-400' /> WebGPU + PII Masking
                </span>
                <span className='text-[11px] text-slate-500 font-mono'>Platform 2026</span>
              </div>
            </div>

            {/* Card 3: Jaminan Keamanan & Standar Rekayasa Sandbox */}
            <div className='bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm'>
              <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between gap-2'>
                  <div className='w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner'>
                    <Lock className='w-5 h-5' />
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20'>
                      ISO / PDP Ready
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className='text-base font-bold text-slate-100 tracking-tight'>
                    Jaminan Keamanan &amp; Rekayasa Sandbox
                  </h3>
                  <p className='mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed'>
                    Seluruh pemrosesan identitas e-KTP berjalan dengan standar keamanan defensif tanpa risiko kebocoran data (zero data transmission &amp; deterministic memory teardown).
                  </p>
                </div>

                <ul className='mt-2 flex flex-col gap-2 text-xs text-slate-300'>
                  <li className='flex items-start gap-2'>
                    <ShieldCheck className='w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5' />
                    <span>Zero-Backend: Tidak ada foto diunggah ke server</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <ShieldCheck className='w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5' />
                    <span>Deterministic Teardown: URL.revokeObjectURL aman</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <ShieldCheck className='w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5' />
                    <span>BYOK Zero-Leakage: API Key di localStorage lokal</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <ShieldCheck className='w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5' />
                    <span>Validasi Heuristik: 40+ aturan wilayah e-KTP</span>
                  </li>
                </ul>
              </div>

              <div className='mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between'>
                <span className='text-[11px] font-mono text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-md flex items-center gap-1.5'>
                  <ShieldCheck className='w-3 h-3 text-emerald-400' /> Defense-Grade Sandbox
                </span>
                <span className='text-[11px] text-slate-500 font-mono'>Zero Storage</span>
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
