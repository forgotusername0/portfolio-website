import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { settings, type Project } from './content'
import { Nav, Hero, Work, Approach, About, Contact } from './sections'
import Drawer from './Drawer'
import ColorPill from './ColorPill'

// three.js is most of the bundle; load it after the page content has painted.
const Scene = lazy(() => import('./Scene'))

export default function App() {
  const [colors, setColors] = useState(settings.sphere.colors)
  const [project, setProject] = useState<Project | null>(null) // stays set while the drawer slides shut
  const [open, setOpen] = useState(false)
  const lenis = useRef<Lenis | null>(null)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const l = (lenis.current = new Lenis({ autoRaf: true, anchors: true }))
    return () => l.destroy()
  }, [])

  // Smooth scroll would keep moving the page under the open drawer.
  useEffect(() => {
    if (open) lenis.current?.stop()
    else lenis.current?.start()
  }, [open])

  return (
    <>
      <Suspense fallback={null}>
        <Scene colors={colors} drawerOpen={open} />
      </Suspense>
      <div className="relative">
        <Nav />
        <main>
          <Hero />
          <Work
            onOpen={(p) => {
              setProject(p)
              setOpen(true)
            }}
          />
          <Approach />
          <About />
          <Contact />
        </main>
      </div>
      <Drawer project={project} open={open} onClose={() => setOpen(false)} />
      {settings.showColorTester && <ColorPill colors={colors} onChange={setColors} />}
    </>
  )
}
