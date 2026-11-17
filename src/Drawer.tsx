import { useEffect, useRef, useState } from 'react'
import { asset, settings, type Project } from './content'

type Props = { project: Project | null; open: boolean; onClose: () => void }

/** Full-height slide-over. A native <dialog> gives focus trapping, Esc to close and an inert page for free. */
export default function Drawer({ project, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.scrollTop = 0
    }
    if (!open && dialog.open) dialog.close()
  }, [open, project])

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="drawer-title"
      data-lenis-prevent
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()} // a click on the dimmed page
    >
      {project && <Body key={project.title} project={project} onClose={() => ref.current?.close()} />}
    </dialog>
  )
}

function Body({ project: p, onClose }: { project: Project; onClose: () => void }) {
  const t = settings.drawer
  const [viewing, setViewing] = useState(false)
  const images = [p.cover, ...(p.gallery ?? [])].filter(Boolean) // the cover leads the gallery
  const summary = [
    [t.challenge, p.challenge],
    [t.insight, p.insight],
    [t.execution, p.execution],
    [t.results, p.results],
  ]

  return (
    <article className="min-h-full px-5 pt-5 pb-16 sm:px-10 sm:pt-8">
      <div className="sticky top-0 z-10 -mx-2 flex justify-end">
        <button type="button" onClick={onClose} className="btn btn-glass glass">
          {t.closeLabel}
        </button>
      </div>

      <header className="mt-4">
        <h2 id="drawer-title" className="display text-[clamp(1.75rem,4.4vw,2.75rem)] leading-[1.04]">
          {p.title}
        </h2>
        <dl className="mt-7 grid gap-x-8 gap-y-4 border-y border-line py-5 sm:grid-cols-2">
          {[
            [t.clientLabel, p.client],
            [t.roleLabel, p.role],
            [t.yearLabel, p.year],
            [t.metricLabel, p.metric],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="mt-12">
        <h3 className="text-xl font-semibold [font-stretch:112%]">{t.summaryTitle}</h3>
        <dl className="mt-4">
          {summary.map(([label, text]) => (
            <div key={label} className="grid gap-1.5 border-t border-line py-5 sm:grid-cols-[10rem_1fr] sm:gap-8">
              <dt className="pt-1 text-[0.9375rem] font-semibold">{label}</dt>
              <dd className="prose-serif">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {images.length > 0 && (
        <section className="mt-12">
          <h3 className="text-xl font-semibold [font-stretch:112%]">{t.galleryTitle}</h3>
          <div className="mt-5 space-y-3">
            {images.map((src, i) => (
              <a
                key={src}
                href={asset(src)}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-2xl border border-white/70 bg-white/50"
              >
                <img src={asset(src)} alt={`${p.title}, image ${i + 1}`} loading="lazy" className="block w-full" />
              </a>
            ))}
          </div>
        </section>
      )}

      {p.pdf && (
        <section className="mt-12">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="mr-auto text-xl font-semibold [font-stretch:112%]">{t.pdfTitle}</h3>
            <button type="button" className="btn btn-solid" aria-expanded={viewing} onClick={() => setViewing(!viewing)}>
              {viewing ? t.hidePdf : t.viewPdf}
            </button>
            <a href={asset(p.pdf)} download className="btn btn-glass glass">
              {t.downloadPdf}
            </a>
          </div>
          {/* ponytail: the browser's own PDF viewer. Phones often will not inline a PDF, so Download stays beside it; swap in pdf.js if in-page viewing on mobile matters. */}
          {viewing && (
            <iframe
              src={`${asset(p.pdf)}#view=FitH`}
              title={`${p.title}: ${t.pdfTitle}`}
              className="mt-4 h-[75vh] w-full rounded-2xl border border-line bg-white"
            />
          )}
        </section>
      )}
    </article>
  )
}
