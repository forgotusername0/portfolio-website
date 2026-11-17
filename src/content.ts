import site from './content/site-settings.json' // edited in Pages CMS
import copy from './content/site-copy.json' // section copy and labels
import projectsJson from './content/projects.json' // edited in Pages CMS

const lines = (text: string, separator: RegExp) =>
  text
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean)

export const settings = {
  ...copy,
  name: site.name,
  email: site.email,
  resumeUrl: site.resume ?? '',
  showColorTester: site.showColorTester,
  accent: site.accent,
  glowDefault: site.glow,
  hero: { ...copy.hero, headline: lines(site.heroHeadline, /\n/), statement: site.heroStatement },
  about: { ...copy.about, paragraphs: lines(site.bio, /\n\s*\n/) },
}

export type Project = (typeof projectsJson)[number]
export const projects: Project[] = projectsJson

/** Resolves a path from the JSON files: full URLs pass through; "/uploads/x" and "uploads/x" both resolve against the site root. */
export const asset = (path: string) =>
  /^([a-z]+:)?\/\//i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\/+/, '')

export const socials = site.socials
  .filter((s) => s.url)
  .map((s) => ({ label: s.platform, handle: s.handle, url: s.url }))
