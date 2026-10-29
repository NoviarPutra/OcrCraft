import type { Page } from '@playwright/test'
import type { OcrWorkerCreator, OcrWorkerInstance } from '../../src/types/ktp'

export const DEFAULT_MOCK_KTP_TEXT = `PROVINSI DKI JAKARTA
JAKARTA PUSAT
NIK : 3171012304950001
NAMA / NAME : BUDI SANTOSO
TEMPAT/TGL LAHIR : JAKARTA, 23-04-1995
JENIS KELAMIN : LAKI-LAKI        GOL. DARAH : O
ALAMAT / ADDRESS : JL. KEBON SIRIH NO. 45
RT/RW : 005/002
KEL/DESA : GAMBIR
KECAMATAN : GAMBIR
AGAMA : ISLAM
STATUS PERKAWINAN : BELUM KAWIN
PEKERJAAN : KARYAWAN SWASTA
KEWARGANEGARAAN : WNI
BERLAKU HINGGA : SEUMUR HIDUP`

export interface SetupMockOptions {
  mockText?: string
  confidence?: number
  delayMs?: number
}

/**
 * Injects a fast, deterministic, offline mock for tesseract.js worker via page.addInitScript.
 * Emits real progress milestones and provides realistic KTP OCR results without downloading WASM.
 */
export async function setupTesseractMock(page: Page, options: SetupMockOptions = {}) {
  const text = options.mockText ?? DEFAULT_MOCK_KTP_TEXT
  const confidence = options.confidence ?? 95
  const delayMs = options.delayMs ?? 150

  await page.addInitScript(
    ({ text, confidence, delayMs }) => {
      window.__MOCK_WORKERS_TERMINATED__ = 0

      const mockCreator: OcrWorkerCreator = async (
        _langs?: unknown,
        _oem?: unknown,
        workerOpts?: { logger?: (m: { status: string; progress: number }) => void }
      ): Promise<OcrWorkerInstance> => {
        const logger = workerOpts?.logger

        if (logger) {
          logger({ status: 'loading tesseract core', progress: 0.15 })
          await new Promise((r) => setTimeout(r, delayMs / 3))
          logger({ status: 'initializing tesseract', progress: 0.45 })
          await new Promise((r) => setTimeout(r, delayMs / 3))
          logger({ status: 'recognizing text', progress: 0.9 })
        }

        const mockWorker: OcrWorkerInstance = {
          recognize: async (_image: unknown) => {
            if (logger) {
              logger({ status: 'recognizing text', progress: 0.6 })
              await new Promise((r) => setTimeout(r, delayMs / 2))
              logger({ status: 'recognizing text', progress: 1.0 })
            }
            return {
              data: {
                text,
                confidence,
              },
            }
          },
          terminate: async () => {
            window.__MOCK_WORKERS_TERMINATED__ = (window.__MOCK_WORKERS_TERMINATED__ || 0) + 1
          },
        }

        return mockWorker
      }

      window.__MOCK_TESSERACT_CREATE_WORKER__ = mockCreator
    },
    { text, confidence, delayMs }
  )
}
