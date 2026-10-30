import { useCallback, useMemo, useState } from 'react'
import type { ByokConfig, ByokRegisteredProvider, ByokStorageState } from '../types/byok'
import {
  clearByokStorage,
  DEFAULT_BYOK_PROVIDERS,
  getDefaultStorageState,
  loadByokStorage,
  saveByokStorage,
} from '../utils/byokStorage'

export interface UseByokProvidersReturn {
  providers: ByokRegisteredProvider[]
  activeProviderId: string
  activeProvider: ByokRegisteredProvider
  activeConfig: ByokConfig
  selectProvider: (providerId: string) => void
  saveProvider: (provider: ByokRegisteredProvider) => void
  deleteProvider: (providerId: string) => void
  markProviderVerified: (providerId: string, latencyMs?: number) => void
  markProviderUnverified: (providerId: string) => void
  resetToDefaults: () => void
}

export function useByokProviders(): UseByokProvidersReturn {
  // 1. Lazy State Initialization (Sinkron pada first render, anti race-condition useEffect)
  const [storageState, setStorageState] = useState<ByokStorageState>(() => loadByokStorage())

  const providers = storageState.providers
  const activeProviderId = storageState.activeProviderId

  const activeProvider = useMemo(() => {
    return (
      providers.find((p) => p.id === activeProviderId) ??
      providers[0] ??
      DEFAULT_BYOK_PROVIDERS[0]
    )
  }, [providers, activeProviderId])

  const activeConfig = useMemo<ByokConfig>(() => {
    return {
      baseUrl: activeProvider.baseUrl,
      apiKey: activeProvider.apiKey,
      modelId: activeProvider.modelId,
      temperature: 0,
      systemPrompt: activeProvider.systemPrompt,
      persistApiKey: activeProvider.persistApiKey,
      useLocalProxy: activeProvider.useLocalProxy,
    }
  }, [activeProvider])

  // 2. Pilih Provider Aktif
  const selectProvider = useCallback((providerId: string) => {
    setStorageState((prev) => {
      const exists = prev.providers.some((p) => p.id === providerId)
      if (!exists) return prev

      const nextState: ByokStorageState = {
        ...prev,
        activeProviderId: providerId,
      }
      saveByokStorage(nextState)
      return nextState
    })
  }, [])

  // 3. Simpan / Registrasi Provider (Update atau Tambah Baru)
  const saveProvider = useCallback((provider: ByokRegisteredProvider) => {
    setStorageState((prev) => {
      const existingIndex = prev.providers.findIndex((p) => p.id === provider.id)
      let nextProviders: ByokRegisteredProvider[]

      if (existingIndex >= 0) {
        // Update existing
        nextProviders = prev.providers.map((p, idx) =>
          idx === existingIndex ? { ...p, ...provider, lastUsedAt: new Date().toISOString() } : p
        )
      } else {
        // Add new provider
        nextProviders = [
          ...prev.providers,
          { ...provider, lastUsedAt: new Date().toISOString() },
        ]
      }

      const nextState: ByokStorageState = {
        version: 1,
        activeProviderId: provider.id,
        providers: nextProviders,
      }

      saveByokStorage(nextState)
      return nextState
    })
  }, [])

  // 4. Hapus / Forget Provider
  const deleteProvider = useCallback((providerId: string) => {
    setStorageState((prev) => {
      // Saring provider yang dihapus
      const nextProviders = prev.providers.filter((p) => p.id !== providerId)

      // Fail-safe: jika semua terhapus, kembalikan ke default
      if (nextProviders.length === 0) {
        const defaultState = getDefaultStorageState()
        saveByokStorage(defaultState)
        return defaultState
      }

      // Jika provider yang sedang aktif dihapus, beralih ke provider pertama yang tersisa
      const nextActiveId =
        prev.activeProviderId === providerId ? nextProviders[0].id : prev.activeProviderId

      const nextState: ByokStorageState = {
        version: 1,
        activeProviderId: nextActiveId,
        providers: nextProviders,
      }

      saveByokStorage(nextState)
      return nextState
    })
  }, [])

  // 5. Tandai Provider Terverifikasi (Setelah Tes Koneksi atau Ekstraksi Sukses)
  const markProviderVerified = useCallback((providerId: string, latencyMs?: number) => {
    setStorageState((prev) => {
      const nextProviders = prev.providers.map((p) => {
        if (p.id === providerId) {
          return {
            ...p,
            isVerified: true,
            lastLatencyMs: latencyMs ?? p.lastLatencyMs,
            lastUsedAt: new Date().toISOString(),
          }
        }
        return p
      })

      const nextState: ByokStorageState = {
        ...prev,
        providers: nextProviders,
      }

      saveByokStorage(nextState)
      return nextState
    })
  }, [])

  // 6. Tandai Provider Belum Terverifikasi (Saat konfigurasi diubah user)
  const markProviderUnverified = useCallback((providerId: string) => {
    setStorageState((prev) => {
      const nextProviders = prev.providers.map((p) => {
        if (p.id === providerId) {
          return {
            ...p,
            isVerified: false,
          }
        }
        return p
      })

      const nextState: ByokStorageState = {
        ...prev,
        providers: nextProviders,
      }

      saveByokStorage(nextState)
      return nextState
    })
  }, [])
  // 6. Reset ke Pengaturan Awal
  const resetToDefaults = useCallback(() => {
    clearByokStorage()
    const def = getDefaultStorageState()
    setStorageState(def)
  }, [])

  return {
    providers,
    activeProviderId,
    activeProvider,
    activeConfig,
    selectProvider,
    saveProvider,
    deleteProvider,
    markProviderVerified,
    markProviderUnverified,
    resetToDefaults,
  }
}
