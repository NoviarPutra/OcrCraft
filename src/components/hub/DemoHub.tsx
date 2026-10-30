import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Lock,
  Scan,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { DEMO_VERSIONS, type DemoVersionItem } from "../../demos/registry";
export type { DemoVersionItem };

interface DemoHubProps {
  onSelectDemo: (demoId: string) => void;
}

export function DemoHub({ onSelectDemo }: DemoHubProps) {
  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30'>
      {/* Header / Navbar */}
      <header className='border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20'>
              <Scan className='w-5 h-5' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h1 className='text-lg font-bold text-slate-100 tracking-tight'>OcrCraft Studio</h1>
                <span className='text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'>
                  Sandbox Hub
                </span>
              </div>
              <p className='text-xs text-slate-400'>
                Multi-Version Client-Side OCR & Machine Vision Playground
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'>
              <ShieldCheck className='w-3.5 h-3.5' />
              100% Zero-Backend Privacy
            </span>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20'>
              <Cpu className='w-3.5 h-3.5' />
              WASM Local Compute
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero & Demo Selector */}
      <main className='flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col gap-12'>
        {/* Hero Section */}
        <div className='text-center max-w-3xl mx-auto flex flex-col items-center gap-4'>
          <div className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 shadow-inner'>
            <Sparkles className='w-3.5 h-3.5 text-indigo-400' />
            <span>Pusat Uji Coba Model &amp; Pipeline OCR Dokumen Identitas</span>
          </div>
          <h2 className='text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight'>
            Eksplorasi Teknologi OCR{" "}
            <span className='text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-blue-400 to-cyan-400'>
              Tanpa Pengiriman Data
            </span>
          </h2>
          <p className='text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl'>
            Pilih versi engine OCR di bawah untuk masuk ke ruang kerja interaktif. Seluruh proses
            komputasi visual, preprocessing canvas, dan rekonstruksi teks berlangsung murni di peramban
            web Anda.
          </p>
        </div>

        {/* Demo Version Cards Grid */}
        <section aria-label='Daftar Versi Demo OCR' className='flex flex-col gap-6'>
          <div className='flex items-center justify-between border-b border-slate-800 pb-3'>
            <div className='flex items-center gap-2'>
              <Layers className='w-4 h-4 text-indigo-400' />
              <h3 className='text-sm font-semibold uppercase tracking-wider text-slate-300'>
                Pilih Versi Demo Sandbox
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {DEMO_VERSIONS.filter((d) => d.isAvailable).length} Tersedia ·{' '}
              {DEMO_VERSIONS.filter((d) => !d.isAvailable).length} Roadmap
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {DEMO_VERSIONS.map((item) => {
              const isReady = item.isAvailable;

              return (
                <div
                  key={item.id}
                  data-testid={`demo-card-${item.id}`}
                  onClick={() => isReady && onSelectDemo(item.id)}
                  onKeyDown={(e) => {
                    if (isReady && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelectDemo(item.id);
                    }
                  }}
                  role={isReady ? "button" : "region"}
                  tabIndex={isReady ? 0 : -1}
                  aria-disabled={!isReady}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 border text-left ${
                    isReady
                      ? "bg-linear-to-b from-slate-900/90 to-slate-900/40 border-indigo-500/40 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 ring-1 ring-indigo-500/20"
                      : "bg-slate-900/30 border-slate-800/80 opacity-75 cursor-not-allowed"
                  }`}>
                  {/* Card Header & Badges */}
                  <div className='flex flex-col gap-4'>
                    <div className='flex items-center justify-between gap-2'>
                      <div className='flex items-center gap-2'>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            item.status === "stable"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : item.status === "beta"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                          {item.badge}
                        </span>
                        <span className='text-xs font-mono font-medium text-slate-400'>
                          {item.version}
                        </span>
                      </div>
                      <span className='text-[11px] font-mono text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800'>
                        {item.engine.split(" ")[0]}
                      </span>
                    </div>

                    <div>
                      <h4
                        className={`text-lg font-bold transition-colors ${
                          isReady ? "text-slate-100 group-hover:text-indigo-300" : "text-slate-300"
                        }`}>
                        {item.title}
                      </h4>
                      <p className='text-xs text-slate-400 mt-2 leading-relaxed'>{item.description}</p>
                    </div>

                    {/* Features Bullet List */}
                    <div className='mt-2 pt-4 border-t border-slate-800/80 flex flex-col gap-2'>
                      <span className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>
                        Fitur Utama
                      </span>
                      <ul className='flex flex-col gap-1.5'>
                        {item.features.map((feat) => (
                          <li
                            key={feat}
                            className='text-xs text-slate-300 flex items-start gap-2 leading-tight'>
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                isReady ? "text-indigo-400" : "text-slate-600"
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Bottom Action */}
                  <div className='mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between'>
                    {isReady ? (
                      <div className='w-full flex items-center justify-between text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors'>
                        <span>Buka Workspace Demo</span>
                        <div className='w-8 h-8 rounded-lg bg-indigo-600/20 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all duration-200'>
                          <ArrowRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5' />
                        </div>
                      </div>
                    ) : (
                      <div className='w-full flex items-center justify-between text-xs text-slate-500 font-medium'>
                        <span className='flex items-center gap-1.5'>
                          <Clock className='w-3.5 h-3.5' />
                          Rilis Berikutnya
                        </span>
                        <span className='text-[11px] font-mono bg-slate-800/80 px-2 py-0.5 rounded text-slate-400'>
                          Locked
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Security & Architecture Pillars */}
        <section
          aria-label='Pilar Rekayasa OcrCraft'
          className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4'>
          <div className='rounded-xl p-4 bg-slate-900/40 border border-slate-800 flex items-start gap-3'>
            <div className='w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20'>
              <Lock className='w-4 h-4' />
            </div>
            <div>
              <h5 className='text-xs font-bold text-slate-200'>Zero Network Transmission</h5>
              <p className='text-[11px] text-slate-400 mt-1'>
                Foto KTP tidak pernah diunggah ke cloud. Validasi MIME dan ekstraksi teks berjalan penuh
                di memori RAM peramban.
              </p>
            </div>
          </div>

          <div className='rounded-xl p-4 bg-slate-900/40 border border-slate-800 flex items-start gap-3'>
            <div className='w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20'>
              <Zap className='w-4 h-4' />
            </div>
            <div>
              <h5 className='text-xs font-bold text-slate-200'>Deterministic Teardown</h5>
              <p className='text-[11px] text-slate-400 mt-1'>
                Pembersihan kanvas nol dimensi dan terminasi WebAssembly worker secara deterministik
                mencegah memory leak saat berpindah view.
              </p>
            </div>
          </div>

          <div className='rounded-xl p-4 bg-slate-900/40 border border-slate-800 flex items-start gap-3'>
            <div className='w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20'>
              <CheckCircle2 className='w-4 h-4' />
            </div>
            <div>
              <h5 className='text-xs font-bold text-slate-200'>UU No. 23/2006 Rule Engine</h5>
              <p className='text-[11px] text-slate-400 mt-1'>
                Rekonsiliasi silang otomatis antara 6 digit tanggal lahir di NIK (aturan +40 wanita) dan
                tanggal lahir tertulis.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className='border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500'>
        <div className='max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2'>
          <span>OcrCraft Studio — Modern Client-Side Vision &amp; OCR Sandbox</span>
          <span className='font-mono text-[11px]'>Zero-Backend · React 19 · Tesseract WASM</span>
        </div>
      </footer>
    </div>
  );
}
