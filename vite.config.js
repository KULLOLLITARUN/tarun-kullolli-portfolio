import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleChat, sendChat } from './server/chatCore.js'
import { handleGithub } from './server/github.js'

// Serves /api/chat and /api/github during `npm run dev` / `npm run preview`, mirroring the
// Vercel functions in api/.
function localApi(env) {
  const chat = (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      return res.end()
    }
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 20000) req.destroy()
    })
    req.on('end', async () => {
      let body = null
      try {
        body = JSON.parse(raw)
      } catch {
        /* handled as bad_request */
      }
      await sendChat(res, await handleChat({ body, ip: req.socket.remoteAddress, env }))
    })
  }
  const github = async (req, res) => {
    const { status, body } = await handleGithub({ env })
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }
  const middleware = (req, res, next) => {
    if (req.url === '/api/chat') return chat(req, res)
    if (req.url === '/api/github') return github(req, res)
    next()
  }
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load ALL vars from .env files (no VITE_ prefix), so API keys stay server-only.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return { plugins: [react(), localApi(env)] }
})
