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
//          (real screenshots in /public/projects, shown at the top of the detailed card)
// Each project gets a shareable link: #project/<title-in-lowercase-with-dashes>.
// Optional: slug: '...' overrides that, aliases: ['old-slug'] keeps links from an earlier name working.
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
      'A router sends simple queries to a fast model (gpt-oss-20b) and complex ones to a strong model (gpt-oss-120b) on Groq',
      'Deterministic reflection (overlap, number grounding, contradiction check, zero LLM calls) classifies failures; a healer rewrites the query, widens retrieval or tightens the prompt and retries',
      'Prompt-injection screening on queries and document content',
      'Multi-hop questions are split into sub-questions; a later step is rewritten from the real answer of an earlier one, and steps whose prerequisite failed are skipped with an explicit reason',
      'Scanned PDFs are read with OCR (RapidOCR) as a background job that survives a crash: a lease per job lets another worker take it over',
      'Documents, chunks and chat sessions live in Postgres; several workers stay in sync through a version counter',
    ],
    result: 'Answers only from your documents, with self-healing retries',
    results: [
      '523 tests (unit, HTTP integration and Postgres) run in CI on every push, with every LLM call mocked',
      'Offline retrieval-quality evaluation harness with golden queries, plus an end-to-end answer-quality eval against Groq',
      'Ingests .txt, .pdf, .docx, .md, .csv and .html; tables are kept as structured rows',
      'Answers stream over SSE with source citations',
    ],
    metric: { value: '523', label: 'Tests in CI · LLM calls mocked' },
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
    keywords: ['archiva', 'rag', 'retrieval', 'documents', 'document q&a', 'ocr'],
    links: {
      code: 'https://github.com/KULLOLLITARUN/Archiva',
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
  {
    code: 'AGENT',
    title: 'Markpull',
    slug: 'markpull',
    aliases: ['agentic-web-scraper'], // the old share link keeps working
    subtitle: 'Plain-English web extraction, with every record marked on the page',
    year: '2026',
    role: 'Solo build · AI-assisted',
    description:
      'Point it at a web page, say what you want in plain words, and get clean structured data back. It shows a picture of the page with every record it found marked and numbered, and exports cards, a table, JSON, CSV or Excel.',
    problem:
      'Traditional scrapers rely on rigid CSS selectors and XPath, so they break as soon as a site changes its design, obfuscates its class names or moves to a client-side React or Next.js app.',
    approach: [
      'The data to extract is described in plain words, or as typed fields such as price (number) or in_stock (yes/no); typed values are checked and wrong ones are asked for again',
      'A Playwright Chromium browser renders the page, dismisses cookie banners, scrolls for lazy content and presses "Load more" buttons; "next page" links are followed for up to 10 pages',
      'The Distiller turns the HTML into plain text (scripts, navigation, footers and SVG removed); long text is read in overlapping parts and merged, and the rest of the page is read again if a list was cut short',
      'An LLM on Groq (gpt-oss-120b, with smaller backups) extracts the records as JSON; the Validator repairs it and sends the exact problems back to the model, up to 3 attempts',
      'Locate matches each record to a repeated block on the page, so every record is marked and numbered on a screenshot and gets an "open ↗" link taken from the page itself, not guessed by the model',
    ],
    result: '30 of 30 Hacker News stories, each marked on the page',
    results: [
      'Books to Scrape: 20 of 20 books, each marked on the page with its own book link',
      'Hacker News: 30 of 30 stories, and every "open ↗" matches the story’s link',
      'A "Load more" page (scrapingcourse.com): 48 products after 3 presses, against 12 without',
      'Naukri job search, a JavaScript app with cookie banners: a full page of jobs, with a mark on each job card',
      'Honest about gaps: notes say when text was cut off, a backup model answered, or a page returned far fewer records than the others',
    ],
    metric: { value: '30/30', label: 'Hacker News stories · every link matches' },
    architecture: ['Navigate', 'Distill', 'Extract', 'Validate', 'Locate'],
    stack: ['Python', 'FastAPI', 'Playwright', 'Groq', 'React'],
    keywords: ['markpull', 'scraper', 'web scraper', 'scraping', 'agentic', 'agentic web scraper'],
    links: {
      code: 'https://github.com/KULLOLLITARUN/Agentic-Web-Scraper',
    },
  },
  {
    code: 'IMPACT',
    title: 'AI Impact',
    subtitle: 'Change-impact and test-gap analysis for Python',
    year: '2026',
    description:
      'Analyzes the statically discoverable blast radius of a Python code change, finds likely test gaps and, optionally, uses an LLM to explain the findings in plain language. The deterministic core needs no API key, and every number in a report traces back to the diff and the repo’s own call graph.',
    problem:
      'A code change reaches beyond the lines in the diff: it affects callers, and it may or may not be exercised by any test.',
    approach: [
      'Pipeline: git diff, AST, static approximate call graph, backward blast-radius walk, test-coverage mapping, deterministic risk score, report',
      'For each changed function it reports whether the signature changed and which callers are affected, tiered by distance: a direct caller is HIGH, two hops MEDIUM, three hops LOW',
      'The core engine has no third-party dependencies (Python 3.10+ and git), and it never invents a caller, a risk level or a dollar figure',
      'CLI with exit codes for CI gating (0 none or LOW, 1 MEDIUM, 2 HIGH, 3 analysis error), and an MCP server that exposes four tools to agentic IDEs',
      'Optional explanation with Gemini or Groq: the model only sees the already-computed evidence and cannot change a risk label or invent a caller; with no key, the evidence is still printed',
    ],
    result: 'Blast radius and test gaps, with the evidence behind every risk label',
    results: [
      '14 of 14 automated tests pass (fixture-driven, no network calls)',
      'Checked end to end against live Gemini and Groq calls, producing correctly grounded explanations',
      'Core engine, CLI, MCP server and AI explanation are implemented; an editor UI is planned, not started',
      'States its limits up front: static analysis rather than proof, a static approximation of test mapping, single repo only',
    ],
    metric: { value: '14/14', label: 'Tests passing · no network calls' },
    architecture: ['Diff', 'AST', 'Call graph', 'Blast radius', 'Test map', 'Risk score'],
    stack: ['Python', 'MCP', 'Gemini', 'Groq'],
    keywords: ['ai-impact', 'ai impact', 'impact', 'blast radius', 'test gap', 'change impact'],
    links: {
      code: 'https://github.com/KULLOLLITARUN/ai-impact',
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
