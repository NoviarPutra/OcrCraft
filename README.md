# OcrCraft Studio

### Multi-Version OCR Sandbox & Identity Document Parser

![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%7C%207.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-114%20passed-green?logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E%20Ready-orange?logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 1. Tentang Proyek (Overview)

**OcrCraft Studio** adalah platform *sandbox* modular dan laboratorium komparasi OCR yang dirancang khusus untuk mengekstraksi, memvalidasi, dan menormalisasi data dokumen identitas **e-KTP (Kartu Tanda Penduduk) Republik Indonesia** ke dalam format data terstruktur JSON yang siap pakai.

Aplikasi ini mengintegrasikan **empat varian arsitektur OCR yang berbeda** dalam satu antarmuka terpadu:
1. **Client-Side WASM Engine** (privasi total tanpa transmisi jaringan).
2. **Bring Your Own Key (BYOK) Cloud Vision LLM** (koneksi langsung browser ke model multimodal via OpenAI-compatible API).
3. **Local Deep Learning Engine** (inferensi model ONNX 2-tahap langsung di browser via WebGPU/WASM).
4. **High-Speed Python Backend API** (arsitektur microservice berbasis FastAPI dan RapidOCR C++/ONNX).

Setiap engine dilengkapi dengan modul pasca-pemrosesan (*post-processing*) cerdas, mencakup perbaikan kesalahan karakter numerik KTP, normalisasi tanggal lahir dan kode wilayah NIK (termasuk aturan disambiguasi `+40` untuk tanggal lahir perempuan), penyortiran spasial urutan baca, visualisasi *bounding box*, dan simulasi *auto-fill form*.

---

## 2. Arsitektur & Varian Demo yang Tersedia

| Aspek | v1: Client-Side Tesseract | v2: BYOK Vision OCR | v3: PaddleOCR ONNX | v4: RapidOCR Backend |
| :--- | :--- | :--- | :--- | :--- |
| **Lingkungan Eksekusi** | Browser (Web Worker + WASM) | Cloud Vision API (Browser Direct) | Browser (WASM SIMD / WebGPU) | Dedicated Python Service (FastAPI) |
| **Engine Inti** | Tesseract.js v7 (`ind.traineddata`) | Multimodal LLM (GPT-4o, Claude, dll.) | `onnxruntime-web` (DBNet + SVTR) | RapidOCR (C++ ONNXRuntime) |
| **Tingkat Privasi** | **100% Luring (Zero Network)** | Kunci & Gambar Langsung ke Provider | **100% Luring (Zero Network)** | Intranet / Server Terkendali |
| **Estimasi Latensi** | ~1.5s – 3.5s (Tergantung CPU) | ~1.0s – 2.5s (Tergantung Jaringan) | ~800ms – 2.0s (WebGPU Accelerated) | **< 150ms – 200ms** (High Throughput) |
| **Visual Bounding Box** | Tidak (Teks Baris Heuristik) | Tidak (Ekstraksi JSON Semantik) | **Ya (Overlay Kanvas Interaktif)** | **Ya (Overlay Kanvas Interaktif)** |
| **Kebutuhan Backend** | Tidak Ada (*Zero-Backend*) | Tidak Ada (*Direct Client-to-API*) | Tidak Ada (*Model Cached via IDB*) | Python 3.10+ & Uvicorn |

---

### Detail Varian Demo

#### v1: Client-Side Tesseract OCR (v1.0 - Stable)
- **Karakteristik Utama**: Berjalan 100% di browser pengguna tanpa dependensi server (*zero-backend*). Memenuhi standar regulasi Pelindungan Data Pribadi (UU PDP).
- **Pipeline Pemrosesan**:
  1. *Input Validation*: Pengecekan ukuran berkas (maks. 10 MB) dan format gambar (JPEG, PNG, WebP).
  2. *HTML5 Canvas Preprocessing*: *Downscaling* proporsional (lebar maks 1600px), rotasi manual (90°/180°/270°), *chroma-bleaching* tertimbang (meredam kanal biru/cyan latar e-KTP), penajaman kontras teks, dan binarisasi *threshold* adaptif.
  3. *Tesseract.js Web Worker*: Eksekusi modul WebAssembly bahasa Indonesia (`ind`) pada *worker thread* terisolasi tanpa memblokir UI antarmuka.
  4. *Heuristic Regex Parser*: Pembersihan karakter rancu (O/D $\rightarrow$ 0, I/l $\rightarrow$ 1, S $\rightarrow$ 5, B $\rightarrow$ 8), validasi 16 digit NIK, dan pemetaan ke skema JSON.

#### v2: BYOK Vision OCR (OpenAI-Compatible) (v2.0 - Beta)
- **Karakteristik Utama**: Ekstraksi berbasis AI multimodal dengan konsep *Bring Your Own Key* (BYOK). Menghubungkan langsung browser pengguna ke penyedia LLM vision (OpenAI GPT-4o, Groq, Ollama, OpenRouter, vLLM, DeepSeek) tanpa server perantara yang menyimpan *credential*.
- **Fitur Khusus**:
  1. *Secure Storage*: Konfigurasi disimpan di `localStorage` peramban (`ocrcraft:byok:providers:v1`). Jika opsi persistensi dinonaktifkan (`persistApiKey: false`), API Key tidak ditulis ke penyimpanan disk dan hanya berada di memori aktif sesi.
  2. *Pre-Flight Probe*: Fitur tes koneksi (`testProviderConnection`) untuk memvalidasi endpoint, token autentikasi, ketersediaan model, serta latensi *roundtrip* jaringan.
  3. *Local CORS Proxy*: Dilengkapi middleware Vite (`/api/byok-proxy`) untuk meneruskan permintaan ke endpoint lokal (misal: Ollama pada `localhost:11434`) tanpa terhalang kebijakan CORS peramban.
  4. *Client-Side Image Optimization*: Kompresi otomatis berbasis kanvas (downscale ke maks 1280px dan kompresi JPEG 82%) guna menghemat kuota token model vision.
  5. *Robust Schema Parser*: Membersihkan output LLM dari blok markdown (````json...````) atau teks naratif menjadi objek JSON tervalidasi.

#### v3: PaddleOCR ONNX (Local Neural Engine) (v2.1 - Beta)
- **Karakteristik Utama**: Inferensi *deep learning* 2-tahap (Text Detection + Text Recognition) yang berjalan sepenuhnya di sisi klien menggunakan model ONNX via `onnxruntime-web`.
- **Fitur Khusus**:
  1. *Dual-Stage Pipeline*: Deteksi teks menggunakan model **DBNet** dan pengenalan teks menggunakan **SVTR/CRNN**.
  2. *Hardware Acceleration*: Mendukung backend WebAssembly (WASM SIMD multi-threaded) dan akselerasi GPU lokal melalui WebGPU.
  3. *Model Cache Manager*: Menyimpan bobot model ONNX secara lokal di **IndexedDB** peramban untuk mencegah unduhan ulang saat aplikasi dibuka kembali.
  4. *CTC Decoding & Spatial Sorting*: Algoritma rekonstruksi tata letak teks (*reading order*) berdasarkan koordinat spasial poligon kotak deteksi (*bounding box*).
  5. *Interactive Canvas*: Visualisasi poligon kotak deteksi di atas kanvas dengan fitur interaktif untuk melihat teks dan nilai keyakinan (*confidence score*) per area.

#### v4: RapidOCR Backend (FastAPI) (v2.5 - Beta)
- **Karakteristik Utama**: Layanan mikro berkecepatan tinggi yang mengeksekusi RapidOCR (kompilasi C++/ONNXRuntime) melalui backend Python berbasis FastAPI.
- **Fitur Khusus**:
  1. *Sub-200ms Latency*: Pemrosesan inferensi berkecepatan tinggi dengan profil waktu terperinci (*detection time*, *recognition time*, dan *total roundtrip*).
  2. *REST API Endpoint*: Endpoint `POST /api/v1/ocr/extract-ktp` menerima muatan gambar *multipart/form-data*, menjalankan validasi dimensi, dan mengembalikan koordinat *bounding box*, teks baris, serta skor probabilitas.
  3. *Full-Featured Workspace*: Visualisasi *bounding box* langsung di frontend, panel perbandingan *side-by-side*, tab hasil terstruktur (JSON, Teks Mentah, dan Formulir e-KTP).

---

## 3. Struktur Direktori Proyek (Project Structure)

```text
client-side-ocr/
├── backend/                        # Layanan Python FastAPI OCR Backend
│   ├── main.py                     # Definisi API, CORS, dan integrasi RapidOCR
│   └── requirements.txt            # Dependensi Python (FastAPI, RapidOCR, NumPy, Pillow)
├── scripts/
│   └── dev-backend.js              # Runner otomatis backend (deteksi Python, auto-venv, & uvicorn)
├── src/
│   ├── components/                 # Komponen Antarmuka Pengguna (UI)
│   │   ├── hub/                    # Demo Hub selector antarmuka utama
│   │   │   ├── DemoHub.tsx         # Dashboard katalog varian demo
│   │   │   └── DemoCard.tsx        # Kartu navigasi demo
│   │   └── workspace/              # Ruang kerja ekstraksi OCR per engine
│   │       ├── TesseractWorkspace.tsx   # Workspace Demo v1 (Tesseract.js)
│   │       ├── byok/                    # Workspace Demo v2 (BYOK Vision LLM)
│   │       │   ├── ByokVisionWorkspace.tsx
│   │       │   └── ByokSettingsDrawer.tsx
│   │       ├── paddle/                  # Workspace Demo v3 (PaddleOCR ONNX)
│   │       │   ├── PaddleOcrWorkspace.tsx
│   │       │   ├── InteractiveBoundingCanvas.tsx
│   │       │   ├── PaddleControlPanel.tsx
│   │       │   └── PaddleResultsPanel.tsx
│   │       └── rapid/                   # Workspace Demo v4 (RapidOCR FastAPI)
│   │           ├── RapidOcrWorkspace.tsx
│   │           ├── RapidControlPanel.tsx
│   │           └── RapidResultsPanel.tsx
│   ├── demos/
│   │   └── registry.ts             # Registrasi metadata, kemampuan, dan rute demo
│   ├── hooks/                      # React Custom Hooks
│   │   ├── useKtpOcr.ts            # State machine & lifecycle worker Tesseract
│   │   ├── useByokVision.ts        # State machine pemanggilan API Vision LLM
│   │   └── useByokProviders.ts     # Manajemen persistensi provider & API key
│   ├── types/                      # Deklarasi tipe TypeScript (KTP, BYOK, PaddleOCR)
│   │   ├── ktp.ts
│   │   ├── byok.ts
│   │   └── paddleOcr.ts
│   └── utils/                      # Algoritma Parser, Transformasi & Utilitas
│       ├── ktpParser.ts            # Parser heuristik reguler untuk Tesseract
│       ├── rapidKtpParser.ts       # Parser data spasial & validasi NIK RapidOCR
│       ├── paddleKtpParser.ts      # Parser data spasial PaddleOCR
│       ├── spatialSorter.ts        # Algoritma pengurutan posisi koordinat teks
│       ├── ctcDecoder.ts           # Logika decode probabilitas Connectionist Temporal Classification
│       ├── modelCacheManager.ts    # Penyimpanan model ONNX ke IndexedDB
│       ├── imagePreprocessor.ts    # Manipulasi piksel kanvas (binarisasi, bleaching, rotasi)
│       ├── byokResponseParser.ts   # Pembersihan dan sanitasi output JSON LLM
│       ├── byokImageOptimizer.ts   # Kompresi & downscale payload gambar ke LLM
│       └── testProviderConnection.ts # Health check & latensi probe provider LLM
├── tests/                          # Automated Test Suites
│   ├── fixtures/                   # Gambar sampel pengujian e-KTP
│   ├── helpers/                    # Mock Tesseract & deteksi kebocoran memori
│   ├── ktp-ocr-pipeline.spec.ts    # Playwright E2E: Pipeline Tesseract
│   ├── ktp-ocr-portal.spec.ts      # Playwright E2E: Tampilan Portal
│   ├── byok-vision-flow.spec.ts    # Playwright E2E: Alur BYOK Vision
│   └── ocr-hub-and-navigation.spec.ts # Playwright E2E: Navigasi Hub
├── playwright.config.ts            # Konfigurasi pengujian E2E Playwright
├── vite.config.ts                  # Konfigurasi bundler Vite 8 & Tailwind CSS v4
└── package.json                    # Konfigurasi dependensi dan skrip proyek
```

---

## 4. Cara Instalasi & Menjalankan Proyek (Getting Started)

### Prasyarat Sistem
- **Node.js**: Versi `18.x` atau lebih baru (direkomendasikan versi LTS `20.x` atau `22.x`).
- **Python**: Versi `3.10` hingga `3.12` (diperlukan untuk menjalankan backend RapidOCR; Python $\ge$ 3.13 belum didukung oleh *binary wheel* `rapidocr-onnxruntime`).
- **Git**: Untuk kloning repositori.

---

### Langkah 1: Kloning Repositori & Instal Frontend
Buka terminal dan unduh repositori proyek:

```bash
git clone https://github.com/your-username/client-side-ocr.git
cd client-side-ocr
npm install
```

---

### Langkah 2: Menyiapkan Python Backend

Masuk ke folder `backend`, buat *virtual environment*, dan instal dependensi yang diperlukan:

```bash
cd backend
python -m venv venv

# Aktifkan virtual environment:
# Pengguna macOS / Linux:
source venv/bin/activate

# Pengguna Windows (Command Prompt / PowerShell):
# venv\Scripts\activate

# Instal dependensi Python
pip install -r requirements.txt

# Kembali ke root direktori proyek
cd ..
```

---

### Langkah 3: Menjalankan Aplikasi (1 Command untuk Frontend + Backend)

Jalankan perintah berikut pada direktori utama proyek:

```bash
npm run dev:all
```

> **Catatan Otomatisasi**: Perintah `npm run dev:all` menggunakan paket `concurrently` untuk menyalakan frontend Vite dan backend FastAPI sekaligus. Skrip internal (`scripts/dev-backend.js`) secara cerdas akan mendeteksi instalasi Python, memverifikasi dependensi virtual environment, dan menjalankan server Uvicorn pada port `8000`.

Jika Anda ingin menjalankan layanan secara terpisah di terminal yang berbeda:
```bash
# Terminal 1: Jalankan Frontend Vite
npm run dev:frontend

# Terminal 2: Jalankan Backend FastAPI
npm run dev:backend
```

---

### Langkah 4: Akses Aplikasi & Dokumentasi API

Setelah layanan aktif, buka browser Anda pada alamat berikut:

| Layanan | URL | Keterangan |
| :--- | :--- | :--- |
| **Aplikasi Antarmuka (Frontend)** | [http://localhost:5173](http://localhost:5173) | Portal OcrCraft Studio & Sandbox Demo |
| **RapidOCR Extraction API** | `POST http://localhost:8000/api/v1/ocr/extract-ktp` | Endpoint inferensi e-KTP multipart form |
| **Interactive API Docs (Swagger UI)** | [http://localhost:8000/docs](http://localhost:8000/docs) | Eksplorasi interaktif endpoint FastAPI |
| **Alternative API Docs (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Dokumentasi teknis endpoint REST API |
| **API Health Check** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | Status kesiapan mesin RapidOCR |

Contoh pengujian endpoint backend secara langsung via `curl`:
```bash
curl -X POST http://localhost:8000/api/v1/ocr/extract-ktp \
  -F "file=@tests/fixtures/ktp-sample.jpg"
```

---

## 5. Target Skema Data e-KTP (JSON Output Contract)

Seluruh varian demo memetakan hasil ekstraksi ke dalam kontrak data standar berikut:

```json
{
  "meta": {
    "confidence": 95,
    "processingTimeMs": 142,
    "nikValid": true,
    "modeUsed": "enhanced-grayscale"
  },
  "data": {
    "nik": "3201012304950001",
    "nama": "BUDI SANTOSO",
    "tempatLahir": "BOGOR",
    "tanggalLahir": "23-04-1995",
    "jenisKelamin": "LAKI-LAKI",
    "golonganDarah": "O",
    "alamat": "JL. RAYA PAJAJARAN NO. 12",
    "rtRw": "004/002",
    "kelDesa": "BABAKAN",
    "kecamatan": "BOGOR TENGAH",
    "agama": "ISLAM",
    "statusPerkawinan": "BELUM KAWIN",
    "pekerjaan": "KARYAWAN SWASTA",
    "kewarganegaraan": "WNI"
  },
  "rawText": "..."
}
```

> **Catatan Skema**: Kontrak data di atas sesuai dengan interface TypeScript `KtpExtractionResult` (`meta`, `data` bertipe `KtpData` 14-kolom, dan `rawText`). Pada RapidOCR backend, data juga dapat diakses dalam format `standardJson` (`RapidKtpStandardJson`) dengan nested object `alamat` (`jalan`, `rt_rw`, `kel_desa`, `kecamatan`).

---

## 6. Pengujian & Kualitas Kode (Testing & Quality Assurance)

Proyek ini menerapkan standar pengujian otomatis berlapis mencakup pengujian unit (unit testing) dan pengujian *end-to-end* (E2E).

### Menjalankan Unit & Integration Test (Vitest)
Unit test menguji parser reguler, validasi NIK (termasuk kasus batas tanggal lahir wanita $+40$), fungsi manipulasi kanvas, *spatial sorter*, dan persistensi BYOK:

```bash
# Menjalankan seluruh unit test suite
npm run test

# Menjalankan pengujian dalam mode watch interaktif
npx vitest
```

### Menjalankan Pengujian End-to-End (Playwright)
E2E test memverifikasi alur interaksi pengguna, navigasi antar demo hub, rotasi kanvas, simulasi pengunggahan berkas, dan pengisian otomatis formulir:

```bash
# Menjalankan seluruh pengujian E2E headless via package script atau Playwright CLI
npm run test:e2e
# atau: npx playwright test
# Menjalankan pengujian E2E dengan tampilan UI interaktif
npm run test:e2e:ui
```

### Analisis Kode Statis & Type-Check
```bash
# Menjalankan linter performa tinggi (oxlint)
npm run lint

# Memvalidasi tipe data TypeScript & kompilasi produksi
npm run build
```

---

## 7. Praktik Rekayasa & Proteksi Memori

- **Pembersihan Resource Kanvas & Memori**: Seluruh objek Blob URL yang dihasilkan dari input file secara eksplisit dilepas menggunakan `URL.revokeObjectURL()` guna mencegah kebocoran memori browser (*memory leak*).
- **Isolasi Worker**: Inisialisasi worker Tesseract dan ONNX dikelola dengan *lifecycle management* yang mematikan worker (`worker.terminate()`) saat komponen tidak lagi digunakan (*unmount*).
- **Prinsip Pelindungan Data Pribadi (UU PDP)**: Pada varian v1 dan v3, seluruh proses inferensi berjalan secara luring pada memori lokal pengguna tanpa penyimpanan persisten atau transmisi berkas ke pihak ketiga.

---

## 8. Panduan Kontribusi & Lisensi

### Kontribusi
Kontribusi perbaikan bug, penambahan fitur ekstraksi data identitas, atau optimasi model sangat diterima:
1. *Fork* repositori ini.
2. Buat branch fitur baru (`git checkout -b feature/peningkatan-ocr`).
3. Pastikan seluruh pengujian lolos (`npm run test && npm run lint`).
4. Buat *commit* dengan format konvensional (`git commit -m 'feat: tambahkan validasi kode pos KTP'`).
5. *Push* ke branch Anda (`git push origin feature/peningkatan-ocr`).
6. Buka *Pull Request* baru.

### Lisensi
Didistribusikan di bawah lisensi terbuka **MIT License**. Lihat berkas [LICENSE](LICENSE) untuk informasi selengkapnya.
