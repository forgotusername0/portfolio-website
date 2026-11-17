import { useState } from 'react'
import { settings } from './content'

type Props = {
  accent: string
  onAccent: (hex: string) => void
  glow: boolean
  onGlow: (on: boolean) => void
}

const { swatches } = settings.colorTester

/** Live accent tester plus the cursor glow switch. Nothing is saved: copy the hex into Pages CMS (Accent Hex Color). */
export default function ColorPill({ accent, onAccent, glow, onGlow }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(accent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <aside className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2 text-sm" aria-label="Color and glow">
      {open && (
        <div className="glass w-[17rem] rounded-3xl p-4">
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              className="swatch shrink-0"
              value={accent}
              aria-label="Accent color"
              onChange={(e) => onAccent(e.target.value)}
            />
            <span className="mr-auto font-medium">Accent</span>
            <button
              type="button"
              onClick={copy}
              aria-label={`Copy hex ${accent}`}
              className="cursor-pointer rounded-full border border-line bg-white/60 px-2.5 py-1 tabular-nums hover:bg-white"
            >
              {copied ? 'Copied' : accent}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {swatches.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => onAccent(hex)}
                aria-label={`Set accent to ${hex}`}
                className="size-6 cursor-pointer rounded-full shadow-[0_0_0_1px_var(--color-line)] transition-transform hover:scale-110"
                style={{ background: hex }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onAccent(settings.accent)}
            className="btn btn-glass mt-4 min-h-9 w-full border border-line px-3 text-[0.8125rem]"
          >
            Reset
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={glow}
          onClick={() => onGlow(!glow)}
          className="glass cursor-pointer rounded-full px-3.5 py-2 font-medium max-sm:hidden"
        >
          Glow: {glow ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="glass flex cursor-pointer items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 font-medium"
        >
          <span className="size-6 rounded-full shadow-[0_0_0_1px_var(--color-line)]" style={{ background: accent }} />
          {open ? 'Close' : accent}
        </button>
      </div>
    </aside>
  )
}
