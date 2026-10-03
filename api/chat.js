// Vercel serverless function: POST /api/chat  { messages: [{ role, content }] } → streamed text
//                            GET  /api/chat  → { logging } (whether questions are logged)
import { chatInfo, handleChat, sendChat } from '../server/chatCore.js'

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json(chatInfo(process.env))
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress
  await sendChat(res, await handleChat({ body: req.body, ip, env: process.env }))
}
