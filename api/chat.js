// Vercel serverless function: POST /api/chat  { messages: [{ role, content }] } → { text }
import { handleChat } from '../server/chatCore.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress
  const { status, body } = await handleChat({ body: req.body, ip, env: process.env })
  res.status(status).json(body)
}
