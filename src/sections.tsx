import { useState, type CSSProperties } from 'react'
import { asset, projects, settings, socials, type Project } from './content'

const shell = 'mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12'

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-20">
      <div className={`${shell} flex items-center justify-between gap-1.5 py-3 max-sm:px-3 sm:gap-3 sm:py-4`}>
        <a
          href="#top"
          className="display glass rounded-full px-3 py-2 text-[0.8rem] leading-normal whitespace-nowrap sm:px-4 sm:text-base"
        >
          {settings.name}
        </a>
        <nav
          aria-label="Main"
          className="glass flex items-center gap-2 rounded-full px-3 py-2 text-[0.78rem] font-medium whitespace-nowrap sm:gap-5 sm:px-5 sm:text-sm"
        >
          {settings.nav.map((item) => (
            <a key={item.href} href={item.href} className="transition-opacity hover:opacity-60">
              {item.label}
            </a>
          ))}
          {socials.length > 0 && (
            <span className="hidden items-center gap-4 border-l border-line pl-5 text-mist md:flex">
              {socials.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${s.label}: ${s.handle || settings.name}`}
                  className="transition-colors hover:text-ink"
                >
                  {s.handle || s.label}
                </a>
              ))}
            </span>
          )}
        </nav>
      </div>
    </header>
  )
}

export function Hero() {
  const { hero } = settings
  const snap = settings.snapshot
  const step = (i: number) => ({ '--i': i }) as CSSProperties
  return (
    <section id="top" className={`${shell} pt-[7.5rem] pb-10 lg:pb-14`}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="rise text-sm font-medium tracking-[0.08em] text-mist uppercase" style={step(0)}>
            {hero.eyebrow}
          </p>
          <h1 className="display mt-5 text-[clamp(2.6rem,6.8vw,6.25rem)]">
            {hero.headline.map((line, i) => (
              <span key={line} className="rise block" style={step(i + 1)}>
                {line}
              </span>
            ))}
          </h1>
          <p className="prose-serif rise mt-7 max-w-[34rem] text-[1.3125rem] leading-snug sm:text-2xl" style={step(hero.headline.length + 1)}>
            {hero.statement}
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={step(hero.headline.length + 2)}>
            <a href={hero.primaryCta.href} className="btn btn-solid">
              {hero.primaryCta.label}
            </a>
            <a href={hero.secondaryCta.href} className="btn btn-glass glass">
              {hero.secondaryCta.label}
            </a>
            <ResumeLink />
          </div>
        </div>

        <aside
          aria-labelledby="snapshot-title"
          className="glass rise rounded-[1.75rem] p-6 sm:p-7 lg:col-span-5 lg:self-end"
          style={step(hero.headline.length + 2)}
        >
          <h2 id="snapshot-title" className="text-lg font-semibold [font-stretch:112%]">
            {hero.snapshot.title}
          </h2>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="label">{hero.snapshot.location}</dt>
              <dd className="mt-0.5 font-medium">{snap.location}</dd>
            </div>
            <div>
              <dt className="label">{hero.snapshot.education}</dt>
              <dd className="mt-0.5 font-medium">{snap.education}</dd>
            </div>
            <div>
              <dt className="label">{hero.snapshot.disciplines}</dt>
              <dd>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {snap.disciplines.map((d) => (
                    <li key={d} className="rounded-full border border-line bg-white/60 px-3 py-1 text-sm font-medium">
                      {d}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <p className="mt-6 flex items-center gap-2.5 border-t border-line pt-4 text-[0.9375rem] font-medium">
            <span className="relative flex size-2.5" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative size-2.5 rounded-full bg-emerald-500" />
            </span>
            {snap.status}
          </p>
        </aside>
      </div>
    </section>
  )
}

/** Renders nothing until a resume link is set in site-settings.json. */
function ResumeLink() {
  if (!settings.resumeUrl) return null
  return (
    <a href={asset(settings.resumeUrl)} target="_blank" rel="noreferrer" className="btn btn-glass glass">
      {settings.resumeLabel}
    </a>
  )
}

function SectionHead({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="display text-[clamp(2rem,4.6vw,4.25rem)]">{title}</h2>
      <p className="prose-serif mt-5 max-w-[38rem] text-mist">{intro}</p>
    </div>
  )
}

// Wide and narrow cards alternate so the grid reads as an edited spread, not a product shelf.
const spans = ['lg:col-span-7', 'lg:col-span-5', 'lg:col-span-5', 'lg:col-span-7']

export function Work({ onOpen }: { onOpen: (p: Project) => void }) {
  const { work, drawer } = settings
  return (
    <section id="work" className={`${shell} py-24 sm:py-32`}>
      <SectionHead title={work.title} intro={work.intro} />
      <ul className="mt-12 grid gap-5 sm:mt-16 lg:grid-cols-12 lg:gap-6">
        {projects.map((p, i) => (
          <li key={p.title} className={spans[i % spans.length]}>
            <button
              type="button"
              onClick={() => onOpen(p)}
              aria-label={`${work.openLabel}: ${p.title}`}
              className="glass group flex h-full w-full cursor-pointer flex-col rounded-[1.75rem] p-3 text-left transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.85),0_36px_70px_-34px_rgb(36_48_94/0.5)] sm:p-4"
            >
              <span className="relative block aspect-video overflow-hidden rounded-[1.1rem] bg-white/50">
                {p.cover && (
                  <img
                    src={asset(p.cover)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                )}
                <span className="absolute right-3 bottom-3 rounded-full bg-ink px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {work.openLabel}
                </span>
              </span>

              <span className="flex flex-1 flex-col px-2 pt-5 pb-2 sm:px-3">
                <span className="display block text-xl leading-[1.08] sm:text-2xl">{p.title}</span>
                <span className="prose-serif mt-2 block text-mist">{p.client}</span>
                <span className="mt-3 mb-5 self-start rounded-full border border-line bg-white/60 px-3 py-1 text-[0.8125rem] font-medium">
                  {p.role}
                </span>

                <span className="mt-auto grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-line pt-4 text-[0.9375rem]">
                  <span className="label">{drawer.yearLabel}</span>
                  <span>{p.year}</span>
                  <span className="label">{drawer.metricLabel}</span>
                  <span className="font-medium">{p.metric}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Approach() {
  const { approach } = settings
  return (
    <section id="approach" className={`${shell} py-24 sm:py-32`}>
      <div className="lg:ml-auto lg:w-[62%]">
        <SectionHead title={approach.title} intro={approach.intro} />
        <dl className="mt-12 border-t border-line">
          {approach.principles.map((p) => (
            <div key={p.title} className="grid gap-2 border-b border-line py-7 md:grid-cols-[16rem_1fr] md:gap-10">
              <dt className="text-lg leading-snug font-semibold [font-stretch:112%]">{p.title}</dt>
              <dd className="prose-serif">{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export function About() {
  const { about } = settings
  return (
    <section id="about" className={`${shell} py-24 sm:py-32`}>
      <div className="lg:w-[56%]">
        <h2 className="display text-[clamp(2rem,4.6vw,4.25rem)]">{about.title}</h2>
        <div className="mt-6 space-y-5">
          {about.paragraphs.map((text, i) => (
            <p key={text} className={`prose-serif ${i === 0 ? 'text-[1.3125rem] leading-snug sm:text-2xl' : ''}`}>
              {text}
            </p>
          ))}
        </div>
        <h3 className="label mt-10">{about.toolkitLabel}</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {about.toolkit.map((item) => (
            <li key={item} className="glass rounded-full px-3.5 py-1.5 text-sm font-medium">
              {item}
            </li>
          ))}
        </ul>
        {settings.resumeUrl && (
          <div className="mt-8">
            <ResumeLink />
          </div>
        )}
      </div>
    </section>
  )
}

export function Contact() {
  const { contact, email } = settings
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <section id="contact" className={`${shell} flex min-h-svh flex-col pt-24 sm:pt-32`}>
      <div className="m-auto flex max-w-4xl flex-col items-center py-12 text-center">
        <h2 className="display text-[clamp(2rem,5vw,4.5rem)]">{contact.title}</h2>
        <p className="prose-serif mt-6 text-ink/80">{contact.body}</p>
        <a
          href={`mailto:${email}`}
          className="mt-8 text-[clamp(1.2rem,3.4vw,2.5rem)] font-medium break-all underline decoration-1 underline-offset-[0.25em] transition-opacity [font-stretch:112%] hover:opacity-60"
        >
          {email}
        </a>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={copy} className="btn btn-glass glass">
            <span aria-live="polite">{copied ? contact.copiedLabel : contact.copyLabel}</span>
          </button>
          <ResumeLink />
          {socials.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="btn btn-glass glass">
              {s.label}
              {s.handle && <span className="text-mist">{s.handle}</span>}
            </a>
          ))}
        </div>
      </div>
      <footer className="flex flex-wrap justify-between gap-x-8 gap-y-1 border-t border-line pt-6 pb-16 text-[0.8125rem] text-ink/75 sm:py-6 sm:pr-32">
        <span>
          © {new Date().getFullYear()} {settings.name}
        </span>
        <span>{settings.footer}</span>
      </footer>
    </section>
  )
}
