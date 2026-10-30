import type { ByokErrorCode } from '../types/byok'
import { normalizeChatCompletionsUrl } from './byokUrlHelper'

export const TEST_IMAGE_PIXEL_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export const DEFAULT_TEST_CONNECTION_TIMEOUT_MS = 10_000

export interface TestConnectionParams {
  baseUrl: string
  apiKey: string
  modelId: string
  useLocalProxy?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

export interface TestConnectionResult {
  success: boolean
  latencyMs: number
  visionSupported: boolean
  modelId: string
  errorMessage?: string
  errorCode?: ByokErrorCode
}

function isVisionUnsupportedMessage(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('vision') ||
    lower.includes('image') ||
    lower.includes('multimodal') ||
    lower.includes('not supported')
  )
}

function formatNonVisionErrorMessage(modelId: string): string {
  return `Koneksi ke server berhasil, namun model '${modelId}' tidak mendukung input gambar (Vision). Pilih model multimodal (misal gpt-4o-mini, gemini-2.5-flash, qwen2.5-vl).`
}

/**
 * Menguji koneksi provider OpenAI-Compatible dan kapabilitas Vision multimodal.
 * Menggunakan lightweight 1-pixel image probe hemat token dan timeout 10 detik.
 */
export async function testProviderConnection(
  params: TestConnectionParams
): Promise<TestConnectionResult> {
  const model = params.modelId.trim() || 'gpt-4o-mini'
  const timeoutMs = params.timeoutMs ?? DEFAULT_TEST_CONNECTION_TIMEOUT_MS

  const internalController = new AbortController()
  let isTimedOut = false

  // Handle external abort signal
  const onExternalAbort = () => {
    internalController.abort(params.signal?.reason)
  }

  if (params.signal) {
    if (params.signal.aborted) {
      return {
        success: false,
        latencyMs: 0,
        visionSupported: false,
        modelId: model,
        errorCode: 'ABORTED',
        errorMessage: 'Pengujian koneksi dibatalkan.',
      }
    }
    params.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  const timeoutTimer = setTimeout(() => {
    isTimedOut = true
    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    internalController.abort(timeoutErr)
  }, timeoutMs)

  const targetUrl = normalizeChatCompletionsUrl(params.baseUrl)
  const requestUrl = params.useLocalProxy ? '/api/byok-proxy' : targetUrl

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (params.useLocalProxy) {
    headers['x-target-url'] = targetUrl
  }
  const cleanKey = params.apiKey.trim()
  if (cleanKey) {
    headers.Authorization = `Bearer ${cleanKey}`
  }

  const visionPayload = {
    model,
    stream: false,
    max_tokens: 5,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Reply OK',
          },
          {
            type: 'image_url',
            image_url: {
              url: TEST_IMAGE_PIXEL_BASE64,
            },
          },
        ],
      },
    ],
  }

  const startTime = performance.now()

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(visionPayload),
      signal: internalController.signal,
    })

    const latencyMs = Math.max(0, Math.round(performance.now() - startTime))

    if (response.ok) {
      return {
        success: true,
        latencyMs,
        visionSupported: true,
        modelId: model,
      }
    }

    const errorStatus = response.status
    let responseText = ''
    try {
      responseText = await response.text()
    } catch {
      // Ignore text decoding error
    }

    // 1. Otorisasi (401 / 403)
    if (errorStatus === 401 || errorStatus === 403) {
      return {
        success: false,
        latencyMs,
        visionSupported: false,
        modelId: model,
        errorCode: 'AUTH_FAILED',
        errorMessage: 'Autentikasi gagal (401/403). Periksa kembali API Key Anda.',
      }
    }

    // 2. Endpoint / Model Not Found (404)
    if (errorStatus === 404) {
      return {
        success: false,
        latencyMs,
        visionSupported: false,
        modelId: model,
        errorCode: 'NOT_FOUND',
        errorMessage:
          'Endpoint atau Model ID tidak ditemukan (404). Pastikan Base URL berakhiran /v1 dan nama model sudah benar.',
      }
    }

    // 3. Rate Limit (429)
    if (errorStatus === 429) {
      return {
        success: false,
        latencyMs,
        visionSupported: false,
        modelId: model,
        errorCode: 'RATE_LIMITED',
        errorMessage:
          'Batas kuota atau rate-limit tercapai (429). Silakan coba sesaat lagi atau cek saldo provider Anda.',
      }
    }

    // 4. Deteksi Non-Vision pada 400 / 422
    if (errorStatus === 400 || errorStatus === 422) {
      if (isVisionUnsupportedMessage(responseText)) {
        return {
          success: false,
          latencyMs,
          visionSupported: false,
          modelId: model,
          errorCode: 'VISION_UNSUPPORTED',
          errorMessage: formatNonVisionErrorMessage(model),
        }
      }

      // Tahap 2: Fallback text probe jika error body ambigu
      try {
        const textPayload = {
          model,
          stream: false,
          max_tokens: 5,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: 'Reply OK',
            },
          ],
        }

        const textResponse = await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(textPayload),
          signal: internalController.signal,
        })

        if (textResponse.ok) {
          const totalLatencyMs = Math.max(0, Math.round(performance.now() - startTime))
          return {
            success: false,
            latencyMs: totalLatencyMs,
            visionSupported: false,
            modelId: model,
            errorCode: 'VISION_UNSUPPORTED',
            errorMessage: formatNonVisionErrorMessage(model),
          }
        }
      } catch {
        // Fall through to general error below if text probe fails or is aborted
      }
    }

    // Format fallback response error
    let parsedMessage = ''
    try {
      const parsed: unknown = JSON.parse(responseText)
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        const errVal = (parsed as Record<string, unknown>).error
        if (typeof errVal === 'string') {
          parsedMessage = errVal
        } else if (errVal && typeof errVal === 'object' && 'message' in errVal) {
          const msgVal = (errVal as Record<string, unknown>).message
          if (typeof msgVal === 'string') {
            parsedMessage = msgVal
          }
        }
      }
    } catch {
      parsedMessage = responseText.slice(0, 200)
    }

    return {
      success: false,
      latencyMs,
      visionSupported: false,
      modelId: model,
      errorCode: 'UNKNOWN',
      errorMessage:
        parsedMessage || `Server mengembalikan status error ${errorStatus} (${response.statusText}).`,
    }
  } catch (err: unknown) {
    const latencyMs = Math.max(0, Math.round(performance.now() - startTime))

    if (
      isTimedOut ||
      (err instanceof Error &&
        (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout')))
    ) {
      return {
        success: false,
        latencyMs,
        visionSupported: false,
        modelId: model,
        errorCode: 'TIMEOUT',
        errorMessage: 'Waktu koneksi habis (>10 detik). Server lambat atau tidak merespons.',
      }
    }

    if (
      (err instanceof Error && err.name === 'AbortError') ||
      params.signal?.aborted ||
      internalController.signal.aborted
    ) {
      return {
        success: false,
        latencyMs,
        visionSupported: false,
        modelId: model,
        errorCode: 'ABORTED',
        errorMessage: 'Pengujian koneksi dibatalkan.',
      }
    }

    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      return {
        success: false,
        latencyMs,
        visionSupported: false,
        modelId: model,
        errorCode: 'CORS_OR_NETWORK',
        errorMessage:
          'Gagal terhubung ke server (CORS / Network Error). Pastikan URL benar dan provider mengizinkan request langsung dari browser.',
      }
    }

    return {
      success: false,
      latencyMs,
      visionSupported: false,
      modelId: model,
      errorCode: 'UNKNOWN',
      errorMessage:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan jaringan atau koneksi tidak dapat dibuat.',
    }
  } finally {
    clearTimeout(timeoutTimer)
    if (params.signal) {
      params.signal.removeEventListener('abort', onExternalAbort)
    }
  }
}
