/**
 * CTC Greedy Decoder for PaddleOCR CRNN/SVTR recognition models.
 *
 * Rules:
 * - Index 0 is strictly the CTC Blank Token.
 * - Line i (0-indexed) in ppocr_keys_v1.txt maps to index (i + 1).
 * - Space character (' ') is appended to the dictionary at index dictionary.length.
 * - Repeated tokens across adjacent timesteps are collapsed unless separated by a blank token.
 * - Logits are normalized to probabilities via Softmax if not already normalized.
 */

export interface CtcDecodeResult {
  text: string
  confidence: number
  timesteps: {
    index: number
    char: string
    probability: number
  }[]
}

/**
 * Normalizes CJK/fullwidth punctuation characters emitted by PaddleOCR to standard ASCII equivalents.
 */
export function normalizeFullwidthChar(char: string): string {
  if (!char) return ''
  switch (char) {
    case '\uFF1A':
      return ':'
    case '\uFF08':
      return '('
    case '\uFF09':
      return ')'
    case '\uFF0F':
      return '/'
    case '\uFF0D':
      return '-'
    case '\uFF1B':
      return ';'
    case '\uFF0C':
      return ','
    case '\u3002':
      return '.'
    default:
      return char
  }
}

/**
 * Normalizes fullwidth characters in decoded text strings.
 */
export function normalizeFullwidthText(text: string): string {
  return text
    .replace(/[\uFF1A：]/g, ':')
    .replace(/[\uFF08（]/g, '(')
    .replace(/[\uFF09）]/g, ')')
    .replace(/[\uFF0F／]/g, '/')
    .replace(/[\uFF0D－]/g, '-')
    .replace(/[\uFF1B；]/g, ';')
    .replace(/[\uFF0C，]/g, ',')
    .replace(/[\u3002。]/g, '.')
}

/**
 * Builds a standardized dictionary array with blank at index 0 and space at the end.
 * Does NOT trim the whole file to preserve intermediate whitespace lines if any.
 *
 * @param rawDictionaryLines Lines from ppocr_keys_v1.txt
 * @returns Array where character at line i is at index i + 1, and space is at dictionary.length
 */
export function buildPaddleDictionary(
  rawDictionaryLines: string[] | string | ArrayBuffer | Uint8Array
): string[] {
  let source: string | string[]
  if (rawDictionaryLines instanceof ArrayBuffer || rawDictionaryLines instanceof Uint8Array) {
    source = new TextDecoder('utf-8').decode(rawDictionaryLines)
  } else {
    source = rawDictionaryLines
  }

  const lines = Array.isArray(source)
    ? source
    : source.split(/\r?\n/)

  const dict: string[] = []
  // Strip trailing empty lines only (e.g. trailing newline at EOF)
  let lastNonEmpty = lines.length - 1
  while (lastNonEmpty >= 0 && lines[lastNonEmpty].length === 0) {
    lastNonEmpty--
  }

  for (let i = 0; i <= lastNonEmpty; i++) {
    const rawChar = lines[i].replace(/[\r\n]+$/, '')
    dict.push(normalizeFullwidthChar(rawChar))
  }

  // Ensure space (' ') is at the end (index N + 1 where index 0 is blank) without duplicates
  if (dict.length === 0 || dict[dict.length - 1] !== ' ') {
    dict.push(' ')
  }

  return dict
}

/**
 * Decodes 2D/3D CTC output tensor into text and confidence score.
 *
 * @param data Flat Float32Array from ONNX model output
 * @param shape Tensor dimensions (e.g., [1, seq_len, num_classes] or [seq_len, num_classes])
 * @param dictionary Pre-built character array (where dict[0] maps to class index 1)
 */
export function ctcGreedyDecode(
  data: Float32Array,
  shape: readonly number[],
  dictionary: string[]
): CtcDecodeResult {
  if (!data || data.length === 0 || !shape || shape.length < 2) {
    return { text: '', confidence: 0, timesteps: [] }
  }

  let seqLen = 0
  let numClasses = 0

  if (shape.length === 3) {
    // [batch, seq_len, num_classes] or [batch, num_classes, seq_len]
    if (shape[1] > shape[2] && shape[2] <= 128) {
      // Unlikely for CRNN where numClasses is ~6625, but handle [batch, num_classes, seq_len]
      numClasses = shape[1]
      seqLen = shape[2]
    } else {
      seqLen = shape[1]
      numClasses = shape[2]
    }
  } else if (shape.length === 2) {
    seqLen = shape[0]
    numClasses = shape[1]
  } else {
    return { text: '', confidence: 0, timesteps: [] }
  }

  if (seqLen <= 0 || numClasses <= 0 || data.length < seqLen * numClasses) {
    return { text: '', confidence: 0, timesteps: [] }
  }

  let lastIndex = -1
  const emittedChars: string[] = []
  const emittedProbs: number[] = []
  const timesteps: { index: number; char: string; probability: number }[] = []

  for (let t = 0; t < seqLen; t++) {
    const offset = t * numClasses

    // 1. Find argmax and max logit
    let maxLogit = -Infinity
    let argmax = 0

    for (let c = 0; c < numClasses; c++) {
      const val = data[offset + c]
      if (val > maxLogit) {
        maxLogit = val
        argmax = c
      }
    }

    // 2. Compute probability: check if row is already softmax probabilities
    let isProbabilityDistribution = true
    let sum = 0
    for (let c = 0; c < numClasses; c++) {
      const val = data[offset + c]
      if (val < 0) {
        isProbabilityDistribution = false
        break
      }
      sum += val
      if (sum > 1.05) {
        isProbabilityDistribution = false
        break
      }
    }
    if (isProbabilityDistribution && (sum < 0.95 || sum > 1.05)) {
      isProbabilityDistribution = false
    }

    let probability: number
    if (isProbabilityDistribution) {
      probability = maxLogit
    } else {
      let sumExp = 0
      for (let c = 0; c < numClasses; c++) {
        sumExp += Math.exp(data[offset + c] - maxLogit)
      }
      probability = sumExp > 0 ? 1 / sumExp : 0
    }
    probability = Math.max(0, Math.min(1, probability))

    // 3. CTC Collapse Logic:
    // - Index 0 is BLANK
    // - Repeat of previous class is ignored unless blank intervened
    if (argmax !== 0 && argmax !== lastIndex) {
      // Map argmax to character: line i (0-indexed) in file is class i + 1 in model
      const charIndex = argmax - 1
      const rawChar = charIndex >= 0 && charIndex < dictionary.length ? dictionary[charIndex] : ''
      const char = normalizeFullwidthChar(rawChar)

      if (char) {
        emittedChars.push(char)
        emittedProbs.push(probability)
        timesteps.push({
          index: argmax,
          char,
          probability: Math.round(probability * 1000) / 1000,
        })
      }
    }

    lastIndex = argmax
  }

  const text = normalizeFullwidthText(emittedChars.join(''))
  const confidence =
    emittedProbs.length > 0
      ? Math.round(
          (emittedProbs.reduce((sum, p) => sum + p, 0) / emittedProbs.length) * 1000
        ) / 1000
      : 0

  return {
    text,
    confidence,
    timesteps,
  }
}
