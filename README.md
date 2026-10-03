# Tarun Kullolli — Portfolio

[![CI](https://github.com/KULLOLLITARUN/tarun-kullolli-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/KULLOLLITARUN/tarun-kullolli-portfolio/actions/workflows/ci.yml)

Personal portfolio of **Tarun Kullolli, AI Engineer**: projects, career and skills, with **Kairo**, an AI resume assistant that answers questions about them.

**Live:** https://tarun-kullolli-portfolio.vercel.app

## Features

- **Particle hero.** A Three.js particle field draws the name, then hands over to the solid text. Phones and low-power devices skip it and get the solid name straight away.
- **Kairo, the resume assistant.** An alarm-clock mascot with a chat:
  - Answers stream in from an LLM on Groq. The system prompt is generated from the site's own data, so it can't drift from the page.
  - If the live model is unavailable, an offline intent engine answers from the same data.
  - It says when something isn't on the resume instead of inventing an answer, and declines off-topic questions (the mascot gets grumpy).
  - It also explains how to use the site.
- **Project case studies.** Problem, approach, results, an architecture diagram and a real screenshot for each project. Each has a shareable link (`#project/<name>`) and an "Ask Kairo about this" button.
- **Recruiter mode.** A plain one-page version of the resume with no animations. Open it with the switch in the top bar or with `?recruiter` in the URL.
- **Printable resume.** Printing (Ctrl+P) produces a conventional one-page resume, whichever view is open.
- **Command menu.** Ctrl+K (Cmd+K on a Mac) to jump to sections, copy the email, download the resume, start the tour or change colours.
- **Time-of-day themes.** Click Kairo to pick Night, Dawn, Aurora or Solar.
- **Guided tour.** "Take the 60-second tour" scrolls through every section.
- **Optional anonymous question log.** Visitors' questions to Kairo can be logged (question and time only, no IP) to see what people ask. The chat shows a notice only when logging is switched on.

## Tech stack

- React 19 and Vite
- Three.js via React Three Fiber, anime.js, Lenis smooth scrolling
- Groq API (`openai/gpt-oss-120b` by default), called from a serverless function so the key stays on the server
- Upstash Redis (optional) for the question log
- Deployed on Vercel. Fonts (Geist, Geist Mono) are self-hosted.

## Running locally

Requires Node.js 20.19+ or 22.12+ (what Vite 8 needs).

```bash
npm install
cp .env.example .env   # then add your GROQ_API_KEY
npm run dev            # http://localhost:5173
```

The dev server also serves `/api/chat`, mirroring the Vercel function, so the assistant works locally. Without a `GROQ_API_KEY` the chat still works with the offline engine.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Re-run tests on every change |
| `npm run questions` | Print the latest questions visitors asked Kairo (needs the Upstash variables) |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | For the live assistant | Groq API key ([console.groq.com/keys](https://console.groq.com/keys)) |
| `GROQ_MODEL` | No | Override the model (default `openai/gpt-oss-120b`) |
| `UPSTASH_REDIS_REST_URL` | No | Turns on the anonymous question log, together with the token |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token |

Locally they go in `.env` (git-ignored). On Vercel, set them under Project Settings → Environment Variables.

## Testing

`npm test` runs the [Vitest](https://vitest.dev) suite in `tests/`:

- **Offline engine:** correct answers about projects and skills, honest "not on his resume" for unlisted skills, no guessing about salary or notice period, and off-topic questions flagged.
- **System prompt:** built from `data.js`, keeps its guardrails, and mentions the question log only when logging is on.
- **Chat server:** input checks, the per-IP rate limit, history trimming, streaming (including split and malformed events), Groq errors, and the question log (no IP stored; the chat still answers if logging fails). `fetch` is faked, so no API keys are needed and nothing is sent to Groq or Upstash.
- **Printed resume:** section order, oldest-first entries, and no placeholder links.
- **Content checks:** every project is complete, share links are unique, and screenshots and the resume PDF exist.

GitHub Actions runs the tests and a production build on every push to `main` (see the badge above).

## Editing the content

All site content lives in [`src/data.js`](src/data.js): profile, projects, career, skills, education and certifications. The page, recruiter mode, the printed resume and Kairo's knowledge are all generated from it, so one edit updates everything.

- **Project screenshots** go in `public/projects/` and are listed in each project's `shots` field.
- **The resume PDF** behind the download buttons is `public/resume.pdf`.
- **Kairo's guide to the site** is in [`src/chat/siteGuide.js`](src/chat/siteGuide.js). Update it when a section or feature changes.

## Project structure

```
api/chat.js            Vercel function: POST streams Kairo's answer, GET reports whether logging is on
server/chatCore.js     Input checks, rate limit, Groq call (shared by Vercel and the dev server)
server/questionLog.js  Optional anonymous question log (Upstash Redis)
scripts/questions.mjs  Reads the question log (npm run questions)
tests/                 Vitest tests: offline engine, prompt, chat server, printed resume, data checks
.github/workflows/     CI: tests and build on every push
src/data.js            All site content
src/chat/              Chat UI, system prompt, offline engine, site guide
src/components/        Hero, particle scene, mascot, sections, recruiter view, printable resume
src/theme.js           Time-of-day colour themes
public/                Resume PDF, project screenshots, icons, link-preview image
```

## Deployment

Pushing to `main` deploys to Vercel automatically. CI (`.github/workflows/ci.yml`) runs the tests and build on the same push.
