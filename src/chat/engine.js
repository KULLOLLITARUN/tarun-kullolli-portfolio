// Offline résumé assistant: matches the question to an intent and answers from data.js.
// No API, no network — every answer is built from the resume data.
import { acts, certifications, education, experiments, profile, skills } from '../data.js'

const first = profile.name.split(' ')[0]
const jobs = acts.filter((a) => a.name !== 'Next' && a.name !== 'Foundations')
const allSkills = skills.flatMap((g) => g.items)

const contactActions = [
  { label: 'Email Tarun', href: `mailto:${profile.email}` },
  { label: 'Download resume', href: profile.resume, download: true },
]

// Tech names (lowercase alias → display name). Built from the resume plus common terms.
const KNOWN = new Map()
for (const t of [...allSkills, ...experiments.flatMap((e) => e.stack)]) KNOWN.set(t.toLowerCase(), t)
const ALIASES = {
  js: 'JavaScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  react: 'React',
  reactjs: 'React',
  'react.js': 'React',
  sql: 'MySQL',
  mongo: 'MongoDB',
  html5: 'HTML',
  css3: 'CSS',
  tkinter: 'Tkinter',
}
for (const [k, v] of Object.entries(ALIASES)) KNOWN.set(k, v)
// Common tech that is NOT on the resume — answered honestly.
const NOT_LISTED = [
  'pytorch', 'tensorflow', 'keras', 'langchain', 'llamaindex', 'openai', 'huggingface', 'hugging face',
  'scikit', 'sklearn', 'pandas', 'numpy', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'java', 'c++',
  'c#', 'golang', 'rust', 'typescript', 'next.js', 'nextjs', 'fastapi', 'flask', 'postgres', 'postgresql',
  'redis', 'graphql', 'spark', 'tableau', 'power bi', 'rag', 'vector database', 'opencv',
]

function normalize(text) {
  const t = text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\.(?=\s|$)/g, ' ')
  return ` ${t.replace(/\s+/g, ' ')} `
}
// Whole-word match (simple plurals/tenses allowed), so "his" never matches "hi".
const patterns = new Map()
function hasWord(q, w) {
  if (!patterns.has(w)) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const suffix = w.length >= 4 ? '(s|es|ed|ing)?' : ''
    patterns.set(w, new RegExp(`\\s${esc}${suffix}(?=\\s)`))
  }
  return patterns.get(w).test(q)
}
const hits = (q, words) => words.reduce((n, w) => n + (hasWord(q, w) ? 1 : 0), 0)
const usedIn = (tech) => experiments.filter((e) => e.stack.some((s) => s.toLowerCase() === tech.toLowerCase()))
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

function techAnswer(found, missing) {
  const lines = found.map((t) => {
    const projects = usedIn(t).map((e) => e.title)
    const inSkills = allSkills.includes(t)
    let line = `• ${t}: ${inSkills ? 'listed in his core skills' : 'used in his projects'}`
    if (projects.length) line += `, used in ${list(projects)}`
    if (t === 'Python') line += `, and his day job as a Python Developer at Quintesys`
    return `${line}.`
  })
  const head = found.length ? `Yes. ${first} has worked with ${list(found)}:` : ''
  const miss = missing.length
    ? `${list(missing.map((m) => m.replace(/^./, (c) => c.toUpperCase())))} ${missing.length > 1 ? "aren't" : "isn't"} on his resume yet. Ask him directly for the latest.`
    : ''
  return {
    text: [head, ...lines, miss].filter(Boolean).join('\n'),
    actions: missing.length ? contactActions.slice(0, 1) : undefined,
    followUps: ['What projects has he built?', 'Where does he work now?', 'How can I contact him?'],
  }
}

const PROJECT_KEYS = [
  ['e-shop', 'eshop', 'shop', 'ecommerce', 'e-commerce', 'commerce'],
  ['blog', 'blogs', 'publishing'],
  ['enquiry', 'inquiry', 'tkinter', 'intake'],
  ['todo', 'to-do', 'task'],
  ['apple', 'clone'],
]

const INTENTS = [
  {
    id: 'greet',
    words: ['hi', 'hello', 'hey', 'yo', 'good morning', 'good evening', 'namaste'],
    answer: () => ({
      text: `Hello! I can answer questions about ${first}'s experience, projects, skills, education and availability.`,
      followUps: ['Tell me about Tarun', 'What are his skills?', 'Is he open to work?'],
    }),
  },
  {
    id: 'thanks',
    words: ['thanks', 'thank', 'great', 'cool', 'awesome', 'nice'],
    answer: () => ({
      text: `You're welcome! If ${first} looks like a fit, the quickest way to reach him is email.`,
      actions: contactActions,
    }),
  },
  {
    id: 'about',
    words: ['who', 'about', 'yourself', 'introduce', 'summary', 'background', 'tell me', 'profile', 'overview'],
    answer: () => ({
      text: `${profile.name}: ${profile.summary}\nHe is ${profile.status.toLowerCase()}, targeting ${profile.role} roles.`,
      followUps: ['Where does he work now?', 'What projects has he built?', 'What are his skills?'],
    }),
  },
  {
    id: 'experience',
    words: ['experience', 'work', 'job', 'company', 'companies', 'quintesys', 'besant', 'intern', 'internship', 'career', 'role', 'now', 'current', 'currently', 'employer', 'employment', 'years'],
    answer: () => ({
      text: [
        `${first}'s experience:`,
        ...jobs.map((j) => `• ${j.title} at ${j.org} (${j.period}). ${j.points.join(' ')}`),
      ].join('\n'),
      followUps: ['What projects has he built?', 'What are his skills?', 'Is he open to work?'],
    }),
  },
  {
    id: 'projects',
    words: ['project', 'projects', 'built', 'build', 'portfolio', 'made', 'created', 'developed', 'work samples', 'github'],
    answer: () => ({
      text: [
        `${first} has built ${experiments.length} projects:`,
        ...experiments.map((e) => `• ${e.title}: ${e.subtitle} (${e.result}).`),
        'Ask about any one for details.',
      ].join('\n'),
      followUps: experiments.slice(0, 3).map((e) => `Tell me about ${e.title}`),
    }),
  },
  {
    id: 'skills',
    words: ['skill', 'skills', 'stack', 'tech', 'technologies', 'tools', 'languages', 'frameworks', 'know', 'expertise', 'strong'],
    answer: () => ({
      text: [
        `${first}'s skills:`,
        ...skills.filter((g) => g.items.length).map((g) => `• ${g.group}: ${g.items.join(', ')}`),
      ].join('\n'),
      followUps: ['Does he know Django?', 'What about AI / ML?', 'What projects has he built?'],
    }),
  },
  {
    id: 'ai',
    words: ['ai', 'ml', 'machine learning', 'llm', 'genai', 'artificial', 'deep learning', 'model', 'models', 'data science', 'nlp'],
    answer: () => {
      const ai = skills.find((g) => /ai|ml/i.test(g.group))?.items || []
      return {
        text: ai.length
          ? `${first} is focused on AI engineering. His AI / ML toolkit: ${ai.join(', ')}.`
          : `${first} is moving into AI engineering. His foundation is Python plus full-stack development (Django, React, Node), the core of shipping AI features in real products. For his latest AI work, ask him directly.`,
        actions: ai.length ? undefined : contactActions.slice(0, 1),
        followUps: ['What are his skills?', 'Where does he work now?', 'How can I contact him?'],
      }
    },
  },
  {
    id: 'education',
    words: ['education', 'degree', 'college', 'university', 'study', 'studied', 'cgpa', 'gpa', 'graduate', 'graduation', 'engineering', 'b.e', 'school', 'qualification'],
    answer: () => ({
      text: [`${first}'s education:`, ...education.map((e) => `• ${e.school}: ${e.detail} (${e.period}).`)].join('\n'),
      followUps: ['Any certifications?', 'Where does he work now?'],
    }),
  },
  {
    id: 'certs',
    words: ['certification', 'certifications', 'certificate', 'certified', 'course', 'courses', 'bootcamp'],
    answer: () => ({
      text: [`Certifications:`, ...certifications.map((c) => `• ${c.name} (${c.issuer})`)].join('\n'),
      followUps: ['What are his skills?', 'What projects has he built?'],
    }),
  },
  {
    id: 'contact',
    words: ['contact', 'email', 'mail', 'phone', 'call', 'reach', 'linkedin', 'number', 'hire', 'connect', 'interview'],
    answer: () => ({
      text: `You can reach ${first} at ${profile.email} or ${profile.phone}.`,
      actions: contactActions,
    }),
  },
  {
    id: 'availability',
    words: ['open to work', 'open', 'available', 'availability', 'looking', 'join', 'notice', 'relocate', 'relocation', 'remote', 'salary', 'ctc', 'start', 'hiring', 'opportunity', 'opportunities', 'free'],
    answer: (q) => {
      const unknown = hits(q, ['notice', 'relocate', 'relocation', 'remote', 'salary', 'ctc'])
      return {
        text:
          `Yes, ${first} is ${profile.status.toLowerCase()}, targeting ${profile.role} roles.` +
          (unknown ? ' Notice period, location and compensation aren’t on his resume, so it’s best to ask him directly.' : ''),
        actions: contactActions,
      }
    },
  },
  {
    id: 'resume',
    words: ['resume', 'cv', 'pdf', 'download'],
    answer: () => ({ text: `Here's ${first}'s resume as a PDF.`, actions: contactActions.slice(1) }),
  },
]

export const GREETING = `Hi, I'm TK-01, ${first}'s resume assistant. Ask me about his experience, projects or skills.`
export const STARTER_CHIPS = ['What does he do now?', 'What projects has he built?', 'Is he open to work?']

export function answer(question) {
  const q = normalize(question)
  if (!q.trim()) return { text: 'Ask me anything about Tarun’s resume.' }

  // 1. A specific project.
  const pIndex = PROJECT_KEYS.findIndex((keys) => hits(q, keys))
  if (pIndex >= 0 && !hits(q, ['projects'])) {
    const e = experiments[pIndex]
    return {
      text: `${e.title}: ${e.subtitle}.\n${e.description}\nStack: ${e.stack.join(', ')}.\nResult: ${e.result}.`,
      followUps: experiments.filter((x) => x !== e).slice(0, 2).map((x) => `Tell me about ${x.title}`).concat('What are his skills?'),
    }
  }

  // 2. A specific technology.
  const found = [...new Set([...KNOWN.keys()].filter((k) => hasWord(q, k)).map((k) => KNOWN.get(k)))]
  const missing = NOT_LISTED.filter((t) => hasWord(q, t))
  if (found.length || missing.length) return techAnswer(found, missing)

  // 3. Best-scoring intent.
  let best = null
  let bestScore = 0
  for (const intent of INTENTS) {
    const score = hits(q, intent.words)
    if (score > bestScore) {
      best = intent
      bestScore = score
    }
  }
  if (best) return best.answer(q)

  return {
    text: `I only know what's on ${first}'s resume, so I'm not sure about that one. Try asking about his experience, projects, skills or education.`,
    followUps: STARTER_CHIPS,
    actions: contactActions.slice(0, 1),
  }
}
