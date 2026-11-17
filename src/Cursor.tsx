import { useEffect, useRef } from 'react'

type Props = { glow: boolean; modalOpen: boolean }

const FINE = '(hover: hover) and (pointer: fine)'
const TRAIL_MS = 450 // how long a point lives; the whole trail is gone this long after the mouse stops
const MAX_POINTS = 24
const SUBDIVIDE = 4 // spline samples between neighbouring points
const HOVER = 'a,button,input,summary,label,[role="button"]'

type Pt = { x: number; y: number; t: number; w: number; h: number }
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** One continuous tapered ribbon through the recent cursor path: Catmull-Rom for the centre line, quadratic midpoints for the outline. */
function drawRibbon(ctx: CanvasRenderingContext2D, pts: Pt[], now: number, dpr: number) {
  const n = pts.length
  const life = (t: number) => Math.max(0, 1 - (now - t) / TRAIL_MS)

  const centre: { x: number; y: number; w: number }[] = []
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, n - 1)]
    for (let s = 0; s < SUBDIVIDE; s++) {
      const u = s / SUBDIVIDE
      const u2 = u * u
      const u3 = u2 * u
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3)
      const t = p1.t + (p2.t - p1.t) * u
      const w = (p1.w + (p2.w - p1.w) * u) * Math.pow(life(t), 0.9) // width shrinks with age, so head is thickest
      centre.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), w })
    }
  }
  const last = pts[n - 1]
  centre.push({ x: last.x, y: last.y, w: last.w * Math.pow(life(last.t), 0.9) })

  const left: { x: number; y: number }[] = []
  const right: { x: number; y: number }[] = []
  for (let i = 0; i < centre.length; i++) {
    const a = centre[Math.max(i - 1, 0)]
    const b = centre[Math.min(i + 1, centre.length - 1)]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    const nx = (-ty / len) * (centre[i].w / 2)
    const ny = (tx / len) * (centre[i].w / 2)
    left.push({ x: centre[i].x + nx, y: centre[i].y + ny })
    right.push({ x: centre[i].x - nx, y: centre[i].y - ny })
  }
  const outline = [...left, ...right.reverse()]

  // Rainbow runs tail to head along the ribbon; each point carries its own (unwrapped) hue and fades with age.
  const tail = centre[0]
  const head = centre[centre.length - 1]
  if (Math.hypot(head.x - tail.x, head.y - tail.y) < 2) return
  const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
  pts.forEach((p, i) => grad.addColorStop(i / (n - 1), `hsla(${p.h},92%,62%,${(0.92 * life(p.t)).toFixed(3)})`))

  ctx.beginPath()
  const m0 = mid(outline[outline.length - 1], outline[0])
  ctx.moveTo(m0.x, m0.y)
  for (let i = 0; i < outline.length; i++) {
    const m = mid(outline[i], outline[(i + 1) % outline.length])
    ctx.quadraticCurveTo(outline[i].x, outline[i].y, m.x, m.y)
  }
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.shadowColor = `hsla(${last.h},92%,62%,0.7)`
  ctx.shadowBlur = 18 * dpr // shadow blur is in device pixels and ignores the transform
  ctx.fill()
  ctx.shadowBlur = 0
}

/** Spring cursor (dot + lagging ring) and a rainbow ribbon trail, both above the whole page. Renders nothing on touch devices. */
export default function Cursor({ glow, modalOpen }: Props) {
  const fine = useRef(matchMedia(FINE).matches)
  const layer = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef(glow)
  glowRef.current = glow

  // Popovers and modal <dialog>s share the top layer, last shown wins: re-show the cursor whenever the drawer opens.
  useEffect(() => {
    const el = layer.current
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
    let moved = false
    let sampled = { x: 0, y: 0, t: 0 }
    let speed = 0
    let hue = 0
    const pts: Pt[] = []
    let raf = 0
    let prevT: number | undefined

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      mouse.x = e.clientX
      mouse.y = e.clientY
      if (!seen) {
        seen = true
        ringPos.x = sampled.x = mouse.x
        ringPos.y = sampled.y = mouse.y
        sampled.t = performance.now()
        layer.current!.style.opacity = '1'
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
      moved = true
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const onLeave = () => {
      layer.current!.style.opacity = '0'
      seen = false
    }

    const frame = (now: number) => {
      raf = 0
      // Close ~15% of the gap per 60fps frame, independent of the actual frame rate.
      const k = 1 - Math.pow(0.85, (now - (prevT ?? now)) / 16.67 || 1)
      prevT = now
      ringPos.x += (target.x - ringPos.x) * k
      ringPos.y += (target.y - ringPos.y) * k
      scale += (scaleTarget - scale) * Math.min(k * 1.6, 1)
      dot.current!.style.transform = `translate3d(${mouse.x}px,${mouse.y}px,0) translate(-50%,-50%)`
      ring.current!.style.transform = `translate3d(${ringPos.x}px,${ringPos.y}px,0) translate(-50%,-50%) scale(${scale})`

      // One sample per frame (not per mouse event) keeps spacing even whatever the mouse polling rate is.
      if (moved) {
        moved = false
        const dx = mouse.x - sampled.x
        const dy = mouse.y - sampled.y
        const dist = Math.hypot(dx, dy)
        if (glowRef.current && !reduced && dist > 0.5) {
          speed += (Math.min(dist / Math.max(now - sampled.t, 1), 3) - speed) * 0.3
          hue += dist * 0.35 + 0.5 // colour advances with movement and with time
          pts.push({ x: mouse.x, y: mouse.y, t: now, w: 4 + speed * 7, h: hue })
          if (pts.length > MAX_POINTS) pts.shift()
        }
        sampled = { x: mouse.x, y: mouse.y, t: now }
      }
      while (pts.length && now - pts[0].t > TRAIL_MS) pts.shift()

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      if (pts.length >= 3) drawRibbon(ctx, pts, now, dpr)

      const settled =
        Math.abs(target.x - ringPos.x) < 0.1 && Math.abs(target.y - ringPos.y) < 0.1 && Math.abs(scaleTarget - scale) < 0.005
      if (pts.length || moved || !settled) raf = requestAnimationFrame(frame)
      else prevT = undefined // idle: no loop until the next move
    }

    addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave)
    return () => {
      root.classList.remove('has-cursor')
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  if (!fine.current) return null
  return (
    <div ref={layer} popover="manual" aria-hidden="true" className="cursor-layer" style={{ opacity: 0 }}>
      <canvas ref={canvas} className="cursor-trail" style={{ visibility: glow ? 'visible' : 'hidden' }} />
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  )
}
