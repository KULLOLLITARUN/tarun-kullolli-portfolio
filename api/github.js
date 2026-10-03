// Vercel serverless function: GET /api/github → { commits: [{ repo, repoUrl, message, url, date }] }
import { CACHE, handleGithub } from '../server/github.js'

export default async function handler(req, res) {
  const { status, body } = await handleGithub({ env: process.env })
  if (status === 200) res.setHeader('Cache-Control', CACHE)
  res.status(status).json(body)
}
