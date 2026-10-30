import { describe, expect, it } from 'vitest'
import { normalizeChatCompletionsUrl } from './byokUrlHelper'

describe('normalizeChatCompletionsUrl', () => {
  it('normalizes standard OpenAI v1 base URL', () => {
    expect(normalizeChatCompletionsUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
    expect(normalizeChatCompletionsUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
  })

  it('keeps existing /chat/completions suffix without double appending', () => {
    expect(
      normalizeChatCompletionsUrl('https://api.openai.com/v1/chat/completions')
    ).toBe('https://api.openai.com/v1/chat/completions')
    expect(
      normalizeChatCompletionsUrl('https://api.openai.com/v1/chat/completions/')
    ).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('handles OpenRouter and Groq URLs', () => {
    expect(normalizeChatCompletionsUrl('https://openrouter.ai/api/v1')).toBe(
      'https://openrouter.ai/api/v1/chat/completions'
    )
    expect(normalizeChatCompletionsUrl('https://api.groq.com/openai/v1/')).toBe(
      'https://api.groq.com/openai/v1/chat/completions'
    )
  })

  it('handles local Ollama without /v1 and with /v1', () => {
    expect(normalizeChatCompletionsUrl('http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1/chat/completions'
    )
    expect(normalizeChatCompletionsUrl('http://localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions'
    )
  })

  it('ensures scheme and deduplicates /v1/v1', () => {
    expect(normalizeChatCompletionsUrl('localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions'
    )
    expect(normalizeChatCompletionsUrl('127.0.0.1:8000/v1')).toBe(
      'http://127.0.0.1:8000/v1/chat/completions'
    )
    expect(normalizeChatCompletionsUrl('api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
    expect(normalizeChatCompletionsUrl('https://api.openai.com/v1/v1')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
  })

  it('trims whitespace and handles edge-case URLs', () => {
    expect(normalizeChatCompletionsUrl('   https://custom-proxy.internal/v1/   ')).toBe(
      'https://custom-proxy.internal/v1/chat/completions'
    )
  })
})
