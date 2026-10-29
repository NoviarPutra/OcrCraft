import type { FileValidationResult } from '../types/ktp'

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
] as const
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Validasi ketat file gambar e-KTP:
 * 1. Pengecekan ganda MIME type dan ekstensi file
 * 2. Deteksi file kosong/korup (0 byte)
 * 3. Batas ukuran maksimal 10 MB
 */
export function validateKtpImageFile(file: File): FileValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'Tidak ada file yang dipilih. Silakan pilih foto KTP.',
    }
  }

  // 1. Cek ukuran file kosong (0 byte)
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File gambar kosong atau korup (0 byte). Silakan unggah foto KTP yang valid.',
    }
  }

  // 2. Cek batas maksimal ukuran file (10 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `Ukuran file (${sizeInMb} MB) melebihi batas maksimal 10 MB. Silakan unggah file yang lebih kecil.`,
    }
  }

  // 3. Pengecekan ganda MIME type
  const isMimeValid = ALLOWED_MIME_TYPES.includes(
    file.type.toLowerCase() as (typeof ALLOWED_MIME_TYPES)[number]
  )

  // 4. Pengecekan ekstensi file dari nama file
  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))

  if (!isMimeValid || !hasValidExtension) {
    return {
      valid: false,
      error:
        'Format file tidak didukung. Harap unggah file gambar format JPG, JPEG, PNG, atau WEBP.',
    }
  }

  return { valid: true }
}
