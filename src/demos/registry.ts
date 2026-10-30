export interface DemoVersionItem {
  id: string
  title: string
  version: string
  status: 'stable' | 'beta' | 'roadmap'
  badge: string
  description: string
  features: string[]
  keyCapabilities: string[]
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
    keyCapabilities: ['Zero-Backend', 'Canvas Preprocessing', 'WASM Tesseract'],
    engine: 'Tesseract.js WASM + HTML5 Canvas API',
    isAvailable: true,
  },
  {
    id: 'byok-vision-ocr',
    title: 'BYOK Vision OCR (OpenAI-Compatible)',
    version: 'v2.0',
    status: 'beta',
    badge: 'Cloud API',
    description:
      'Ekstraksi e-KTP presisi tinggi berbasis multimodal LLM dengan menghubungkan API Key Anda sendiri langsung dari browser tanpa perantara server.',
    features: [
      'Dukungan Multi-Provider (OpenAI, OpenRouter, Groq, Ollama/vLLM)',
      'Client-Side Pre-Flight Image Compression (Safe Resize JPEG 0.85)',
      'Zero Binarization — Mempertahankan Warna & Konteks Spasial',
      'Defensive JSON Parser & Disambiguasi Digit NIK (+40 Wanita)',
      'Customizable System Prompt & Response Format Auto-Fallback',
      'Zero Storage Leaks — API Key hanya di Memori / SessionStorage',
    ],
    keyCapabilities: ['Vision LLM', 'Multi-Provider', 'Zero Storage'],
    engine: 'OpenAI-Compatible Vision API + HTML5 Canvas Pre-Flight',
    isAvailable: true,
  },
  {
    id: 'paddleocr-onnx',
    title: 'PaddleOCR ONNX (Local Neural Engine)',
    version: 'v2.1',
    status: 'beta',
    badge: 'Local AI',
    description:
      'Ekstraksi deep learning e-KTP 100% di browser secara lokal menggunakan pipeline DBNet detection dan SVTR recognition dengan akselerasi WASM & WebGPU.',
    features: [
      'Text Detection DBNet (ResNet-18 / MobileNet FP32)',
      'Text Recognition CRNN / SVTR + CTC Greedy Decoder',
      'Browser Cache API & IndexedDB Model Persistence (0s Re-download)',
      'Akselerasi Dual-Backend (WASM SIMD & WebGPU Fallback)',
      'Interactive Bounding-Box Overlay & Confidence Heatmap',
      'Spatial & Heuristic KTP Field Extraction (+40 Disambiguasi)',
    ],
    keyCapabilities: ['Local AI', 'ONNX WebGPU/WASM', 'BBox Spatial Sort'],
    engine: 'ONNX Runtime Web (WASM SIMD / WebGPU) + HTML5 Canvas',
    isAvailable: true,
  },
  {
    id: 'serverless-hybrid-gateway',
    title: 'Serverless Hybrid Gateway',
    version: 'v3.0',
    status: 'roadmap',
    badge: 'Roadmap',
    description:
      'Pipeline hybrid zero-logging: validasi crop dan checksum NIK di sisi klien sebelum dikirim ke inference microservices terenkripsi untuk akurasi enterprise.',
    features: [
      'Zero-Persistence End-to-End Encryption',
      'Dual Checksum & Dukcapil Hash Matching',
      'Fallback ke Cloud GPU Vision Clusters',
      'Audit Trail Kepatuhan PDP / GDPR',
    ],
    keyCapabilities: ['Edge AI Workers', 'Fallback Gateway', 'Zero Cold-Start'],
    engine: 'Cloudflare Workers + gRPC Edge Inference',
    isAvailable: false,
  },
]
