import type { KtpData } from '../types/ktp'
import type { BoundingBox } from '../types/paddleOcr'
import { parseKtpText, recoverLexicalSpacing } from './ktpParser'
import { sortBoundingBoxesSpatially } from './spatialSorter'
export interface PaddleKtpParseResult {
  ktpData: KtpData
  rawText: string
  annotatedBoxes: BoundingBox[]
}

/**
 * Maps bounding boxes to e-KTP fields using spatial heuristics & text parser.
 */
export function parsePaddleBoxesToKtp(
  boxes: BoundingBox[],
  imageWidth?: number,
  imageHeight?: number
): PaddleKtpParseResult {
  if (!boxes || boxes.length === 0) {
    const empty = parseKtpText('', 0, 0)
    return {
      ktpData: empty.data,
      rawText: '',
      annotatedBoxes: [],
    }
  }

  // 1. Spatially sort boxes with photo zone isolation
  const sorted = sortBoundingBoxesSpatially(boxes, {
    yThresholdRatio: 0.5,
    imageWidth,
    imageHeight,
    filterPhotoZone: true,
  })
  // 2. Group into lines by lineIndex
  const linesMap = new Map<number, (typeof sorted)[0][]>()
  for (const box of sorted) {
    const lIndex = box.lineIndex ?? 0
    if (!linesMap.has(lIndex)) {
      linesMap.set(lIndex, [])
    }
    linesMap.get(lIndex)!.push(box)
  }

  // 3. Assemble reconstructed text lines
  const reconstructedLines: string[] = []
  const sortedLineIndices = Array.from(linesMap.keys()).sort((a, b) => a - b)

  for (const lIdx of sortedLineIndices) {
    const lineBoxes = linesMap.get(lIdx)!
    // Skip lines located in photo zone (e.g. LANGKAT or print date 07-08-2012)
    const isPhotoLine = lineBoxes.every((b) => Boolean((b as { isPhotoZone?: boolean }).isPhotoZone))
    if (isPhotoLine) {
      continue
    }

    const lineStr = lineBoxes
      .map((b) => recoverLexicalSpacing(b.text.trim()))
      .filter((s) => s.length > 0)
      .join(' ')

    if (lineStr) {
      reconstructedLines.push(lineStr)
    }
  }
  const rawText = reconstructedLines.join('\n')

  // 4. Parse with mature KTP text parser (which handles NIK correction, DOB +40, etc.)
  const parsed = parseKtpText(rawText, 100, 0)
  const ktpData = parsed.data

  // 5. Annotate each box with matchedField for bidirectional canvas hover/click highlighting
  const annotatedBoxes: BoundingBox[] = sorted.map((box) => {
    const txt = box.text.trim().toLowerCase()
    let matchedField: string | undefined

    if (/\b(nik|m1k|n1k)\b/.test(txt) || /^\d{16}$/.test(txt.replace(/\s+/g, ''))) {
      matchedField = 'nik'
    } else if (/\bnama\b/.test(txt) || (ktpData.nama && txt.includes(ktpData.nama.toLowerCase()))) {
      matchedField = 'nama'
    } else if (
      /tempat|lahir|tgl/.test(txt) ||
      (ktpData.tempatLahir && txt.includes(ktpData.tempatLahir.toLowerCase())) ||
      (ktpData.tanggalLahir && txt.includes(ktpData.tanggalLahir.toLowerCase()))
    ) {
      matchedField = 'tempatLahir'
    } else if (/jenis\s*kelamin|laki|perempuan/.test(txt)) {
      matchedField = 'jenisKelamin'
    } else if (
      /gol\.?\s*darah|\bdarah\b/.test(txt) ||
      /^(gol\.?\s*darah\s*[:\s]*)?([ab]|ab|o|-)$/i.test(txt) ||
      (ktpData.golonganDarah &&
        ktpData.golonganDarah !== '-' &&
        txt === ktpData.golonganDarah.toLowerCase())
    ) {
      matchedField = 'golonganDarah'
    } else if (/rt\s*[/.]?\s*rw|\d{3}\s*\/\s*\d{3}/.test(txt)) {
      matchedField = 'rtRw'
    } else if (/kelurahan|kel[/.]|desa/.test(txt)) {
      matchedField = 'kelDesa'
    } else if (/kecamatan|kec[.]/.test(txt)) {
      matchedField = 'kecamatan'
    } else if (/alamat|jl\b|jalan/.test(txt)) {
      matchedField = 'alamat'
    } else if (/agama|islam|kristen|katolik|hindu|buddha|khonghucu/.test(txt)) {
      matchedField = 'agama'
    } else if (/kawin|belum\s*kawin|cerai/.test(txt)) {
      matchedField = 'statusPerkawinan'
    } else if (/pekerjaan|karyawan|pelajar|wiraswasta|pegawai/.test(txt)) {
      matchedField = 'pekerjaan'
    } else if (/kewarganegaraan|wni|wna/.test(txt)) {
      matchedField = 'kewarganegaraan'
    }

    return {
      ...box,
      matchedField,
    }
  })

  return {
    ktpData,
    rawText,
    annotatedBoxes,
  }
}
