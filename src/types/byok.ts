import type { KtpData } from './ktp'

export interface ByokProviderPreset {
  id: string
  name: string
  defaultBaseUrl: string
  defaultModel: string
  models: { id: string; label: string; description?: string }[]
  notes?: string
}

export interface ByokRegisteredProvider {
  id: string
  name: string
  baseUrl: string
  modelId: string
  apiKey: string
  persistApiKey: boolean
  useLocalProxy: boolean
  systemPrompt: string
  isVerified: boolean
  lastLatencyMs?: number
  lastUsedAt?: string
  isCustom?: boolean
}

export interface ByokStorageState {
  version: 1
  activeProviderId: string
  providers: ByokRegisteredProvider[]
}

export interface ByokConfig {
  baseUrl: string
  apiKey: string
  modelId: string
  temperature: number // Locked to 0 for deterministic output
  systemPrompt: string
  persistApiKey: boolean // If true, stored in sessionStorage; otherwise memory only
  useLocalProxy?: boolean // Gunakan Vite dev proxy untuk bypass CORS pada localhost
}

export interface ByokQualityCheck {
  isClear: boolean
  blurDetected: boolean
  glareDetected: boolean
  issues: string[]
}

export interface ByokExtractionResult {
  data: KtpData
  rawText: string
  qualityCheck: ByokQualityCheck
  meta: {
    modelUsed: string
    baseUrlUsed: string
    processingTimeMs: number
    nikValid: boolean
    confidence: number
    fallbackWithoutJsonFormatUsed?: boolean
  }
}

export type ByokErrorCode =
  | 'AUTH_FAILED' // 401, 403
  | 'NOT_FOUND' // 404
  | 'RATE_LIMITED' // 429
  | 'CORS_OR_NETWORK' // Failed to fetch / CORS blocked
  | 'VISION_UNSUPPORTED' // Model does not accept image_url
  | 'INVALID_JSON' // Model response could not be parsed as valid JSON e-KTP
  | 'TIMEOUT' // Request exceeded timeout deadline
  | 'ABORTED' // Request cancelled by user or unmount
  | 'UNKNOWN'
export interface ByokError {
  code: ByokErrorCode
  status?: number
  message: string
  details?: string
  rawError?: unknown
}

export interface ByokOptimizedImage {
  dataUrl: string
  blob: Blob
  originalWidth: number
  originalHeight: number
  width: number
  height: number
  originalSizeBytes: number
  optimizedSizeBytes: number
}
