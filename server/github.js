// Latest public commits from the project repos (data.js), for the "Live from GitHub" feed.
// Shared by the Vercel function (api/github.js) and the Vite dev server. The response is cached
// at the edge for an hour, so GitHub is asked a few times an hour at most, whatever the traffic.
import { activityRepos } from '../src/data.js'

const PER_REPO = 5 // fetched; merges are dropped, then at most SHOWN_PER_REPO are kept
const SHOWN_PER_REPO = 2 // so one busy repo cannot fill the whole feed
const MAX_ITEMS = 8
export const CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400'

async function repoCommits({ url, label }, token) {
  const slug = new URL(url).pathname.slice(1).replace(/\/$/, '')
  const res = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=${PER_REPO}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tarun-kullolli-portfolio',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`github ${res.status}`)
  return (await res.json())
    .filter((c) => c.parents?.length < 2) // skip merge commits
    .slice(0, SHOWN_PER_REPO)
    .map((c) => ({
      repo: label,
      repoUrl: url,
      message: c.commit.message.split('\n')[0].slice(0, 120),
      url: c.html_url,
      date: c.commit.author?.date || c.commit.committer?.date,
    }))
}

// Returns { status, body }. A repo that fails is left out; all failing is a 502.
export async function handleGithub({ env }) {
  const results = await Promise.allSettled(activityRepos.map((r) => repoCommits(r, env.GITHUB_TOKEN)))
  const commits = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (!commits.length) return { status: 502, body: { error: 'unavailable' } }
  commits.sort((a, b) => new Date(b.date) - new Date(a.date))
  return { status: 200, body: { commits: commits.slice(0, MAX_ITEMS) } }
}
