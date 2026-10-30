import type { KtpData } from '../types/ktp'
import type { BoundingBox } from '../types/paddleOcr'
import { parseKtpText, recoverLexicalSpacing } from './ktpParser'
import { sortBoundingBoxesSpatially } from './spatialSorter'

export interface RapidKtpAddress {
  jalan: string
  rt_rw: string
  kel_desa: string
  kecamatan: string
}

export interface RapidKtpStandardJson {
  nik: string
  nama: string
  tempat_lahir: string
  tanggal_lahir: string
  jenis_kelamin: string
  alamat: RapidKtpAddress
  agama: string
  status_perkawinan: string
  pekerjaan: string
  kewarganegaraan: string
}

export interface RapidOcrInputData {
  boxes?: number[][][] | unknown[]
  txts?: string[]
  scores?: number[]
  raw_text?: string
}

export interface RapidKtpParseResult {
  standardJson: RapidKtpStandardJson
  ktpData: KtpData
  rawText: string
  confidence: number
  annotatedBoxes: BoundingBox[]
}

/**
 * Normalizes full-width and irregular colons (：, ；, ;, etc.) into standard single colons with clean spacing.
 */
export function normalizeColons(text: string): string {
  if (!text) return ''
  return text
    .replace(/[\uFF1A]/g, ' : ')
    .replace(/[\uFF1B;]/g, ' : ')
    .replace(/\s*:\s*/g, ' : ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Parse output from RapidOCR backend (boxes, txts, scores) into standard e-KTP JSON and UI KtpData.
 */
export function parseRapidOcrResponse(input: RapidOcrInputData): RapidKtpParseResult {
  const { boxes = [], txts = [], scores = [], raw_text } = input

  // 1. Build BoundingBox items from polygon arrays if present
  const boundingBoxes: BoundingBox[] = []
  for (let i = 0; i < boxes.length; i++) {
    const poly = boxes[i]
    const text = txts[i] ?? ''
    const score = scores[i] ?? 0.95
    const isValidPoly =
      Array.isArray(poly) &&
      poly.length >= 4 &&
      poly.every(
        (pt) =>
          Array.isArray(pt) &&
          pt.length >= 2 &&
          typeof pt[0] === 'number' &&
          Number.isFinite(pt[0]) &&
          typeof pt[1] === 'number' &&
          Number.isFinite(pt[1])
      )

    if (isValidPoly) {
      const xs = poly.map((pt) => pt[0])
      const ys = poly.map((pt) => pt[1])
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)

      boundingBoxes.push({
        id: `rapid-box-${i}`,
        x: Math.round(minX),
        y: Math.round(minY),
        w: Math.round(maxX - minX),
        h: Math.round(maxY - minY),
        polygon: poly.map((pt) => [pt[0], pt[1]] as [number, number]),
        text,
        confidence: score,
      })
    }
  }

  // 2. Reconstruct text lines
  let textLines: string[] = []

  if (boundingBoxes.length > 0) {
    const sortedBoxes = sortBoundingBoxesSpatially(boundingBoxes, {
      yThresholdRatio: 0.5,
      filterPhotoZone: true,
    })

    const linesMap = new Map<number, typeof sortedBoxes>()
    for (const box of sortedBoxes) {
      const idx = box.lineIndex ?? 0
      if (!linesMap.has(idx)) {
        linesMap.set(idx, [])
      }
      linesMap.get(idx)!.push(box)
    }

    const sortedIndices = Array.from(linesMap.keys()).sort((a, b) => a - b)
    for (const idx of sortedIndices) {
      const lineBoxes = linesMap.get(idx)!
      const lineStr = lineBoxes
        .map((b) => recoverLexicalSpacing(b.text.trim()))
        .filter((s) => s.length > 0)
        .join(' ')
      if (lineStr.trim()) {
        textLines.push(normalizeColons(lineStr))
      }
    }
  } else if (txts.length > 0) {
    textLines = txts.map((t) => normalizeColons(recoverLexicalSpacing(t)))
  } else if (raw_text) {
    textLines = raw_text
      .split('\n')
      .map((t) => normalizeColons(recoverLexicalSpacing(t)))
      .filter((t) => t.trim().length > 0)
  }

  const assembledText = textLines.join('\n')

  // 3. Compute overall confidence score
  let avgConfidence = 0
  const validScores = scores.filter(
    (s): s is number => typeof s === 'number' && Number.isFinite(s)
  )
  if (validScores.length > 0) {
    const sum = validScores.reduce((acc, val) => acc + val, 0)
    avgConfidence = Math.round((sum / validScores.length) * 100)
  } else if (assembledText.trim()) {
    avgConfidence = 95
  }
  const parsed = parseKtpText(assembledText, avgConfidence, 0)

  // 5. Structure as standard e-KTP JSON
  const standardJson: RapidKtpStandardJson = {
    nik: parsed.data.nik,
    nama: parsed.data.nama,
    tempat_lahir: parsed.data.tempatLahir,
    tanggal_lahir: parsed.data.tanggalLahir,
    jenis_kelamin: parsed.data.jenisKelamin,
    alamat: {
      jalan: parsed.data.alamat,
      rt_rw: parsed.data.rtRw,
      kel_desa: parsed.data.kelDesa,
      kecamatan: parsed.data.kecamatan,
    },
    agama: parsed.data.agama,
    status_perkawinan: parsed.data.statusPerkawinan,
    pekerjaan: parsed.data.pekerjaan,
    kewarganegaraan: parsed.data.kewarganegaraan,
  }

  return {
    standardJson,
    ktpData: parsed.data,
    rawText: assembledText,
    confidence: avgConfidence,
    annotatedBoxes: boundingBoxes,
  }
}
