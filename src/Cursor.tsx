import { useEffect, useRef } from 'react'
import FluidCursorCanvas from './components/FluidCursorCanvas'

type Props = { glow: boolean; modalOpen: boolean }

const FINE = '(hover: hover) and (pointer: fine)'
const HOVER = 'a,button,input,summary,label,[role="button"]'

/** Spring cursor (dot + lagging ring) with the fluid dye canvas beneath it, all above the page. Renders nothing on touch devices. */
export default function Cursor({ glow, modalOpen }: Props) {
  const fine = useRef(matchMedia(FINE).matches)
  const layer = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

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

    const mouse = { x: -100, y: -100 }
    const target = { x: -100, y: -100 } // where the ring is heading (mouse plus magnetic pull)
    const ringPos = { x: -100, y: -100 }
    let scale = 1
    let scaleTarget = 1
    let seen = false
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
      const settled =
        Math.abs(target.x - ringPos.x) < 0.1 && Math.abs(target.y - ringPos.y) < 0.1 && Math.abs(scaleTarget - scale) < 0.005
      if (!settled) raf = requestAnimationFrame(frame)
      else prevT = undefined // idle: no loop until the next move
    }

    addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave)
    return () => {
      root.classList.remove('has-cursor')
      removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  if (!fine.current) return null
  return (
    <div ref={layer} popover="manual" aria-hidden="true" className="cursor-layer" style={{ opacity: 0 }}>
      <FluidCursorCanvas on={glow} />
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  )
}
