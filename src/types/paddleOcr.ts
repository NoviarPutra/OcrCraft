import type { KtpData } from './ktp'

export type ExecutionProvider = 'wasm' | 'webgpu'

export type ModelAssetKey = 'det' | 'rec' | 'dict'

export type ModelLoadState =
  | 'idle'
  | 'checking'
  | 'cached'
  | 'downloading'
  | 'ready'
  | 'error'

export interface ModelAssetStatus {
  key: ModelAssetKey
  name: string
  state: ModelLoadState
  progressPercent: number
  loadedBytes: number
  totalBytes: number
  error?: string
  source: 'cache' | 'network' | 'local' | 'none'
}

export interface ModelManagerStatus {
  det: ModelAssetStatus
  rec: ModelAssetStatus
  dict: ModelAssetStatus
  allReady: boolean
}

export interface BoundingBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  polygon?: [number, number][]
  text: string
  confidence: number
  lineIndex?: number
  matchedField?: string
}

export type PipelineStage =
  | 'idle'
  | 'loading-model'
  | 'detecting-boxes'
  | 'recognizing-text'
  | 'parsing-ktp'
  | 'completed'
  | 'error'

export interface PipelineProgress {
  stage: PipelineStage
  message: string
  currentBox: number
  totalBoxes: number
  detTimeMs: number
  recTimeMs: number
  totalTimeMs: number
  error?: string
}

export interface PaddleOcrResult {
  boxes: BoundingBox[]
  rawText: string
  ktpData: KtpData
  metrics: {
    detTimeMs: number
    recTimeMs: number
    parseTimeMs: number
    totalTimeMs: number
  }
  providerUsed: ExecutionProvider
}

export interface ModelAssetFiles {
  detFile?: File | Blob | ArrayBuffer
  recFile?: File | Blob | ArrayBuffer
  dictFile?: File | Blob | string
}
