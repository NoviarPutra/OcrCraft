import type { ByokProviderPreset } from '../types/byok'

export const DEFAULT_BYOK_SYSTEM_PROMPT = `Anda adalah sistem Vision OCR Dokumen Identitas Resmi (e-KTP Republik Indonesia) tingkat enterprise yang sangat teliti, akurat, dan deterministik.

Tugas Anda adalah membaca gambar e-KTP dan mengembalikan struktur data JSON yang valid dan lengkap.

ATURAN EKSTRAKSI & VALIDASI KETAT:
1. NIK (Nomor Induk Kependudukan):
   - NIK WAJIB tepat 16 digit numerik.
   - Lakukan disambiguasi karakter: 'O'/'D' -> '0', 'I'/'l'/'|' -> '1', 'B' -> '8', 'S' -> '5', 'Z' -> '2', 'G' -> '6', 'A' -> '4'.
   - Validasi struktur 16 digit:
     * Digit 1-2: Kode Provinsi
     * Digit 3-4: Kode Kota/Kabupaten
     * Digit 5-6: Kode Kecamatan
     * Digit 7-12: Tanggal Lahir (DDMMYY)
     * Digit 13-16: Nomor urut (0001-9999)
   - CROSS-CHECK TANGGAL LAHIR DENGAN NIK:
     * Laki-laki: Digit 7-8 adalah tanggal lahir normal (01-31).
     * Perempuan: Sesuai regulasi Kemendagri, digit 7-8 adalah tanggal lahir DITAMBAH 40 (misal: tanggal lahir 12 -> digit 7-8 menjadi 52; tanggal 01 -> 41).

2. KELENGKAPAN FIELD:
   - Nama: Huruf kapital sesuai KTP, jangan masukkan gelar jika tidak ada di KTP. Bersihkan kata 'Nama' jika terbaca.
   - Tempat/Tgl Lahir: Pisahkan nama tempat dan tanggal lahir (format DD-MM-YYYY).
   - Jenis Kelamin: Normalisasi ke 'LAKI-LAKI' atau 'PEREMPUAN'.
   - Golongan Darah: 'A', 'B', 'AB', 'O', atau '-' jika tidak tertera/kosong.
   - Alamat:
     * jalan: Nama jalan, gang, nomor, blok.
     * rt_rw: Format '000/000'.
     * kel_desa: Nama Kelurahan atau Desa.
     * kecamatan: Nama Kecamatan.
   - Agama: 'ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', atau 'PENGHAYAT KEPERCAYAAN'.
   - Status Perkawinan: 'BELUM KAWIN', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI'.
   - Pekerjaan: Sesuai teks e-KTP (misal: 'KARYAWAN SWASTA', 'PELAJAR/MAHASISWA', 'WIRASWASTA', dll).
   - Kewarganegaraan: Normalisasi ke 'WNI' atau 'WNA'.

3. QUALITY CHECK & CONFIDENCE:
   - Evaluasi kualitas visual foto KTP (is_clear, blur_detected, glare_detected).
   - Berikan daftar issue jika ada teks terpotong, hologram menutupi karakter, atau resolusi rendah.

KEMBALIKAN HANYA OBJEK JSON DENGAN STRUKTUR PERSIS BERIKUT (TANPA PEMBUNGKUS TEKS LAIN):
{
  "nik": "3171010101900001",
  "nama": "CONTOH NAMA LENGKAP",
  "tempat_lahir": "JAKARTA",
  "tanggal_lahir": "01-01-1990",
  "jenis_kelamin": "LAKI-LAKI",
  "golongan_darah": "O",
  "alamat": {
    "jalan": "JL. CONTOH NO. 12",
    "rt_rw": "001/002",
    "kel_desa": "GAMBIR",
    "kecamatan": "GAMBIR"
  },
  "agama": "ISLAM",
  "status_perkawinan": "BELUM KAWIN",
  "pekerjaan": "KARYAWAN SWASTA",
  "kewarganegaraan": "WNI",
  "quality_check": {
    "is_clear": true,
    "blur_detected": false,
    "glare_detected": false,
    "issues": []
  }
}`

export const BYOK_PROVIDER_PRESETS: ByokProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI Official',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o Mini (Hemat & Cepat)',
        description: 'Pilihan standar paling ekonomis dan cepat untuk ekstraksi dokumen.',
      },
      {
        id: 'gpt-4o',
        label: 'GPT-4o (Akurasi Maksimal)',
        description: 'Model vision andalan untuk kasus KTP buram atau kondisi pencahayaan ekstrem.',
      },
    ],
    notes: 'Koneksi langsung ke OpenAI. API Key tersimpan hanya di memori atau SessionStorage.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter.ai',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash',
    models: [
      {
        id: 'google/gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        description: 'Multimodal ultra cepat dengan reasoning visual tajam.',
      },
      {
        id: 'qwen/qwen2.5-vl-72b-instruct',
        label: 'Qwen 2.5 VL 72B',
        description: 'State-of-the-art vision open-weights model berpresisi tinggi.',
      },
      {
        id: 'openai/gpt-4o-mini',
        label: 'OpenAI GPT-4o-mini via OpenRouter',
        description: 'Akses GPT-4o-mini melalui agregator OpenRouter.',
      },
    ],
    notes: 'Mendukung ratusan model visual. Mendukung CORS langsung dari browser.',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.2-11b-vision-preview',
    models: [
      {
        id: 'llama-3.2-11b-vision-preview',
        label: 'Llama 3.2 11B Vision',
        description: 'Inference LPU ultra-cepat untuk pengolahan visual seketika.',
      },
      {
        id: 'llama-3.2-90b-vision-preview',
        label: 'Llama 3.2 90B Vision',
        description: 'Varian 90B untuk ketelitian visual lebih tinggi.',
      },
    ],
    notes: 'Kecepatan pemrosesan token tertinggi dengan LPU hardware accelerator.',
  },
  {
    id: 'ollama',
    name: 'Ollama / Local vLLM',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'minicpm-v',
    models: [
      {
        id: 'minicpm-v',
        label: 'MiniCPM-V (Ollama)',
        description: 'Model multimodal lokal yang efisien untuk OCR identitas.',
      },
      {
        id: 'llava',
        label: 'LLaVA (Ollama)',
        description: 'Model vision open source populer.',
      },
      {
        id: 'qwen2.5-vl',
        label: 'Qwen 2.5 VL (Ollama)',
        description: 'Visi open-weights terkini di mesin lokal.',
      },
    ],
    notes:
      'Pastikan OLLAMA_ORIGINS="*" disetel saat menjalankan Ollama agar browser tidak terblokir CORS.',
  },
  {
    id: 'custom',
    name: 'Custom Router / LiteLLM',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [],
    notes: 'Ketik endpoint Base URL dan Model ID sesuai konfigurasi router atau proxy kustom Anda.',
  },
]
