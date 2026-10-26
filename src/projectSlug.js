// URL-friendly id for a project, used in #project/<slug> links (and by Kairo's "Open case study" action).
export const projectSlug = (e) => e.slug || e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
