import type { ByokRegisteredProvider, ByokStorageState } from '../types/byok'
import { DEFAULT_BYOK_SYSTEM_PROMPT } from './byokPrompt'

export const BYOK_STORAGE_KEY = 'ocrcraft:byok:providers:v1'

export const DEFAULT_BYOK_PROVIDERS: ByokRegisteredProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI (Official)',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o-mini',
    apiKey: '',
    persistApiKey: true,
    useLocalProxy: false,
    systemPrompt: DEFAULT_BYOK_SYSTEM_PROMPT,
    isVerified: false,
    isCustom: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'google/gemini-2.5-flash',
    apiKey: '',
    persistApiKey: true,
    useLocalProxy: false,
    systemPrompt: DEFAULT_BYOK_SYSTEM_PROMPT,
    isVerified: false,
    isCustom: false,
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelId: 'llama-3.2-11b-vision-preview',
    apiKey: '',
    persistApiKey: true,
    useLocalProxy: false,
    systemPrompt: DEFAULT_BYOK_SYSTEM_PROMPT,
    isVerified: false,
    isCustom: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5-vl:7b',
    apiKey: '',
    persistApiKey: true,
    useLocalProxy: true,
    systemPrompt: DEFAULT_BYOK_SYSTEM_PROMPT,
    isVerified: false,
    isCustom: false,
  },
]

export function getDefaultStorageState(): ByokStorageState {
  return {
    version: 1,
    activeProviderId: 'openai',
    providers: DEFAULT_BYOK_PROVIDERS.map((p) => ({ ...p })),
  }
}

/**
 * Runtime Type Guard untuk ByokRegisteredProvider
 */
export function isValidProvider(item: unknown): item is ByokRegisteredProvider {
  if (!item || typeof item !== 'object') return false
  const p = item as Record<string, unknown>

  return (
    typeof p.id === 'string' &&
    p.id.trim().length > 0 &&
    typeof p.name === 'string' &&
    typeof p.baseUrl === 'string' &&
    typeof p.modelId === 'string' &&
    typeof p.apiKey === 'string' &&
    typeof p.persistApiKey === 'boolean' &&
    typeof p.useLocalProxy === 'boolean' &&
    typeof p.systemPrompt === 'string' &&
    typeof p.isVerified === 'boolean'
  )
}

/**
 * Runtime Type Guard untuk ByokStorageState
 */
export function isValidStorageState(data: unknown): data is ByokStorageState {
  if (!data || typeof data !== 'object') return false
  const s = data as Record<string, unknown>

  if (s.version !== 1) return false
  if (typeof s.activeProviderId !== 'string') return false
  if (!Array.isArray(s.providers) || s.providers.length === 0) return false

  return s.providers.every(isValidProvider)
}

/**
 * Membaca data provider dari localStorage secara sinkron dan aman.
 * Jika storage kosong, korup, atau skemanya tidak valid, jatuh secara anggun ke state default.
 */
export function loadByokStorage(): ByokStorageState {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return getDefaultStorageState()
  }

  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY)
    if (!raw) {
      return getDefaultStorageState()
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isValidStorageState(parsed)) {
      return getDefaultStorageState()
    }

    // Pastikan activeProviderId benar-benar ada di daftar providers
    const activeExists = parsed.providers.some((p) => p.id === parsed.activeProviderId)
    if (!activeExists) {
      parsed.activeProviderId = parsed.providers[0].id
    }

    return parsed
  } catch {
    return getDefaultStorageState()
  }
}

/**
 * Menyimpan data provider dan activeProviderId ke localStorage.
 * Menghormati pengaturan persistApiKey (jika false, API key tidak ditulis ke disk).
 */
export function saveByokStorage(state: ByokStorageState): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    // Sanitasi: Kosongkan API key untuk provider yang memilih tidak menyimpan key di perangkat
    const sanitizedProviders = state.providers.map((p) => {
      if (!p.persistApiKey) {
        return { ...p, apiKey: '' }
      }
      return p
    })

    const payload: ByokStorageState = {
      version: 1,
      activeProviderId: state.activeProviderId,
      providers: sanitizedProviders,
    }

    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    // Fail-safe jika localStorage penuh (QuotaExceededError) atau private browsing mode
    console.warn('Gagal menyimpan konfigurasi BYOK ke localStorage:', err)
  }
}

/**
 * Membersihkan seluruh konfigurasi BYOK dari localStorage.
 */
export function clearByokStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(BYOK_STORAGE_KEY)
  } catch {
    // ignore
  }
}
