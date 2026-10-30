import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ByokRegisteredProvider } from '../types/byok'
import {
  BYOK_STORAGE_KEY,
  getDefaultStorageState,
  loadByokStorage,
} from '../utils/byokStorage'

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

describe('BYOK Provider Verification Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists verification status and latency to storage', () => {
    const initialState = getDefaultStorageState()
    expect(initialState.providers.length).toBeGreaterThan(0)
    const targetProvider = initialState.providers[0]
    expect(targetProvider.isVerified).toBe(false)

    // Simulate saving verified state
    const verifiedProvider: ByokRegisteredProvider = {
      ...targetProvider,
      isVerified: true,
      lastLatencyMs: 245,
      lastUsedAt: new Date().toISOString(),
    }

    const nextState = {
      ...initialState,
      providers: initialState.providers.map((p) =>
        p.id === targetProvider.id ? verifiedProvider : p
      ),
    }

    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(nextState))

    // Re-hydrate from storage
    const loaded = loadByokStorage()
    const rehydratedProvider = loaded.providers.find((p) => p.id === targetProvider.id)
    expect(rehydratedProvider).toBeDefined()
    expect(rehydratedProvider?.isVerified).toBe(true)
    expect(rehydratedProvider?.lastLatencyMs).toBe(245)
  })

  it('persists unverified status when provider configuration is modified', () => {
    const initialState = getDefaultStorageState()
    const targetProvider = initialState.providers[0]

    // First mark verified
    const verifiedState = {
      ...initialState,
      providers: initialState.providers.map((p) =>
        p.id === targetProvider.id ? { ...p, isVerified: true, lastLatencyMs: 320 } : p
      ),
    }
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(verifiedState))

    // Now user modifies the provider (invalidates verification)
    const modifiedProvider: ByokRegisteredProvider = {
      ...targetProvider,
      baseUrl: 'https://new-api.example.com/v1',
      isVerified: false,
      lastLatencyMs: undefined,
    }

    const unverifiedState = {
      ...initialState,
      providers: verifiedState.providers.map((p) =>
        p.id === targetProvider.id ? modifiedProvider : p
      ),
    }
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(unverifiedState))

    const loaded = loadByokStorage()
    const reloaded = loaded.providers.find((p) => p.id === targetProvider.id)
    expect(reloaded?.isVerified).toBe(false)
    expect(reloaded?.lastLatencyMs).toBeUndefined()
  })
})
