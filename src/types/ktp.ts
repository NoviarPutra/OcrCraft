export type PreprocessMode =
  | 'enhanced-grayscale'
  | 'original-color'
  | 'adaptive-threshold'
  | 'global-threshold'

export interface KtpMeta {
  confidence: number;
  processingTimeMs: number;
  nikValid: boolean;
  modeUsed?: PreprocessMode;
  retryFallbackUsed?: boolean;
  isUserEdited?: boolean;
}

export interface KtpData {
  nik: string;
  nama: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  golonganDarah: string;
  alamat: string;
  rtRw: string;
  kelDesa: string;
  kecamatan: string;
  agama: string;
  statusPerkawinan: string;
  pekerjaan: string;
  kewarganegaraan: string;
}

export interface KtpExtractionResult {
  meta: KtpMeta;
  data: KtpData;
  rawText: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface PreprocessOptions {
  mode?: PreprocessMode;
  threshold?: number; // untuk global-threshold: 80 - 200, default 135
  contrast?: number; // untuk enhanced-grayscale: 1.0 - 1.8, default 1.25
  adaptiveSensitivity?: number; // untuk adaptive-threshold: 5 - 30%, default 15
  adaptiveWindowSize?: number; // untuk adaptive-threshold: 15 - 65 px, default 31
  rotation?: number; // 0, 90, 180, 270
  maxWidth?: number; // default 1600
  autoOrientation?: boolean; // deteksi orientasi otomatis 0, 90, 180, 270 via projection profile
  autoDeskew?: boolean; // deteksi & luruskan kemiringan (-5° s.d. +5°)
  autoCropId1?: boolean; // potong border luar/watermark ke rasio ISO ID-1 (1.586:1)
  autoUpscaleLowRes?: boolean; // upscaling 2x jika lebar < 800px untuk ketajaman teks OCR
  deskewAngleDeg?: number; // sudut koreksi eksplisit jika diketahui (misal -1.8)
}
export interface PreprocessResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  mode: PreprocessMode;
  orientationApplied?: number;
  deskewAngleApplied?: number;
  upscaled?: boolean;
  cleanup: () => void;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0 - 100
}

export interface OcrWorkerInstance {
  recognize: (image: unknown) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
}

export type OcrWorkerCreator = (
  langs?: unknown,
  oem?: unknown,
  options?: { logger?: (m: { status: string; progress: number }) => void }
) => Promise<OcrWorkerInstance>;

declare global {
  interface Window {
    __MOCK_TESSERACT_CREATE_WORKER__?: OcrWorkerCreator;
    __MOCK_WORKERS_TERMINATED__?: number;
  }
}
