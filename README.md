# Client-Side KTP OCR & JSON Extractor

Aplikasi web demonstrasi **KTP (Kartu Tanda Penduduk) OCR & JSON Extractor** yang berjalan **100% di sisi klien (browser-only)** menggunakan **React 19**, **Vite 8**, **TypeScript**, **Tailwind CSS v4**, dan **Tesseract.js v7**.

Aplikasi ini tidak memiliki dependensi server backend (*zero-backend*). Seluruh proses—mulai dari pembacaan berkas gambar, manipulasi piksel kanvas, inisialisasi WebAssembly (WASM), inferensi pengenalan karakter, hingga pemetaan ke skema JSON terstruktur—dieksekusi langsung di dalam peramban pengguna. Tidak ada data kependudukan atau berkas foto KTP yang dikirim ke jaringan internet, memastikan privasi data terjaga penuh sesuai prinsip pelindungan data pribadi (UU PDP).

---

## Alur Kerja & Arsitektur

```
[ Berkas Foto KTP ]
         │
         ▼
[ 1. Validasi Input ] ────────► Tolak jika > 10 MB, 0 Byte, atau MIME/Ekstensi tidak valid
         │
         ▼
[ 2. HTML5 Canvas Preprocessor ]
   ├─ Safe Downscaling (lebar maksimal 1600px proporsional)
   ├─ Rotasi 90° / 180° / 270° (koreksi foto miring/terbalik)
   ├─ Grayscale Tertimbang (meredam kanal biru/cyan latar e-KTP)
   ├─ Contrast Enhancement (menaikkan kontras teks hitam)
   └─ Binarization / Thresholding (Slider interaktif 80 - 200)
         │
         ▼
[ 3. Tesseract.js Web Worker ] ──► Engine OCR WASM (Bahasa Indonesia: 'ind')
         │
         ▼
[ 4. Heuristic Post-Correction & Parser ]
   ├─ Koreksi karakter salah baca numerik (O/D->0, I/l->1, S->5, B->8, dsb.)
   ├─ Regex matching bertingkat untuk NIK, Tanggal Lahir, RT/RW, Alamat
   └─ Pemetaan ke Target Skema JSON KTP
         │
         ▼
[ 5. Tampilan 3 Panel & Form Auto-Fill ]
   ├─ Panel 1: Pratinjau Before vs After & Kontrol Threshold/Rotasi
   ├─ Panel 2: Hasil Structured JSON, Confidence Score, & Raw Text
   ├─ Panel 3: Simulasi Auto-Fill Form (Highlight kuning jika NIK < 16 digit)
   └─ Pembersihan Memori Otomatis (revokeObjectURL, canvas zeroing, worker cleanup)
```

---

## Prasyarat & Lingkungan

### 1. Kebutuhan Sistem
- **Node.js**: Versi `18.x` atau lebih baru (direkomendasikan LTS `20.x` / `22.x`).
- **Package Manager**: `npm` versi `9+` atau `bun` versi `1.2+`.

### 2. Kebutuhan Browser
Aplikasi membutuhkan peramban modern yang mendukung:
- **WebAssembly (WASM)** untuk eksekusi core Tesseract C++.
- **Web Workers** untuk memproses OCR di latar belakang tanpa membekukan thread antarmuka (UI).
- **HTML5 Canvas 2D Context** (`getImageData` dan `putImageData`) untuk filter piksel anti-noise.
- *Peramban yang didukung*: Google Chrome/Chromium 80+, Mozilla Firefox 78+, Microsoft Edge 80+, Apple Safari 14+.

### 3. Data Model Bahasa Tesseract (`ind.traineddata`)
- **Mode Daring (Default)**: Saat proses OCR dijalankan pertama kali, `tesseract.js` akan secara otomatis mengunduh berkas model bahasa Indonesia (`ind.traineddata.gz`, ~2-3 MB) dari CDN resmi (jsDelivr) dan menyimpannya secara persisten di **IndexedDB** browser. Eksekusi berikutnya akan membaca langsung dari *cache* lokal tanpa mengunduh ulang.
- **Mode Luring Penuh (Air-Gapped / Offline Setup)**:
  Jika aplikasi hendak dijalankan pada jaringan tertutup (*intranet / air-gapped*):
  1. Unduh model bahasa Indonesia dari repositori Naptha Tesseract:
     ```bash
     curl -L -o public/tessdata/ind.traineddata.gz https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/ind.traineddata.gz
     ```
  2. Buka `src/hooks/useKtpOcr.ts` dan tambahkan opsi `langPath` pada konfigurasi `createWorker`:
     ```ts
     const worker = await createWorker('ind', 1, {
       langPath: '/tessdata',
       gzip: true,
       // ...
     })
     ```

### 4. Kriteria Foto KTP yang Optimal
- **Format Berkas**: `image/jpeg` (`.jpg`, `.jpeg`), `image/png` (`.png`), atau `image/webp` (`.webp`).
- **Ukuran Berkas**: Maksimal `10 MB` dan bukan berkas kosong (`> 0 Byte`).
- **Pencahayaan**: Hindari pantulan kilat lampu kamera (*flash glare*) tepat di atas angka NIK atau nama.
- **Orientasi**: Pastikan teks KTP terbaca horizontal dari kiri ke kanan (gunakan tombol rotasi 90° jika foto miring atau terbalik).

---

## Panduan Instalasi & Menjalankan Proyek

### 1. Kloning dan Masuk ke Direktori Proyek
```bash
cd client-side-ocr
```

### 2. Instalasi Dependensi
```bash
npm install
# atau menggunakan bun:
# bun install
```

### 3. Menjalankan Server Development
```bash
npm run dev
```
Aplikasi akan aktif di `http://localhost:5173`. Buka tautan tersebut di peramban Anda.

### 4. Menjalankan Pengujian Unit (Unit Tests)
Proyek ini dilengkapi dengan rangkaian pengujian unit menggunakan **Vitest** untuk menguji akurasi regex parser, fungsi koreksi digit OCR, dan validator berkas:
```bash
npm test
```

### 5. Pemeriksaan Tipe TypeScript & Linter
```bash
# Validasi tipe data tanpa emit (strict mode)
npx tsc --noEmit

# Pemeriksaan linter cepat dengan Oxlint
npm run lint
```

### 6. Build Produksi & Preview
```bash
# Kompilasi aplikasi ke bundle produksi (dist/)
npm run build

# Menjalankan server pratinjau hasil build produksi
npm run preview
```

---

## Cara Penggunaan Aplikasi

1. **Memuat Gambar KTP**:
   - Klik area unggah berkas atau seret foto KTP ke dalam kotak dropzone.
   - Tersedia tombol **"Muat Sampel KTP Demo"** untuk menguji langsung seluruh fitur tanpa perlu mengunggah foto kartu identitas pribadi.
2. **Koreksi Rotasi & Filter Preprocessing**:
   - Jika foto terbalik atau miring, klik tombol **Putar 90° searah jarum jam** atau **berlawanan arah jarum jam**.
   - Perhatikan pratinjau berdampingan (**Before: Foto KTP Asli** vs **After: Hasil Canvas Preprocessed**).
   - Geser **Threshold Slider** (default: `135`) hingga teks identitas berwarna hitam tegas dan motif batik/hologram latar belakang KTP berubah menjadi putih bersih.
3. **Eksekusi OCR**:
   - Klik tombol **"Ekstrak Teks & Data KTP dengan OCR (Tesseract.js)"**.
   - Pantau indikator progres real-time (inisialisasi WASM -> unduh traineddata -> analisis teks 0-100%).
4. **Analisis Hasil & Koreksi Formulir**:
   - **Panel 2 (Hasil JSON & Raw Text)**: Menampilkan metadata durasi proses (ms), skor confidence rata-rata (%), status keabsahan NIK 16 digit, tombol **Salin JSON**, dan tab untuk melihat teks mentah OCR.
   - **Panel 3 (Simulasi Auto-Fill Form)**: Kolom formulir akan otomatis terisi. Field yang memiliki skor keyakinan rendah atau NIK yang belum memenuhi 16 digit otomatis ditandai dengan batas/label kuning agar pengguna dapat mengoreksi sebelum data disimpan atau disalin.

---

## Target Skema JSON

Hasil parsing deterministik menghasilkan struktur JSON berikut:

```json
{
  "meta": {
    "confidence": 88.5,
    "processingTimeMs": 1420.75,
    "nikValid": true
  },
  "data": {
    "nik": "3171010101900001",
    "nama": "BUDI SANTOSO",
    "tempatLahir": "JAKARTA",
    "tanggalLahir": "01-01-1990",
    "jenisKelamin": "LAKI-LAKI",
    "golonganDarah": "O",
    "alamat": "JL. MERDEKA NO. 45",
    "rtRw": "005/002",
    "kelDesa": "GAMBIR",
    "kecamatan": "GAMBIR",
    "agama": "ISLAM",
    "statusPerkawinan": "KAWIN",
    "pekerjaan": "KARYAWAN SWASTA",
    "kewarganegaraan": "WNI"
  },
  "rawText": "PROVINSI DKI JAKARTA\nKOTA JAKARTA PUSAT\nNIK : 3171010101900001\n..."
}
```

---

## Struktur Direktori Proyek

```
client-side-ocr/
├── index.html                   # Entry point HTML & viewport meta
├── vite.config.ts               # Konfigurasi Vite & Tailwind CSS v4 plugin
├── tsconfig.app.json            # Konfigurasi TypeScript ketat (strict: true)
├── package.json                 # Skrip build, test, lint, dan dependensi
└── src/
    ├── main.tsx                 # Mounting React root
    ├── App.tsx                  # Orkestrasi 3 panel, token sekuensial anti-race, & lifecycle cleanup
    ├── index.css                # Konfigurasi Tailwind CSS v4 (@import "tailwindcss")
    ├── types/
    │   └── ktp.ts               # Interface TypeScript data KTP, skema JSON, dan status OCR
    ├── utils/
    │   ├── fileValidator.ts     # Validasi ganda MIME type, ekstensi, dan batas 10 MB
    │   ├── imagePreprocessor.ts # Pipeline Canvas: Safe scaling, rotation, grayscale, binarization
    │   ├── ktpParser.ts         # Koreksi OCR digit dan parser regex deterministik
    │   ├── ktpParser.test.ts    # Rangkaian unit test (Vitest) untuk parser & validator
    │   └── sampleKtpGenerator.ts# Generator kanvas e-KTP sintetis untuk demo instan
    ├── hooks/
    │   └── useKtpOcr.ts         # Hook siklus hidup Tesseract Web Worker & progress state
    └── components/
        ├── UploadPreviewPanel.tsx # Panel 1: Upload, rotasi, slider threshold, pratinjau Before/After
        ├── JsonRawPanel.tsx       # Panel 2: Kartu JSON terformat, Confidence score, & Raw OCR text
        └── AutoFillFormPanel.tsx  # Panel 3: Simulasi formulir interaktif dengan highlight peringatan
```

---

## Manajemen Memori Ketat (Anti-Memory Leak)

Aplikasi menerapkan pola rekayasa perangkat lunak untuk memastikan tidak terjadi kebocoran memori pada browser pengguna:

1. **Pencabutan ObjectURL (`URL.revokeObjectURL`)**:
   Setiap kali pengguna mengunggah gambar baru, mereset form, atau saat komponen unmount, ObjectURL yang sebelumnya dibuat langsung dicabut untuk membebaskan alokasi memori blob peramban.
2. **Pembersihan Offscreen Canvas**:
   Setelah konversi `canvas.toDataURL()` dan `canvas.toBlob()` selesai, dimensi kanvas offscreen di-nol-kan (`canvas.width = 0; canvas.height = 0`) untuk membebaskan buffer alokasi piksel GPU/grafis.
3. **Terminasi Tesseract Web Worker**:
   Worker OCR ditutup secara bersih via `worker.terminate()` saat komponen unmount atau saat terjadi kegagalan fatal pada runtime WASM agar proses latar belakang tidak tertinggal.
4. **Pencegahan Race Condition (Sequential Abort Token)**:
   Pergeseran slider threshold secara cepat diproteksi menggunakan nomor urut sekuensial (`pipelineSeqRef`). Jika terdapat proses kanvas lama yang selesai terlambat, hasilnya otomatis dibuang dan memorinya segera dibersihkan.

---

## Troubleshooting Umum

### 1. Angka NIK Terbaca Kurang Akurat atau Kurang dari 16 Digit
- **KTP Berlatar Belakang Gelap / Bayangan**: Turunkan nilai threshold slider ke rentang `100 - 120` agar garis angka hitam tidak terputus.
- **KTP Pudar / Terlalu Terang**: Naikkan nilai threshold slider ke rentang `140 - 165` untuk mempertegas garis teks tipis.
- **Motif Batik Hologram Masih Tampak**: Geser slider secara perlahan sampai latar belakang menjadi putih bersih pada panel *After*.

### 2. Isu Kebijakan Keamanan Konten (CSP / CORS) pada Deployment Produksi
Jika aplikasi di-deploy ke server produksi (seperti Nginx, Cloudflare Pages, atau AWS S3) dan Web Worker gagal dimuat:
- Pastikan header `Content-Security-Policy` mengizinkan blob dan WebAssembly:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob:; connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; img-src 'self' blob: data:;
  ```
- Jika menggunakan fitur multi-threading Web Worker tingkat lanjut, tambahkan header isolasi lintas asal (*cross-origin isolation*):
  ```http
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```

---

## Lisensi

Proyek ini dirilis di bawah lisensi MIT. Bebas digunakan untuk keperluan pembelajaran, demonstrasi, maupun integrasi sistem e-KYC berbasis peramban.
