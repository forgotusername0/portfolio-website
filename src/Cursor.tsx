import { useEffect, useRef } from 'react'

type Props = { accent: string; glow: boolean; modalOpen: boolean }

const FINE = '(hover: hover) and (pointer: fine)'
const TRAIL_MS = 600
const HOVER = 'a,button,input,summary,label,[role="button"]'

// Soft round-capped segments: a wide faint pass under a narrow bright one reads as vapor without shadowBlur.
type Pt = { x: number; y: number; t: number; w: number }

/** Spring cursor (dot + lagging ring) and a short-lived ink trail. Renders nothing on touch devices. */
export default function Cursor({ accent, glow, modalOpen }: Props) {
  const fine = useRef(matchMedia(FINE).matches)
  const cursor = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ accent, glow })
  live.current = { accent, glow }

  // A modal <dialog> sits in the top layer, so the cursor has to be re-promoted above it each time one opens.
  useEffect(() => {
    const el = cursor.current
    if (!el || !('showPopover' in el)) return
    if (el.matches(':popover-open')) el.hidePopover()
    el.showPopover()
  }, [modalOpen])

  useEffect(() => {
    if (!fine.current) return
    const root = document.documentElement
    root.classList.add('has-cursor')
    const ctx = canvas.current!.getContext('2d')!
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    let dpr = 1
    const resize = () => {
      dpr = Math.min(devicePixelRatio, 2)
      canvas.current!.width = innerWidth * dpr
      canvas.current!.height = innerHeight * dpr
    }
    resize()
    addEventListener('resize', resize)

    const mouse = { x: -100, y: -100 }
    const target = { x: -100, y: -100 } // where the ring is heading (mouse plus magnetic pull)
    const ringPos = { x: -100, y: -100 }
    let scale = 1
    let scaleTarget = 1
    let seen = false
    const pts: Pt[] = []
    let last = { x: 0, y: 0, t: 0 }
    let raf = 0
    let prevT: number | undefined

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      mouse.x = e.clientX
      mouse.y = e.clientY
      if (!seen) {
        seen = true
        ringPos.x = mouse.x
        ringPos.y = mouse.y
        cursor.current!.style.opacity = '1'
      }
      const hit = (e.target as Element | null)?.closest?.(HOVER) ?? null
      target.x = mouse.x
      target.y = mouse.y
      if (hit) {
        const r = hit.getBoundingClientRect()
        // Small targets pull the ring toward their centre; big cards only grow it.
        if (r.width < 320 && r.height < 120) {
          target.x += (r.left + r.width / 2 - mouse.x) * 0.25
          target.y += (r.top + r.height / 2 - mouse.y) * 0.25
        }
      }
      scaleTarget = hit ? 1.6 : 1

      const now = performance.now()
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      const dt = Math.max(now - last.t, 1)
      if (live.current.glow && !reduced && dx * dx + dy * dy > 4) {
        const speed = Math.min(Math.hypot(dx, dy) / dt, 3) // px per ms
        pts.push({ x: e.clientX, y: e.clientY, t: now, w: 5 + speed * 9 })
      }
      last = { x: e.clientX, y: e.clientY, t: now }
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const onLeave = () => {
      cursor.current!.style.opacity = '0'
      seen = false
    }

    const frame = (now: number) => {
      raf = 0
      // Spring-ish lag: close 15% of the gap per frame at 60fps, frame-rate independent.
      const k = 1 - Math.pow(0.85, (now - (prevT ?? now)) / 16.67 || 1)
      prevT = now
      ringPos.x += (target.x - ringPos.x) * k
      ringPos.y += (target.y - ringPos.y) * k
      scale += (scaleTarget - scale) * Math.min(k * 1.6, 1)
      dot.current!.style.transform = `translate3d(${mouse.x}px,${mouse.y}px,0) translate(-50%,-50%)`
      ring.current!.style.transform = `translate3d(${ringPos.x}px,${ringPos.y}px,0) translate(-50%,-50%) scale(${scale})`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      while (pts.length && now - pts[0].t > TRAIL_MS) pts.shift()
      if (pts.length > 1) {
        ctx.lineCap = ctx.lineJoin = 'round'
        ctx.strokeStyle = live.current.accent
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]
          const b = pts[i]
          const life = 1 - (now - b.t) / TRAIL_MS // 1 at the head, 0 as it dissolves
          if (life <= 0 || b.t - a.t > 120) continue // a pause breaks the ribbon instead of bridging it
          const w = b.w * life
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.globalAlpha = 0.16 * life
          ctx.lineWidth = w * 3
          ctx.stroke()
          ctx.globalAlpha = 0.5 * life * life
          ctx.lineWidth = w
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      const settled = Math.abs(target.x - ringPos.x) < 0.1 && Math.abs(target.y - ringPos.y) < 0.1 && Math.abs(scaleTarget - scale) < 0.005
      if (pts.length || !settled) raf = requestAnimationFrame(frame)
      else prevT = undefined // idle: no loop until the next move
    }

    addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      root.classList.remove('has-cursor')
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Glow off: clear the canvas and stop adding to it (the frame loop drains any remaining points).
  if (!fine.current) return null
  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-0 h-lvh w-full"
        style={{ visibility: glow ? 'visible' : 'hidden' }}
      />
      <div ref={cursor} popover="manual" aria-hidden="true" className="cursor-layer" style={{ opacity: 0 }}>
        <div
          ref={ring}
          className="cursor-ring"
          style={{
            borderColor: glow ? `color-mix(in srgb, ${accent} 55%, #141a2b)` : 'rgb(20 26 43 / 0.55)',
            background: glow ? `color-mix(in srgb, ${accent} 16%, transparent)` : 'transparent',
          }}
        />
        <div ref={dot} className="cursor-dot" />
      </div>
    </>
  )
}

