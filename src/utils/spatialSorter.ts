import type { BoundingBox } from '../types/paddleOcr'

/**
 * Spatially sorts bounding boxes top-to-bottom, left-to-right.
 *
 * Uses vertical overlap clustering to group boxes that belong to the same text line
 * (e.g. "NIK :" and "3171010101900001" or "Jenis Kelamin :" and "LAKI-LAKI"),
 * sorts the lines by Y, and sorts boxes within each line by X.
 *
 * @param boxes List of unsorted bounding boxes
 * @param yThresholdRatio Ratio of box height for vertical clustering tolerance (default: 0.5)
 * @returns Sorted list with assigned lineIndex
 */
export interface SpatialSortOptions {
  yThresholdRatio?: number
  imageWidth?: number
  imageHeight?: number
  filterPhotoZone?: boolean
}

export function sortBoundingBoxesSpatially<
  T extends Pick<BoundingBox, 'x' | 'y' | 'w' | 'h'> & { text?: string }
>(
  boxes: T[],
  optionsOrRatio: number | SpatialSortOptions = 0.5
): (T & { lineIndex: number; isPhotoZone?: boolean })[] {
  if (!boxes || boxes.length === 0) {
    return []
  }

  const options: SpatialSortOptions =
    typeof optionsOrRatio === 'number'
      ? { yThresholdRatio: optionsOrRatio }
      : optionsOrRatio

  const yThresholdRatio = options.yThresholdRatio ?? 0.5
  const filterPhotoZone = options.filterPhotoZone ?? true

  const maxRight = boxes.reduce((acc, b) => Math.max(acc, b.x + b.w), 0)
  const maxBottom = boxes.reduce((acc, b) => Math.max(acc, b.y + b.h), 0)
  const imgW = options.imageWidth ?? Math.max(maxRight, 600)
  const imgH = options.imageHeight ?? Math.max(maxBottom, 400)

  const isKtpFieldText = (text?: string): boolean => {
    if (!text) return false
    return /(nik|nama|lahir|kelamin|agama|status|kawin|darah|alamat|rt|rw|kel|desa|kecamatan|pekerjaan|kewarganegaraan|wni|wna)/i.test(
      text
    )
  }

  // Wrap each box with calculated metrics without mutating original generic shape
  const items = boxes.map((box) => {
    const centerX = box.x + box.w / 2
    const centerY = box.y + box.h / 2
    const isPhotoZone =
      filterPhotoZone &&
      centerX > imgW * 0.72 &&
      centerY > imgH * 0.22 &&
      !isKtpFieldText(box.text)

    return {
      box,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      centerX,
      centerY,
      isPhotoZone,
    }
  })

  const clusterItemsIntoLines = (rawItems: typeof items) => {
    const sortedByY = [...rawItems].sort((a, b) => a.centerY - b.centerY)
    const lineClusters: (typeof items)[] = []

    for (const item of sortedByY) {
      let placed = false

      for (const line of lineClusters) {
        const avgLineHeight = line.reduce((acc, it) => acc + it.h, 0) / line.length
        const avgLineCenterY = line.reduce((acc, it) => acc + it.centerY, 0) / line.length
        const threshold = Math.max(item.h, avgLineHeight) * yThresholdRatio

        if (Math.abs(item.centerY - avgLineCenterY) <= threshold) {
          line.push(item)
          placed = true
          break
        }
      }

      if (!placed) {
        lineClusters.push([item])
      }
    }

    // Sort lines by their average centerY
    lineClusters.sort((lineA, lineB) => {
      const avgYA = lineA.reduce((acc, it) => acc + it.centerY, 0) / lineA.length
      const avgYB = lineB.reduce((acc, it) => acc + it.centerY, 0) / lineB.length
      return avgYA - avgYB
    })

    return lineClusters
  }

  const mainItems = items.filter((it) => !it.isPhotoZone)
  const photoZoneItems = items.filter((it) => it.isPhotoZone)

  const mainLines = clusterItemsIntoLines(mainItems)
  const finalLines: (typeof items)[] = []

  for (const line of mainLines) {
    // Sort boxes within line from left to right
    line.sort((a, b) => a.x - b.x)

    // Check if on the same line there is a second label in the middle (e.g. "Gol. Darah" on right of "Jenis Kelamin")
    const splitIndex = line.findIndex(
      (it, idx) =>
        idx > 0 &&
        it.box.text &&
        /(gol\.?\s*darah|blood)/i.test(it.box.text)
    )

    if (splitIndex > 0) {
      const seg1 = line.slice(0, splitIndex)
      const seg2 = line.slice(splitIndex)
      finalLines.push(seg1)
      finalLines.push(seg2)
    } else {
      finalLines.push(line)
    }
  }

  // Cluster photo zone items separately so they appear at the bottom
  if (photoZoneItems.length > 0) {
    const photoLines = clusterItemsIntoLines(photoZoneItems)
    for (const pline of photoLines) {
      pline.sort((a, b) => a.x - b.x)
      finalLines.push(pline)
    }
  }

  const result: (T & { lineIndex: number; isPhotoZone?: boolean })[] = []

  for (let lIdx = 0; lIdx < finalLines.length; lIdx++) {
    const line = finalLines[lIdx]
    for (const item of line) {
      result.push({
        ...item.box,
        lineIndex: lIdx,
        isPhotoZone: item.isPhotoZone,
      })
    }
  }

  return result
}
