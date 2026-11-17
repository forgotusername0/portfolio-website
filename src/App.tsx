import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { settings, type Project } from './content'
import { Nav, Hero, Work, Approach, About, Contact } from './sections'
import Drawer from './Drawer'
import GlowToggle from './GlowToggle'
import Cursor from './Cursor'

const GLOW_KEY = 'glow'
const savedGlow = () => {
  try {
    const v = localStorage.getItem(GLOW_KEY)
    return v === null ? settings.glowDefault : v === '1'
  } catch {
    return settings.glowDefault
  }
}

export default function App() {
  const [glow, setGlow] = useState(savedGlow)
  const [project, setProject] = useState<Project | null>(null) // stays set while the drawer slides shut
  const [open, setOpen] = useState(false)
  const lenis = useRef<Lenis | null>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent)
  }, [])

  const toggleGlow = (on: boolean) => {
    setGlow(on)
    try {
      localStorage.setItem(GLOW_KEY, on ? '1' : '0')
    } catch {
      /* private mode: the choice just will not persist */
    }
  }

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
      <div className="relative z-10">
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
      <Cursor glow={glow} modalOpen={open} />
      {settings.showColorTester && <GlowToggle glow={glow} onGlow={toggleGlow} />}
    </>
  )
}
