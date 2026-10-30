/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

function byokProxyPlugin(): Plugin {
  return {
    name: 'byok-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/byok-proxy', async (req, res) => {
        const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : ''
        const isAllowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(originHeader)
        const safeOrigin = isAllowedOrigin ? originHeader : 'http://localhost:5173'

        const corsHeaders: Record<string, string> = {
          'Access-Control-Allow-Origin': safeOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url',
          Vary: 'Origin',
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204, corsHeaders)
          res.end()
          return
        }

        const targetUrl = req.headers['x-target-url'] as string
        if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
          res.writeHead(400, {
            ...corsHeaders,
            'Content-Type': 'application/json',
          })
          res.end(
            JSON.stringify({ error: 'Header x-target-url tidak valid atau tidak ditemukan.' })
          )
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
          }
          const bodyBuffer = Buffer.concat(chunks)

          const forwardHeaders: Record<string, string> = {
            'content-type': (req.headers['content-type'] as string) || 'application/json',
          }
          if (req.headers.authorization) {
            forwardHeaders.authorization = req.headers.authorization as string
          }

          const upstreamResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: forwardHeaders,
            body: bodyBuffer.length > 0 ? bodyBuffer : undefined,
          })

          const responseBuffer = await upstreamResponse.arrayBuffer()
          res.writeHead(upstreamResponse.status, {
            ...corsHeaders,
            'Content-Type':
              upstreamResponse.headers.get('content-type') || 'application/json',
          })
          res.end(Buffer.from(responseBuffer))
        } catch (err) {
          res.writeHead(502, {
            ...corsHeaders,
            'Content-Type': 'application/json',
          })
          res.end(
            JSON.stringify({
              error: `Local Dev Proxy gagal menghubungi target URL: ${err instanceof Error ? err.message : String(err)}`,
            })
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    byokProxyPlugin(),
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**'],
  },
})
