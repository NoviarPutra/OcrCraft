export interface DemoVersionItem {
  id: string
  title: string
  version: string
  status: 'stable' | 'beta' | 'roadmap'
  badge: string
  description: string
  features: string[]
  engine: string
  isAvailable: boolean
}

export const DEMO_VERSIONS: DemoVersionItem[] = [
  {
    id: 'client-side-tesseract',
    title: 'Client-Side Tesseract OCR',
    version: 'v1.0',
    status: 'stable',
    badge: 'Stable',
    description:
      'Pemrosesan ekstraksi KTP 100% di browser secara lokal, aman, zero-backend, lengkap dengan Canvas Preprocessing, Chroma-Bleaching, dan Heuristic JSON Parser.',
    features: [
      'HTML5 Canvas Cyan/Chroma-Bleaching',
      'Projection Profile Auto-Orientation (0°/90°/180°/270°)',
      'Multi-Pass Fallback OCR Strategy',
      'Smart NIK & Date Cross-Validation (+40 Wanita)',
      'Simulasi Auto-Fill Form & JSON Extractor',
      'Zero-Leak Lifecycle Teardown',
    ],
    engine: 'Tesseract.js WASM + HTML5 Canvas API',
    isAvailable: true,
  },
  {
    id: 'byok-vision-ocr',
    title: 'BYOK Vision OCR (OpenAI-Compatible)',
    version: 'v2.0',
    status: 'beta',
    badge: 'Baru / BYOK Vision',
    description:
      'Ekstraksi e-KTP presisi tinggi berbasis multimodal LLM dengan menghubungkan API Key Anda sendiri (OpenAI, OpenRouter, Groq, Ollama, LiteLLM) langsung dari browser tanpa perantara server.',
    features: [
      'Dukungan Multi-Provider (OpenAI, OpenRouter, Groq, Ollama/vLLM)',
      'Client-Side Pre-Flight Image Compression (Safe Resize JPEG 0.85)',
      'Zero Binarization — Mempertahankan Warna & Konteks Spasial',
      'Defensive JSON Parser & Disambiguasi Digit NIK (+40 Wanita)',
      'Customizable System Prompt & Response Format Auto-Fallback',
      'Zero Storage Leaks — API Key hanya di Memori / SessionStorage',
    ],
    engine: 'OpenAI-Compatible Vision API + HTML5 Canvas Pre-Flight',
    isAvailable: true,
  },
  {
    id: 'onnx-web-runtime',
    title: 'Edge Neural ONNX Engine',
    version: 'v2.1',
    status: 'roadmap',
    badge: 'Coming Soon',
    description:
      'Ekstraksi deep learning teks end-to-end berbasis WebAssembly SIMD + WebGPU untuk mendeteksi teks pada foto KTP berpencahayaan rendah dan hologram tebal.',
    features: [
      'Text Detection DBNet (ResNet-18 FP16)',
      'CRNN Sequence Recognition',
      'Akselerasi WebGPU Hardware Shader',
      'Kompensasi Bayangan & Glare Adaptif',
    ],
    engine: 'ONNX Runtime Web (WASM/WebGPU)',
    isAvailable: false,
  },
  {
    id: 'serverless-hybrid-gateway',
    title: 'Serverless Hybrid Gateway',
    version: 'v3.0',
    status: 'roadmap',
    badge: 'Roadmap',
    description:
      'Pipeline hybrid zero-logging: validasi crop dan checksum NIK di sisi klien sebelum dikirim ke inference microservices terenkripsi untuk akurasi skala enterprise 99.8%.',
    features: [
      'Zero-Persistence End-to-End Encryption',
      'Dual Checksum & Dukcapil Hash Matching',
      'Fallback ke Cloud GPU Vision Clusters',
      'Audit Trail Kepatuhan PDP / GDPR',
    ],
    engine: 'Cloudflare Workers + gRPC Edge Inference',
    isAvailable: false,
  },
]
