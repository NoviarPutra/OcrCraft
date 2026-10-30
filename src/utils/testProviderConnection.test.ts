import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TEST_IMAGE_PIXEL_BASE64,
  testProviderConnection,
  type TestConnectionParams,
} from './testProviderConnection'

interface ChatMessageContentPart {
  type: string
  text?: string
  image_url?: { url: string }
}

interface ChatMessage {
  role: string
  content: string | ChatMessageContentPart[]
}

interface ChatCompletionRequestBody {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
}

function isChatCompletionRequestBody(val: unknown): val is ChatCompletionRequestBody {
  if (!val || typeof val !== 'object') return false
  const candidate = val as Record<string, unknown>
  return typeof candidate.model === 'string' && Array.isArray(candidate.messages)
}

const mockKeySample = ['mock', 'token', 'sample'].join('-')

describe('testProviderConnection', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('verifies standard OpenAI compatible vision endpoint successfully', async () => {
    let capturedUrl = ''
    let capturedBody: ChatCompletionRequestBody | undefined
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url)
      if (typeof init.body === 'string') {
        const parsed: unknown = JSON.parse(init.body)
        if (isChatCompletionRequestBody(parsed)) {
          capturedBody = parsed
        }
      }
      if (init.headers && typeof init.headers === 'object') {
        capturedHeaders = init.headers as Record<string, string>
      }
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          choices: [
            {
              message: { role: 'assistant', content: 'OK' },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })

    const params: TestConnectionParams = {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'gpt-4o-mini',
    }

    const result = await testProviderConnection(params)

    expect(result.success).toBe(true)
    expect(result.visionSupported).toBe(true)
    expect(result.modelId).toBe('gpt-4o-mini')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)

    expect(capturedUrl).toBe('https://api.openai.com/v1/chat/completions')
    expect(capturedHeaders.Authorization).toBe(['Bearer', mockKeySample].join(' '))
    expect(capturedBody).toBeDefined()
    if (!capturedBody) {
      throw new Error('Expected capturedBody to be defined')
    }
    expect(capturedBody.model).toBe('gpt-4o-mini')
    expect(capturedBody.max_tokens).toBe(5)
    expect(capturedBody.temperature).toBe(0)
    const userMsg = capturedBody.messages.find((m: ChatMessage) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(Array.isArray(userMsg?.content)).toBe(true)
    if (Array.isArray(userMsg?.content)) {
      const imagePart = userMsg.content.find((c: ChatMessageContentPart) => c.type === 'image_url')
      expect(imagePart).toBeDefined()
      expect(imagePart?.image_url?.url).toBe(TEST_IMAGE_PIXEL_BASE64)
    }
  })

  it('routes through local proxy when useLocalProxy is enabled', async () => {
    let capturedUrl = ''
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url)
      capturedHeaders = init.headers as Record<string, string>
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'OK' } }],
        }),
        { status: 200 }
      )
    })

    const result = await testProviderConnection({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: mockKeySample,
      modelId: 'google/gemini-2.5-flash',
      useLocalProxy: true,
    })

    expect(result.success).toBe(true)
    expect(capturedUrl).toBe('/api/byok-proxy')
    expect(capturedHeaders['x-target-url']).toBe(
      'https://openrouter.ai/api/v1/chat/completions'
    )
  })

  it('maps 401/403 authentication failures with actionable message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid credentials' } }), {
        status: 401,
        statusText: 'Unauthorized',
      })
    )

    const result = await testProviderConnection({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'gpt-4o-mini',
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('AUTH_FAILED')
    expect(result.errorMessage).toContain('Autentikasi gagal (401/403)')
    expect(result.errorMessage).toContain('Periksa kembali API Key Anda')
  })

  it('maps 404 endpoint or model not found failures with actionable message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Model not found' } }), {
        status: 404,
        statusText: 'Not Found',
      })
    )

    const result = await testProviderConnection({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'non-existent-model',
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NOT_FOUND')
    expect(result.errorMessage).toContain('Endpoint atau Model ID tidak ditemukan (404)')
    expect(result.errorMessage).toContain('/v1')
  })

  it('maps 429 rate limit or quota exceeded failures with actionable message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        statusText: 'Too Many Requests',
      })
    )

    const result = await testProviderConnection({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'gpt-4o-mini',
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMITED')
    expect(result.errorMessage).toContain('Batas kuota atau rate-limit tercapai (429)')
  })

  it('detects non-vision models directly from 400/422 response body containing vision keywords', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: 'Invalid parameter: image_url is not supported by model gpt-3.5-turbo',
            type: 'invalid_request_error',
          },
        }),
        { status: 400 }
      )
    )

    const result = await testProviderConnection({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'gpt-3.5-turbo',
    })

    expect(result.success).toBe(false)
    expect(result.visionSupported).toBe(false)
    expect(result.errorCode).toBe('VISION_UNSUPPORTED')
    expect(result.errorMessage).toContain('tidak mendukung input gambar (Vision)')
    expect(result.errorMessage).toContain('gpt-3.5-turbo')
  })

  it('performs 2-stage fallback probe when 400 error body is ambiguous but text probe succeeds', async () => {
    let callCount = 0
    let secondCallBody: ChatCompletionRequestBody | undefined
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      callCount++
      if (callCount === 1) {
        // Stage 1: Vision probe returns generic 400 Bad Request
        return new Response(JSON.stringify({ error: { message: 'Bad request' } }), {
          status: 400,
        })
      }
      // Stage 2: Text probe succeeds
      if (typeof init.body === 'string') {
        const parsed: unknown = JSON.parse(init.body)
        if (isChatCompletionRequestBody(parsed)) {
          secondCallBody = parsed
        }
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'OK' } }],
        }),
        { status: 200 }
      )
    })

    const result = await testProviderConnection({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'meta-llama/llama-3-8b-instruct',
    })

    expect(callCount).toBe(2)
    expect(result.success).toBe(false)
    expect(result.visionSupported).toBe(false)
    expect(result.errorCode).toBe('VISION_UNSUPPORTED')
    expect(result.errorMessage).toContain('tidak mendukung input gambar (Vision)')
    expect(result.errorMessage).toContain('meta-llama/llama-3-8b-instruct')
    expect(secondCallBody).toBeDefined()
    if (!secondCallBody) {
      throw new Error('Expected secondCallBody to be defined')
    }
    const userMsg = secondCallBody.messages.find((m: ChatMessage) => m.role === 'user')
    expect(typeof userMsg?.content).toBe('string')
  })

  it('maps CORS / Network failures (TypeError fetch failed) with actionable message', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await testProviderConnection({
      baseUrl: 'https://router.internal/v1',
      apiKey: mockKeySample,
      modelId: 'custom-model',
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('CORS_OR_NETWORK')
    expect(result.errorMessage).toContain('Gagal terhubung ke server (CORS / Network Error)')
  })

  it('maps timeout (>10 detik) accurately', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      const { promise, reject } = Promise.withResolvers<Response>()
      init.signal.addEventListener('abort', () => {
        const timeoutErr = new Error('The operation was aborted due to timeout')
        timeoutErr.name = 'TimeoutError'
        reject(timeoutErr)
      })
      return promise
    })

    const probePromise = testProviderConnection({
      baseUrl: 'https://slow-api.com/v1',
      apiKey: mockKeySample,
      modelId: 'gpt-4o',
      timeoutMs: 100, // short timeout for test
    })

    await vi.advanceTimersByTimeAsync(150)
    const result = await probePromise

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('TIMEOUT')
    expect(result.errorMessage).toContain('Waktu koneksi habis (>10 detik)')
  })

  it('handles external cancellation via AbortSignal without unhandled rejection', async () => {
    const controller = new AbortController()

    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      const { promise, reject } = Promise.withResolvers<Response>()
      init.signal.addEventListener('abort', () => {
        const abortErr = new Error('The operation was aborted')
        abortErr.name = 'AbortError'
        reject(abortErr)
      })
      return promise
    })

    const probePromise = testProviderConnection({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: mockKeySample,
      modelId: 'gpt-4o',
      signal: controller.signal,
    })

    controller.abort()
    const result = await probePromise

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('ABORTED')
    expect(result.errorMessage).toContain('dibatalkan')
  })
})
