import { useCallback, useEffect, useRef, useState } from 'react'
import type { ByokConfig, ByokError, ByokExtractionResult } from '../types/byok'
import {
  extractOpenAiResponseContent,
  parseByokVisionResponse,
} from '../utils/byokResponseParser'
import { normalizeChatCompletionsUrl } from '../utils/byokUrlHelper'

export interface UseByokVisionReturn {
  isProcessing: boolean
  statusMessage: string
  result: ByokExtractionResult | null
  error: ByokError | null
  extractKtp: (imageDataUrl: string) => Promise<ByokExtractionResult | null>
  cancelExtraction: () => void
  resetResult: () => void
  updateResultData: (updater: (prev: ByokExtractionResult) => ByokExtractionResult) => void
}

/**
 * Memetakan error HTTP atau network menjadi ByokError yang deskriptif dan ramah pengguna
 */
function mapToByokError(
  err: unknown,
  status?: number,
  responseBodyText?: string,
  modelId?: string
): ByokError {
  if (err instanceof Error && err.name === 'AbortError') {
    return {
      code: 'ABORTED',
      message: 'Proses ekstraksi dibatalkan.',
    }
  }

  const bodySnippet = (responseBodyText ?? '').toLowerCase()

  // 1. Otorisasi (401 / 403)
  if (status === 401 || status === 403) {
    return {
      code: 'AUTH_FAILED',
      status,
      message: 'Otorisasi gagal (401/403). API Key tidak valid atau tidak memiliki izin akses.',
      details: responseBodyText,
    }
  }

  // 2. Model / Endpoint Not Found (404)
  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      status,
      message: `Model '${modelId}' atau endpoint tidak ditemukan (404). Periksa kembali Model ID dan Base URL.`,
      details: responseBodyText,
    }
  }

  // 3. Rate Limit / Quota (429)
  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      status,
      message:
        'Batas kuota atau rate limit terlampaui (429). Tunggu sejenak atau periksa saldo provider Anda.',
      details: responseBodyText,
    }
  }

  // 4. Deteksi error model tidak mendukung vision
  if (
    bodySnippet.includes('vision') ||
    bodySnippet.includes('image') ||
    bodySnippet.includes('multimodal') ||
    bodySnippet.includes('not supported')
  ) {
    if (
      bodySnippet.includes('unsupported') ||
      bodySnippet.includes('does not support') ||
      bodySnippet.includes('invalid model')
    ) {
      return {
        code: 'VISION_UNSUPPORTED',
        status,
        message: `Model '${modelId}' tidak mendukung input gambar (Vision multimodal). Gunakan model visi seperti gpt-4o, gpt-4o-mini, gemini-2.5-flash, dll.`,
        details: responseBodyText,
      }
    }
  }

  // 5. Network / CORS
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return {
      code: 'CORS_OR_NETWORK',
      message:
        'Gagal terhubung ke endpoint API (Terblokir CORS policy atau masalah koneksi). Server menolak preflight OPTIONS tanpa otentikasi atau belum mengizinkan origin browser. Aktifkan "Gunakan Dev Proxy Lokal" di pengaturan untuk membypass CORS.',
      details: err.message,
    }
  }
  return {
    code: 'UNKNOWN',
    status,
    message: err instanceof Error ? err.message : 'Terjadi kesalahan tidak dikenal saat menghubungi API.',
    details: responseBodyText,
    rawError: err,
  }
}

export function useByokVision(config: ByokConfig): UseByokVisionReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [result, setResult] = useState<ByokExtractionResult | null>(null)
  const [error, setError] = useState<ByokError | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Batalkan request saat unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  const cancelExtraction = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsProcessing(false)
    setStatusMessage('')
  }, [])

  const resetResult = useCallback(() => {
    cancelExtraction()
    setResult(null)
    setError(null)
    setStatusMessage('')
  }, [cancelExtraction])

  const updateResultData = useCallback(
    (updater: (prev: ByokExtractionResult) => ByokExtractionResult) => {
      setResult((prev) => (prev ? updater(prev) : null))
    },
    []
  )

  const extractKtp = useCallback(
    async (imageDataUrl: string): Promise<ByokExtractionResult | null> => {
      if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
        const authErr: ByokError = {
          code: 'AUTH_FAILED',
          message: 'API Key belum diisi. Buka Pengaturan BYOK dan masukkan API Key Anda.',
        }
        setError(authErr)
        return null
      }

      // Batalkan request aktif sebelumnya jika ada
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsProcessing(true)
      setError(null)
      setStatusMessage('Menghubungkan ke Vision API...')

      const startTime = performance.now()
      const targetUrl = normalizeChatCompletionsUrl(config.baseUrl)

      const makeRequestBody = (includeJsonFormat: boolean) => {
        const body: Record<string, unknown> = {
          model: config.modelId.trim(),
          stream: false,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: config.systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Ekstrak seluruh informasi dokumen e-KTP berikut secara presisi sesuai instruksi JSON.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
        }

        if (includeJsonFormat) {
          body.response_format = { type: 'json_object' }
        }

        return body
      }

      const requestUrl = config.useLocalProxy ? '/api/byok-proxy' : targetUrl
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (config.useLocalProxy) {
        headers['x-target-url'] = targetUrl
      }
      if (config.apiKey.trim()) {
        headers.Authorization = `Bearer ${config.apiKey.trim()}`
      }

      let fallbackWithoutJsonFormatUsed = false

      try {
        let response = await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(makeRequestBody(true)),
          signal: controller.signal,
        })

        // Fallback otomatis jika provider menolak parameter response_format (status 400)
        if (!response.ok && response.status === 400) {
          const errText = await response.text()
          if (
            errText.toLowerCase().includes('response_format') ||
            errText.toLowerCase().includes('json_object')
          ) {
            fallbackWithoutJsonFormatUsed = true
            setStatusMessage('Mencoba fallback mode tanpa parameter response_format...')
            response = await fetch(requestUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(makeRequestBody(false)),
              signal: controller.signal,
            })
          } else {
            // Error 400 lainnya
            throw mapToByokError(new Error(errText), response.status, errText, config.modelId)
          }
        }

        if (!response.ok) {
          const errText = await response.text()
          throw mapToByokError(new Error(errText), response.status, errText, config.modelId)
        }

        setStatusMessage('Menerima respons & mem-parsing data e-KTP...')
        const rawResponseText = await response.text()
        const rawContent = extractOpenAiResponseContent(rawResponseText)
        if (!rawContent || !rawContent.trim()) {
          throw {
            code: 'INVALID_JSON',
            message: 'Model mengembalikan respons kosong atau tidak memuat konten pesan.',
            details: rawResponseText.slice(0, 300),
          } as ByokError
        }

        const endTime = performance.now()
        const processingTimeMs = Math.round(endTime - startTime)

        const parsedResult = parseByokVisionResponse(rawContent, {
          modelUsed: config.modelId,
          baseUrlUsed: config.baseUrl,
          processingTimeMs,
          fallbackWithoutJsonFormatUsed,
        })

        setResult(parsedResult)
        setError(null)
        setIsProcessing(false)
        setStatusMessage('')
        return parsedResult
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return null
        }

        let formattedErr: ByokError
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          typeof (err as ByokError).message === 'string'
        ) {
          formattedErr = err as ByokError
        } else {
          formattedErr = mapToByokError(err, undefined, undefined, config.modelId)
        }

        setError(formattedErr)
        setIsProcessing(false)
        setStatusMessage('')
        return null
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    },
    [config]
  )

  return {
    isProcessing,
    statusMessage,
    result,
    error,
    extractKtp,
    cancelExtraction,
    resetResult,
    updateResultData,
  }
}
