import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ByokRegisteredProvider, ByokStorageState } from '../types/byok'
import {
  BYOK_STORAGE_KEY,
  clearByokStorage,
  getDefaultStorageState,
  isValidProvider,
  isValidStorageState,
  loadByokStorage,
  saveByokStorage,
} from './byokStorage'

const sampleKeyA = ['test', 'key', 'sample'].join('-')
const sampleKeyB = ['transient', 'memory', 'val'].join('-')

class LocalStorageMock {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

const mockStorage = new LocalStorageMock()
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
})

describe('byokStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getDefaultStorageState', () => {
    it('returns default state with openai as active and 4 presets', () => {
      const state = getDefaultStorageState()
      expect(state.version).toBe(1)
      expect(state.activeProviderId).toBe('openai')
      expect(state.providers.length).toBeGreaterThanOrEqual(4)
      expect(state.providers.map((p) => p.id)).toContain('openai')
      expect(state.providers.map((p) => p.id)).toContain('openrouter')
    })
  })

  describe('Type Guards', () => {
    it('validates a correct ByokRegisteredProvider', () => {
      const valid: ByokRegisteredProvider = {
        id: 'test-router',
        name: 'Custom Router',
        baseUrl: 'https://router.example.com/v1',
        modelId: 'qwen2.5-vl',
        apiKey: sampleKeyA,
        persistApiKey: true,
        useLocalProxy: false,
        systemPrompt: 'prompt',
        isVerified: true,
      }
      expect(isValidProvider(valid)).toBe(true)
    })

    it('rejects incomplete or malformed provider objects', () => {
      expect(isValidProvider(null)).toBe(false)
      expect(isValidProvider({})).toBe(false)
      expect(isValidProvider({ id: '', name: 'Empty ID' })).toBe(false)
      expect(isValidProvider({ id: '1', name: 'No Base', modelId: 'm' })).toBe(false)
      expect(
        isValidProvider({
          id: '1',
          name: 'p',
          baseUrl: 'http',
          modelId: 'm',
          apiKey: 123, // wrong type
        })
      ).toBe(false)
    })

    it('validates a correct ByokStorageState', () => {
      const state = getDefaultStorageState()
      expect(isValidStorageState(state)).toBe(true)
    })

    it('rejects malformed storage state', () => {
      expect(isValidStorageState(null)).toBe(false)
      expect(isValidStorageState({ version: 2 })).toBe(false)
      expect(isValidStorageState({ version: 1, activeProviderId: 'x', providers: [] })).toBe(false)
      expect(
        isValidStorageState({
          version: 1,
          activeProviderId: 'x',
          providers: [{ bad: 'item' }],
        })
      ).toBe(false)
    })
  })

  describe('loadByokStorage & saveByokStorage', () => {
    it('returns default state when localStorage is empty', () => {
      const loaded = loadByokStorage()
      expect(loaded.activeProviderId).toBe('openai')
      expect(loaded.providers.length).toBeGreaterThan(0)
    })

    it('persists and reloads registered provider and activeProviderId', () => {
      const initial = getDefaultStorageState()
      const customProvider: ByokRegisteredProvider = {
        id: 'custom-omeg4mon',
        name: 'Omeg4mon Router',
        baseUrl: 'https://router.omeg4mon.my.id/v1',
        modelId: 'qwen/qwen2.5-vl-72b-instruct',
        apiKey: sampleKeyA,
        persistApiKey: true,
        useLocalProxy: true,
        systemPrompt: 'custom prompt',
        isVerified: true,
        lastLatencyMs: 142,
        isCustom: true,
      }

      const updatedState: ByokStorageState = {
        version: 1,
        activeProviderId: 'custom-omeg4mon',
        providers: [...initial.providers, customProvider],
      }

      saveByokStorage(updatedState)

      const reloaded = loadByokStorage()
      expect(reloaded.activeProviderId).toBe('custom-omeg4mon')
      expect(reloaded.providers).toHaveLength(initial.providers.length + 1)

      const found = reloaded.providers.find((p) => p.id === 'custom-omeg4mon')
      expect(found).toBeDefined()
      expect(found?.baseUrl).toBe('https://router.omeg4mon.my.id/v1')
      expect(found?.apiKey).toBe(sampleKeyA)
      expect(found?.isVerified).toBe(true)
      expect(found?.lastLatencyMs).toBe(142)
    })

    it('strips API key from disk if persistApiKey is false', () => {
      const initial = getDefaultStorageState()
      const noPersistProvider: ByokRegisteredProvider = {
        id: 'temp-provider',
        name: 'Temporary Provider',
        baseUrl: 'https://temp.example.com/v1',
        modelId: 'gpt-4o',
        apiKey: sampleKeyB,
        persistApiKey: false,
        useLocalProxy: false,
        systemPrompt: 'prompt',
        isVerified: false,
      }

      const stateToSave: ByokStorageState = {
        version: 1,
        activeProviderId: 'temp-provider',
        providers: [...initial.providers, noPersistProvider],
      }

      saveByokStorage(stateToSave)

      // Raw localStorage text verification
      const rawStored = localStorage.getItem(BYOK_STORAGE_KEY)
      expect(rawStored).not.toContain(sampleKeyB)

      const reloaded = loadByokStorage()
      const reloadedProvider = reloaded.providers.find((p) => p.id === 'temp-provider')
      expect(reloadedProvider?.apiKey).toBe('')
    })

    it('recovers gracefully from corrupt JSON in localStorage without throwing', () => {
      localStorage.setItem(BYOK_STORAGE_KEY, 'CORRUPT_JSON_{invalid...[')

      expect(() => {
        const loaded = loadByokStorage()
        expect(loaded.version).toBe(1)
        expect(loaded.activeProviderId).toBe('openai')
        expect(loaded.providers.length).toBeGreaterThan(0)
      }).not.toThrow()
    })

    it('recovers gracefully from invalid schema data in localStorage', () => {
      localStorage.setItem(
        BYOK_STORAGE_KEY,
        JSON.stringify({ version: 999, weirdField: 'malicious' })
      )

      const loaded = loadByokStorage()
      expect(loaded.version).toBe(1)
      expect(loaded.activeProviderId).toBe('openai')
    })

    it('falls back to first available provider if activeProviderId does not exist in providers', () => {
      const state = getDefaultStorageState()
      state.activeProviderId = 'non-existent-id'
      localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(state))

      const loaded = loadByokStorage()
      expect(loaded.activeProviderId).toBe(state.providers[0].id)
    })

    it('completely clears storage when clearByokStorage is called', () => {
      saveByokStorage(getDefaultStorageState())
      expect(localStorage.getItem(BYOK_STORAGE_KEY)).not.toBeNull()

      clearByokStorage()
      expect(localStorage.getItem(BYOK_STORAGE_KEY)).toBeNull()
    })
  })
})
