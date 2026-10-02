// ─────────────────────────────────────────────────────────────
// ALL SITE CONTENT LIVES HERE.
// Edit this file to update the portfolio — no design changes needed.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'Tarun Kullolli',
  // Lines the particle field forms in the hero (desktop / mobile).
  particleText: { wide: ['TARUN KULLOLLI'], narrow: ['TARUN', 'KULLOLLI'] },
  role: 'AI Engineer',
  tagline: 'Python developer building intelligent, full-stack applications — from model to interface.',
  status: 'Open to work',
  summary:
    'Python Developer at Quintesys with a full-stack foundation in Django, React and Node. ' +
    'Builds scalable, user-friendly applications, with a focus on AI engineering: ' +
    'putting models to work inside real products.',
  email: 'Kullollitarun@gmail.com',
  phone: '+91 8897083343',
  // TODO: replace '#' with your real profile URLs.
  links: {
    linkedin: '#',
    github: '#',
  },
  resume: '/resume.pdf', // file lives in /public
}

// PLACEHOLDER PROJECTS — replace with your real AI projects.
// Each one renders as an "EXP" card. Links set to '#' are hidden.
export const experiments = [
  {
    code: 'COMMERCE',
    title: 'E-Shop',
    subtitle: 'Secure e-commerce platform',
    description:
      'E-commerce site with user authentication, dynamic product browsing and CSRF protection. Query optimisation cut load time.',
    stack: ['Django', 'MySQL', 'JavaScript', 'HTML/CSS'],
    result: '30% faster page loads',
    links: { code: '#', live: '#' },
  },
  {
    code: 'PUBLISH',
    title: 'Blogs Platform',
    subtitle: 'Full-stack publishing over REST',
    description:
      'Category-based blog creation, viewing and filtering. React frontend, Express + MySQL backend, mock and live data combined.',
    stack: ['React', 'Node.js', 'Express', 'MySQL'],
    result: 'REST API with category filtering',
    links: { code: '#', live: '#' },
  },
  {
    code: 'INTAKE',
    title: 'Enquiry System',
    subtitle: 'GUI intake with database + Excel sync',
    description:
      'Desktop enquiry system with dynamic form control, MySQL storage and Excel export for the admissions team.',
    stack: ['Python', 'Tkinter', 'MySQL', 'Excel'],
    result: '+50% registration tracking efficiency',
    links: { code: '#', live: '#' },
  },
  {
    code: 'STATE',
    title: 'Task Engine',
    subtitle: 'Modular React to-do app',
    description:
      'Context API for predictable state management and LocalStorage for persistence across sessions.',
    stack: ['React', 'Context API', 'LocalStorage'],
    result: 'Persistent state, zero backend',
    links: { code: '#', live: '#' },
  },
  {
    code: 'INTERFACE',
    title: 'Apple Clone',
    subtitle: 'Responsive product-site study',
    description:
      'Apple-themed website clone built with modern CSS and interactive JavaScript, tuned for mobile usability.',
    stack: ['HTML', 'CSS', 'JavaScript'],
    result: 'Mobile-first responsive layout',
    links: { code: '#', live: '#' },
  },
]

// Career told in four acts.
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
    title: 'Python Developer',
    org: 'Quintesys Pvt. Ltd',
    // TODO: add 2–3 bullet points with what you build here (numbers help).
    points: ['Building Python software in a production team.'],
  },
  {
    act: 'IV',
    name: 'Next',
    period: 'Now',
    title: 'AI Engineering',
    org: 'Open to work',
    points: ['Bringing Python and full-stack experience to AI-powered products: LLM apps, data pipelines, intelligent interfaces.'],
  },
]

// Groups with no items are hidden automatically.
export const skills = [
  { group: 'Languages', items: ['Python', 'JavaScript', 'HTML', 'CSS'] },
  // TODO: add your AI / ML tools, e.g. PyTorch, scikit-learn, LangChain, OpenAI / Claude APIs, Hugging Face.
  { group: 'AI / ML', items: [] },
  { group: 'Frameworks', items: ['React', 'Django', 'Node.js', 'Express'] },
  { group: 'Data', items: ['MySQL', 'MongoDB'] },
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
