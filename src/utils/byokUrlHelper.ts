/**
 * Menormalkan Base URL ke endpoint OpenAI-compatible /chat/completions.
 *
 * Contoh input -> output:
 * - https://api.openai.com/v1 -> https://api.openai.com/v1/chat/completions
 * - https://api.openai.com/v1/ -> https://api.openai.com/v1/chat/completions
 * - https://api.openai.com/v1/chat/completions -> https://api.openai.com/v1/chat/completions
 * - http://localhost:11434 -> http://localhost:11434/v1/chat/completions
 */
export function normalizeChatCompletionsUrl(inputUrl: string): string {
  let trimmed = inputUrl.trim().replace(/\/+$/, '')

  if (!trimmed) {
    return 'https://api.openai.com/v1/chat/completions'
  }

  // Deduplicate accidental /v1/v1
  trimmed = trimmed.replace(/\/v1\/v1(?=\/|$)/g, '/v1')

  // Pastikan skema http:// atau https://
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)) {
      trimmed = `http://${trimmed}`
    } else {
      trimmed = `https://${trimmed}`
    }
  }

  // Jika sudah berakhiran /chat/completions
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }

  // Jika berakhiran /v1 atau /openai/v1
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`
  }

  // Jika URL berupa host tanpa path (misal: http://localhost:11434)
  try {
    const parsed = new URL(trimmed)
    if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
      return `${trimmed}/v1/chat/completions`
    }
  } catch {
    // Jika bukan URL valid, fallback append biasa
  }

  return `${trimmed}/chat/completions`
}
