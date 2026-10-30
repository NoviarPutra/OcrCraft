import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type { ByokRegisteredProvider } from '../../../types/byok'
import { DEFAULT_BYOK_SYSTEM_PROMPT } from '../../../utils/byokPrompt'
import { testProviderConnection } from '../../../utils/testProviderConnection'

export interface ByokSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  providers: ByokRegisteredProvider[]
  activeProviderId: string
  onSelectProvider: (providerId: string) => void
  onSaveProvider: (provider: ByokRegisteredProvider) => void
  onDeleteProvider: (providerId: string) => void
  onMarkVerified?: (providerId: string, latencyMs?: number) => void
  onMarkUnverified?: (providerId: string) => void
}

interface ProviderFormProps {
  provider: ByokRegisteredProvider
  isCreatingNew: boolean
  onSave: (provider: ByokRegisteredProvider) => void
  onDelete: (id: string) => void
  onCancel: () => void
  onMarkVerified?: (providerId: string, latencyMs?: number) => void
  onMarkUnverified?: (providerId: string) => void
}

function ProviderForm({
  provider,
  isCreatingNew,
  onSave,
  onDelete,
  onCancel,
  onMarkVerified,
  onMarkUnverified,
}: ProviderFormProps) {
  const [name, setName] = useState(provider.name)
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl)
  const [apiKey, setApiKey] = useState(provider.apiKey)
  const [modelId, setModelId] = useState(provider.modelId)
  const [persistApiKey, setPersistApiKey] = useState(provider.persistApiKey ?? true)
  const [useLocalProxy, setUseLocalProxy] = useState(provider.useLocalProxy ?? false)
  const [systemPrompt, setSystemPrompt] = useState(
    provider.systemPrompt || DEFAULT_BYOK_SYSTEM_PROMPT
  )

  const [isVerified, setIsVerified] = useState(provider.isVerified ?? false)
  const [lastLatencyMs, setLastLatencyMs] = useState<number | undefined>(provider.lastLatencyMs)
  const [connectionState, setConnectionState] = useState<'idle' | 'testing' | 'success' | 'error'>(
    provider.isVerified ? 'success' : 'idle'
  )
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null)

  const [showApiKey, setShowApiKey] = useState(false)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  const testAbortControllerRef = useRef<AbortController | null>(null)

  // Cleanup controller on unmount (zero memory leak / dangling request)
  useEffect(() => {
    return () => {
      if (testAbortControllerRef.current) {
        testAbortControllerRef.current.abort()
        testAbortControllerRef.current = null
      }
    }
  }, [])

  const invalidateVerification = () => {
    // Batalkan pengujian yang sedang berjalan jika konfigurasi diubah
    if (testAbortControllerRef.current) {
      testAbortControllerRef.current.abort()
      testAbortControllerRef.current = null
    }

    if (connectionState !== 'idle' || isVerified) {
      setConnectionState('idle')
      setIsVerified(false)
      setTestErrorMessage(null)
      if (!isCreatingNew && provider.id && onMarkUnverified) {
        onMarkUnverified(provider.id)
      }
    }
  }

  const handleBaseUrlChange = (val: string) => {
    setBaseUrl(val)
    invalidateVerification()
  }

  const handleApiKeyChange = (val: string) => {
    setApiKey(val)
    invalidateVerification()
  }

  const handleModelIdChange = (val: string) => {
    setModelId(val)
    invalidateVerification()
  }

  const handleProxyChange = (checked: boolean) => {
    setUseLocalProxy(checked)
    invalidateVerification()
  }

  const handleTestConnection = async () => {
    if (testAbortControllerRef.current) {
      testAbortControllerRef.current.abort()
    }
    const controller = new AbortController()
    testAbortControllerRef.current = controller

    setConnectionState('testing')
    setTestErrorMessage(null)

    const result = await testProviderConnection({
      baseUrl: baseUrl.trim() || 'https://api.openai.com/v1',
      apiKey: apiKey.trim(),
      modelId: modelId.trim() || 'gpt-4o-mini',
      useLocalProxy,
      signal: controller.signal,
    })

    if (controller.signal.aborted || testAbortControllerRef.current !== controller) {
      return
    }

    if (result.success && result.visionSupported) {
      setConnectionState('success')
      setIsVerified(true)
      setLastLatencyMs(result.latencyMs)
      if (!isCreatingNew && provider.id && onMarkVerified) {
        onMarkVerified(provider.id, result.latencyMs)
      }
    } else {
      setConnectionState('error')
      setIsVerified(false)
      setTestErrorMessage(result.errorMessage ?? 'Gagal terhubung ke provider.')
    }
  }

  const handleResetPrompt = () => {
    setSystemPrompt(DEFAULT_BYOK_SYSTEM_PROMPT)
  }

  const handleCancelClick = () => {
    if (testAbortControllerRef.current) {
      testAbortControllerRef.current.abort()
      testAbortControllerRef.current = null
    }
    onCancel()
  }

  const handleFormSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    if (testAbortControllerRef.current) {
      testAbortControllerRef.current.abort()
      testAbortControllerRef.current = null
    }
    onSave({
      id: provider.id,
      name: name.trim() || 'Provider Kustom',
      baseUrl: baseUrl.trim() || 'https://api.openai.com/v1',
      modelId: modelId.trim() || 'gpt-4o-mini',
      apiKey: apiKey.trim(),
      persistApiKey,
      useLocalProxy,
      systemPrompt: systemPrompt.trim() || DEFAULT_BYOK_SYSTEM_PROMPT,
      isVerified,
      lastLatencyMs,
      isCustom: isCreatingNew || provider.isCustom,
    })
  }
  const handleDeleteClick = () => {
    if (confirm(`Hapus dan lupakan konfigurasi provider "${provider.name}" dari perangkat ini?`)) {
      onDelete(provider.id)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/90 flex flex-col gap-3.5">
        {/* Status Provider Banner */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px]">
          <div className="flex items-center gap-1.5">
            {isVerified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Terverifikasi
                {lastLatencyMs && ` (${lastLatencyMs}ms)`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                Belum Terverifikasi
              </span>
            )}
          </div>
          {provider.id !== 'openai' && !isCreatingNew && (
            <button
              type="button"
              data-testid="forget-provider-btn"
              onClick={handleDeleteClick}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Hapus / Forget Provider</span>
            </button>
          )}
        </div>

        {/* Nama Provider */}
        <div className="flex flex-col gap-1">
          <label htmlFor="byok-provider-name" className="font-semibold text-slate-300">
            Nama Label Provider
          </label>
          <input
            id="byok-provider-name"
            data-testid="byok-provider-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: OpenAI, Groq, LiteLLM, Ollama"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
          />
        </div>

        {/* Base URL */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor="byok-base-url" className="font-semibold text-slate-300">
              Base URL
            </label>
            <span className="text-[10px] text-slate-500">
              Otomatis dinormalkan ke /chat/completions
            </span>
          </div>
          <input
            id="byok-base-url"
            data-testid="byok-base-url"
            type="text"
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
          />
        </div>

        {/* API Key Input + Persist Checkbox */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="byok-api-key" className="font-semibold text-slate-300">
              API Key
            </label>
            {persistApiKey ? (
              <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Tersimpan di localStorage
              </span>
            ) : (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Memori Saja (Zero-Persistence)
              </span>
            )}
          </div>
          <div className="relative">
            <input
              id="byok-api-key"
              data-testid="byok-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-..."
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
              aria-label={showApiKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
            >
              {showApiKey ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Toggle Ingat API Key */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="persist-api-key-checkbox"
                checked={persistApiKey}
                onChange={(e) => setPersistApiKey(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-slate-300 font-medium text-[11px]">
                Ingat API Key di perangkat ini
              </span>
            </label>
            <span className="text-[10px] text-slate-500">
              {persistApiKey ? 'Siap pakai setelah reload' : 'Hilang saat refresh'}
            </span>
          </div>
        </div>

        {/* Model ID */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="byok-model-id" className="font-semibold text-slate-300">
              Model ID
            </label>
            <span className="text-[10px] text-slate-500">Model Multimodal Vision</span>
          </div>
          <input
            id="byok-model-id"
            data-testid="byok-model-id"
            type="text"
            value={modelId}
            onChange={(e) => handleModelIdChange(e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
          />
          {/* Quick Model Pills */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[
              'gpt-4o-mini',
              'gpt-4o',
              'google/gemini-2.5-flash',
              'qwen/qwen2.5-vl-72b-instruct',
              'meta-llama/llama-3.2-11b-vision-instruct',
            ].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModelIdChange(m)}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  modelId === m
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Temperature (Locked to 0) */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <div>
              <div className="font-semibold text-slate-200 text-[11px]">
                Temperature: 0.0
              </div>
              <div className="text-[10px] text-slate-400">
                Deterministik untuk ekstraksi KTP konsisten.
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-mono">
            Locked
          </span>
        </div>

        {/* Dev Proxy Toggle (Bypass CORS) */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-200 text-[11px]">
                Dev Proxy Lokal (Bypass CORS)
              </div>
              <div className="text-[10px] text-slate-400">
                Forward request lewat Vite dev proxy untuk router yang menolak browser CORS.
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              data-testid="use-local-proxy-checkbox"
              checked={useLocalProxy}
              onChange={(e) => handleProxyChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600" />
          </label>
        </div>

        {/* System Prompt Inspector */}
        <div className="border border-slate-800/80 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPromptEditor(!showPromptEditor)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/90 text-slate-300 hover:text-white transition-colors text-left"
          >
            <span className="font-semibold text-[11px]">Lihat / Kustomisasi System Prompt e-KTP</span>
            {showPromptEditor ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          {showPromptEditor && (
            <div className="p-3 bg-slate-950 flex flex-col gap-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Instruksi detail untuk vision model mengekstrak field e-KTP secara terstruktur.
                </span>
                <button
                  type="button"
                  onClick={handleResetPrompt}
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Kembalikan Default</span>
                </button>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded text-slate-300 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
              />
            </div>
          )}
        </div>
        {/* Test Connection Bar */}
        <div className="mt-1">
          {connectionState === 'idle' && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Uji Koneksi Provider
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    Ping 1x1 piksel gambar untuk memverifikasi endpoint &amp; kapabilitas Vision
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="test-connection-btn"
                onClick={handleTestConnection}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 ml-2 shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-200" />
                <span>Test Connection</span>
              </button>
            </div>
          )}

          {connectionState === 'testing' && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                <span className="text-[11px] font-medium text-indigo-200 truncate">
                  Menguji koneksi &amp; kapabilitas Vision...
                </span>
              </div>
              <button
                type="button"
                data-testid="test-connection-btn"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300/60 border border-indigo-500/20 font-semibold text-xs opacity-70 cursor-not-allowed shrink-0 ml-2"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menguji...</span>
              </button>
            </div>
          )}

          {connectionState === 'success' && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-w-0">
                  <span className="font-semibold text-emerald-300">
                    ✓ Terhubung {lastLatencyMs !== undefined ? `(${lastLatencyMs} ms)` : ''} — Vision Ready
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-mono truncate">
                    ({modelId.trim() || 'gpt-4o-mini'})
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="test-connection-btn"
                onClick={handleTestConnection}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                title="Uji ulang koneksi"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span>Test Ulang</span>
              </button>
            </div>
          )}

          {connectionState === 'error' && (
            <div
              role="alert"
              className="flex flex-col gap-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-semibold text-rose-200">
                      Koneksi / Uji Vision Gagal
                    </span>
                    <span className="text-[11px] text-rose-300/90 leading-relaxed">
                      {testErrorMessage}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="test-connection-btn"
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 border border-rose-700/60 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 text-rose-300" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0">
        <div className="text-[11px] text-slate-500">
          {persistApiKey ? 'Tersimpan otomatis ke storage lokal' : 'Hanya disimpan di memori'}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer text-xs font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="byok-save-config-btn"
            onClick={() => handleFormSubmit()}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold shadow-lg transition-all cursor-pointer text-xs ${
              isVerified
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            {isVerified ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>
              {isVerified ? 'Simpan & Terapkan (Terverifikasi)' : 'Simpan & Terapkan'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function ByokSettingsDrawer({
  isOpen,
  onClose,
  providers,
  activeProviderId,
  onSelectProvider,
  onSaveProvider,
  onDeleteProvider,
  onMarkVerified,
  onMarkUnverified,
}: ByokSettingsDrawerProps) {
  const [selectedId, setSelectedId] = useState<string>(activeProviderId)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  if (!isOpen) return null

  const handleSelectTab = (provId: string) => {
    setIsCreatingNew(false)
    setSelectedId(provId)
    onSelectProvider(provId)
  }

  const handleStartCreateNew = () => {
    setIsCreatingNew(true)
    const newId = `custom-${Date.now().toString(36)}`
    setSelectedId(newId)
  }

  const handleSaveAndClose = (providerToSave: ByokRegisteredProvider) => {
    onSaveProvider(providerToSave)
    setIsCreatingNew(false)
    setSelectedId(providerToSave.id)
    onClose()
  }

  const handleDeleteAndNext = (idToDelete: string) => {
    onDeleteProvider(idToDelete)
    setIsCreatingNew(false)
    // Switch to first remaining provider
    const remaining = providers.filter((p) => p.id !== idToDelete)
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id)
    }
  }

  // Current editing provider object
  const currentProvider: ByokRegisteredProvider = isCreatingNew
    ? {
        id: selectedId,
        name: 'Router Kustom',
        baseUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o-mini',
        apiKey: '',
        persistApiKey: true,
        useLocalProxy: true,
        systemPrompt: DEFAULT_BYOK_SYSTEM_PROMPT,
        isVerified: false,
        isCustom: true,
      }
    : providers.find((p) => p.id === selectedId) ??
      providers.find((p) => p.id === activeProviderId) ??
      providers[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="byok-settings-title"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="byok-settings-title"
                className="text-sm sm:text-base font-bold text-slate-100"
              >
                Pengaturan Provider BYOK Vision OCR
              </h2>
              <p className="text-xs text-slate-400">
                Kelola endpoint OpenAI-Compatible &amp; persistensi lokal perangkat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Tutup pengaturan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Daftar Provider Terdaftar & Tambah Baru */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300">
                Provider Terdaftar ({providers.length})
              </label>
              <button
                type="button"
                data-testid="add-new-provider-btn"
                onClick={handleStartCreateNew}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Provider</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {providers.map((p) => {
                const isSelected = !isCreatingNew && (selectedId === p.id || (!selectedId && p.id === activeProviderId))
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`provider-pill-${p.id}`}
                    onClick={() => handleSelectTab(p.id)}
                    className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-1 relative ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-100 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="font-semibold truncate text-xs">{p.name}</span>
                      {p.isVerified ? (
                        <span
                          title="Terverifikasi"
                          className="inline-flex items-center text-emerald-400 shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      ) : p.apiKey ? (
                        <span
                          title="API Key Tersimpan"
                          className="w-2 h-2 rounded-full bg-blue-400 shrink-0"
                        />
                      ) : (
                        <span
                          title="Belum Terverifikasi"
                          className="w-2 h-2 rounded-full bg-slate-600 shrink-0"
                        />
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 truncate w-full">
                      {p.modelId}
                    </div>
                    {p.isVerified && p.lastLatencyMs && (
                      <div className="text-[9px] text-emerald-400/90 flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5" /> {p.lastLatencyMs}ms
                      </div>
                    )}
                  </button>
                )
              })}

              {isCreatingNew && (
                <div className="p-2 rounded-xl text-left border bg-indigo-600/20 border-indigo-500/60 text-indigo-100 shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold truncate text-xs">Provider Baru</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/20 text-indigo-300">
                      Draft
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Kustom</div>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields untuk Provider yang Dipilih (Keyed by ID to cleanly reset form state without useEffect) */}
          <ProviderForm
            key={isCreatingNew ? `new-${selectedId}` : currentProvider.id}
            provider={currentProvider}
            isCreatingNew={isCreatingNew}
            onSave={handleSaveAndClose}
            onDelete={handleDeleteAndNext}
            onCancel={onClose}
            onMarkVerified={onMarkVerified}
            onMarkUnverified={onMarkUnverified}
          />
        </div>
      </div>
    </div>
  )
}
