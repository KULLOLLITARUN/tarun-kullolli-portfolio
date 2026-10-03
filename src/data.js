// ─────────────────────────────────────────────────────────────
// ALL SITE CONTENT LIVES HERE.
// Edit this file to update the portfolio — no design changes needed.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'Tarun Kullolli',
  // Lines the particle field forms in the hero (desktop / mobile).
  particleText: { wide: ['TARUN KULLOLLI'], narrow: ['TARUN', 'KULLOLLI'] },
  role: 'AI Engineer',
  tagline: 'Building intelligent, full-stack AI applications — from model to interface.',
  summary:
    'AI Engineer at Quintesys with a full-stack foundation in Django, React and Node. ' +
    'Builds LLM-powered systems (agentic RAG, self-healing extraction pipelines, developer tooling) ' +
    'and ships them inside real products.',
  email: 'Kullollitarun@gmail.com',
  phone: '+91 8897083343',
  links: {
    linkedin: 'https://www.linkedin.com/in/tarun-kullolli-b31615282/',
    github: 'https://github.com/KULLOLLITARUN',
  },
  resume: '/resume.pdf', // file lives in /public
}

// PROJECTS — real projects only; every fact comes from the project's own README.
// Each one renders as an "EXP" card. Links set to '#' are hidden.
// result = the one-line outcome on the card.
//
// Clicking a card opens its detailed card. These optional fields fill it
// (any you leave out are simply hidden):
//   year: '2025', role: 'Solo build',
//   overview: 'What it is and who it is for (defaults to description).',
//   problem: 'What was hard or worth solving.',
//   approach: ['Key decision 1', 'Key decision 2', 'Key decision 3'],
//   results: ['Measured outcome', 'What you learned'],  (defaults to result)
//   metric: { value: '94/94', label: 'What the number means' },  (only real numbers)
//   architecture: ['Stage 1', 'Stage 2', ...],  (up to 6 short labels; defaults to stack)
//   shots: [{ src: '/projects/x.webp', width: 1600, height: 726, alt: 'What it shows', caption: 'Optional' }],
//          (real screenshots in /public/projects, shown at the top of the detailed card;
//           { placeholder: true } shows a "Screenshot coming soon" frame instead)
// Each project gets a shareable link: #project/<title-in-lowercase-with-dashes>.
export const experiments = [
  {
    code: 'RAG',
    title: 'Archiva',
    subtitle: 'Self-healing agentic RAG over your own documents',
    year: '2026',
    role: 'Solo build · AI-assisted',
    description:
      'Self-hosted document Q&A system (FastAPI + React) that answers strictly from the loaded documents, using hybrid retrieval, cross-encoder reranking and a self-healing reflection loop that retries and repairs its own failures before returning an answer.',
    problem:
      'Document Q&A has to answer strictly from the loaded documents, and say so when the answer is not there, instead of returning a weak or ungrounded answer.',
    approach: [
      'Hybrid retrieval: BM25 and dense sentence-transformer embeddings fused with reciprocal rank fusion, then cross-encoder reranking',
      'A score gate replies "Not found in the document" without calling the LLM, and a semantic cache (cosine ≥ 0.97) skips the LLM for repeat questions',
      'A router sends simple queries to a fast model (Llama 3.1 8B) and complex ones to a strong model (Llama 3.3 70B) on Groq',
      'Deterministic reflection (overlap, number grounding, contradiction check, zero LLM calls) classifies failures; a healer rewrites the query, widens retrieval or tightens the prompt and retries',
      'Prompt-injection screening on queries and document content, plus multi-hop questions split into sub-questions',
    ],
    result: 'Answers only from your documents, with self-healing retries',
    results: [
      '156 tests (unit, HTTP integration and Postgres) run in CI on every push, with every LLM call mocked',
      'Offline retrieval-quality evaluation harness with golden queries',
      'Ingests .txt, .pdf, .docx, .md, .csv and .html; tables are kept as structured rows',
      'Answers stream over SSE with source citations',
    ],
    metric: { value: '156', label: 'Tests in CI · LLM calls mocked' },
    architecture: ['Rewrite', 'Retrieve', 'Rerank', 'Generate', 'Reflect', 'Heal'],
    shots: [
      {
        src: '/projects/archiva.webp',
        width: 1600,
        height: 727,
        alt: 'Archiva workspace with two loaded documents, topic suggestions drawn from them and a question box',
        caption: 'The workspace: loaded documents, topics suggested from them, and every answer traced back to a page.',
      },
    ],
    stack: ['Python', 'FastAPI', 'PostgreSQL', 'Groq', 'sentence-transformers', 'React'],
    keywords: ['archiva', 'rag', 'retrieval', 'documents', 'document q&a'],
    links: {
      code: 'https://github.com/KULLOLLITARUN/Archiva',
    },
  },
  {
    code: 'AGENT',
    title: 'Agentic Web Scraper',
    subtitle: 'Plain-English web extraction with a self-healing LLM pipeline',
    year: '2026',
    role: 'Solo build · AI-assisted',
    description:
      'Autonomous, self-healing web extraction system: describe the data you want in plain English and get validated, structured JSON from static sites and dynamic React apps, with no CSS selectors.',
    problem:
      'Traditional scrapers rely on rigid CSS selectors and XPath, so they break as soon as a site changes its design, obfuscates its class names or moves to a client-side React or Next.js app.',
    approach: [
      'The data to extract is described in plain English instead of CSS selectors',
      'A headless Playwright browser renders client-side JavaScript and scrolls to load lazy content',
      'An HTML distiller strips noisy structural tags so the LLM receives 85–97% less input',
      'A Groq-hosted Qwen model identifies entities by meaning rather than by class names',
      'A Pydantic validator checks schema and types; on failure it feeds the exact error back to the model to self-correct, up to a set number of retries',
    ],
    result: '85–97% smaller pages before the LLM, in under 8ms',
    results: [
      'Quotes to Scrape: 10 quotes extracted, 0 retries, 85% compression',
      'Y Combinator job directory: 30 jobs extracted in a single pass',
      'Apple: 6 phone models extracted with ₹ prices',
      'Groq inference in 1–2 seconds after distillation',
    ],
    metric: { value: '85–97%', label: 'Less HTML sent to the LLM' },
    architecture: ['Fetch', 'Distill', 'Infer', 'Validate', 'Output'],
    // TODO: replace with a real screenshot (without the Naukri preset or stealth label).
    shots: [{ placeholder: true }],
    stack: ['Python', 'Playwright', 'Groq', 'Pydantic', 'FastAPI', 'React'],
    keywords: ['scraper', 'web scraper', 'scraping', 'agentic'],
    links: {
      code: 'https://github.com/KULLOLLITARUN/Agentic-Web-Scraper',
    },
  },
  {
    code: 'ANALYZER',
    title: 'PBIP Sentinel',
    subtitle: 'Static analysis & CI quality gate for Power BI projects',
    year: '2026',
    role: 'Solo build · AI-assisted',
    description:
      'Static analysis engine, CI/CD quality gate and developer studio for Power BI Projects (.pbip). Audits semantic models (TMDL/TMSL), DAX and report layouts (PBIR) with evidence-backed health scoring.',
    problem:
      'Anti-patterns, orphaned measures, gateway refresh blockers and memory bloat in Power BI projects reach production unless they are caught before reports are merged or deployed.',
    approach: [
      'Canonical model with a cycle-safe, transitive DAX dependency graph that tells truly unused measures apart from internal building blocks',
      '13 rules across model architecture, DAX and report layout, each with a severity and confidence level',
      'Safe, reversible fixes (pbiscan fix) with timestamped backups and an interactive review mode',
      'SARIF v2.1.0 and JUnit XML output, so it works as a quality gate in GitHub Code Scanning, Azure DevOps and Jenkins',
      'MCP server that lets AI agents (Claude Desktop, Cursor, Claude Code) query quality scores and measure lineage and propose fixes',
    ],
    result: '94/94 true positives across 11 real models',
    results: [
      '94 of 94 classified findings were true positives across 11 real models (0 false positives)',
      '0% crash rate across the corpus',
      '384 automated tests passing in about 8 seconds',
      'Live in-browser studio that runs fully client-side, kept honest by 34 parity tests against the Python engine',
    ],
    metric: { value: '94/94', label: 'True positives · 11 real models' },
    architecture: ['PBIP', 'Extract', 'Canonical', 'Rules', 'Scoring', 'Reports'],
    shots: [
      {
        src: '/projects/pbip-sentinel.webp',
        width: 1600,
        height: 726,
        alt: 'PBIP Sentinel web workbench: a drop zone for a .pbip folder, a scan comparison button and two demo reports with health scores',
        caption: 'The in-browser workbench: drop a .pbip folder and it is scanned locally, with nothing uploaded to a server.',
      },
    ],
    stack: ['Python', 'TypeScript', 'MCP', 'SARIF', 'Jinja'],
    keywords: ['power bi', 'powerbi', 'pbiscan', 'scanner'], // help the chat assistant recognise it
    links: {
      code: 'https://github.com/KULLOLLITARUN/Power-BI-Report-Quality-Performance-Scanner',
      live: 'https://pbip-sentinel.netlify.app/',
    },
  },
]

// Career told in acts.
export const acts = [
  {
    act: 'I',
    name: 'Foundations',
    period: '2020 – 2024',
    title: 'B.E. Computer Science',
    org: 'Don Bosco Institute of Technology',
    points: ['Core computer science: data structures, databases, software engineering.', 'Graduated with 7 CGPA.'],
  },
  {
    act: 'II',
    name: 'Training',
    period: 'Jun 2024 – Mar 2025',
    title: 'Full Stack Developer Intern',
    org: 'Besant Technologies',
    points: [
      'Graduate training program focused on professional engineering skills.',
      'Led design and development of responsive front-end interfaces with HTML, CSS, Bootstrap, JavaScript and Python.',
    ],
  },
  {
    act: 'III',
    name: 'Production',
    period: 'Jul 2025 – Present',
    title: 'AI Engineer',
    org: 'Quintesys Pvt. Ltd',
    // Client work is under NDA: keep this entry general.
    points: ['Building AI software in a production team.', 'Client work is confidential, so it isn’t detailed here.'],
  },
]

// The job whose period runs to "Present".
export const currentJob = acts.find((a) => /present/i.test(a.period))

// Groups with no items are hidden automatically.
// The first group is the headline skill set (shown larger). Only list what the projects back up.
export const skills = [
  {
    group: 'AI / ML',
    items: [
      'RAG',
      'Hybrid retrieval (BM25 + dense)',
      'Cross-encoder reranking',
      'LLM agents & self-healing pipelines',
      'Groq',
      'sentence-transformers',
      'Pydantic (structured output)',
      'MCP servers',
    ],
  },
  { group: 'Languages', items: ['Python', 'TypeScript', 'JavaScript', 'HTML', 'CSS'] },
  { group: 'Frameworks', items: ['FastAPI', 'React', 'Django', 'Node.js', 'Express', 'Playwright'] },
  { group: 'Data', items: ['PostgreSQL', 'MySQL', 'MongoDB'] },
]

export const education = [
  { school: 'Don Bosco Institute of Technology', detail: 'B.E. Computer Science · 7 CGPA', period: '2020 – 2024' },
  { school: 'Sri Chaitanya Jr College', detail: 'Pre-University · 8.25 CGPA', period: '2018 – 2020' },
  { school: 'Sri Chaitanya High School', detail: 'High School · 8.7 CGPA', period: '2018' },
]

// TODO: replace '#' with certificate URLs.
export const certifications = [
  { name: 'Python Programming', issuer: 'DataFlair', link: '#' },
  { name: 'Web Development Bootcamp', issuer: 'Udemy', link: '#' },
  { name: 'SQL Skills', issuer: 'HackerRank', link: '#' },
]
