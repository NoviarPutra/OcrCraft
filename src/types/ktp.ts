export interface KtpMeta {
  confidence: number;
  processingTimeMs: number;
  nikValid: boolean;
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
  threshold: number; // 80 - 200, default ~135
  rotation: number; // 0, 90, 180, 270
  maxWidth?: number; // default 1600
}

export interface PreprocessResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  cleanup: () => void;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0 - 100
}
