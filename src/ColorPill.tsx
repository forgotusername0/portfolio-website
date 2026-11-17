import { useState } from 'react'
import { settings, type SphereColors } from './content'

type Key = keyof SphereColors
type Props = { colors: SphereColors; onChange: (c: SphereColors) => void }

const { colorLabels, swatches } = settings.sphere
const keys = Object.keys(settings.sphere.colors) as Key[]

/** Live colour tester for the sphere. Nothing is saved: copy a hex (or the whole block) into site-settings.json. */
export default function ColorPill({ colors, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Key>('tint')
  const [copied, setCopied] = useState('')

  const set = (key: Key, hex: string) => onChange({ ...colors, [key]: hex })
  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 1600)
  }

  return (
    <aside className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2 text-sm" aria-label="Sphere colour tester">
      {open && (
        <div className="glass w-[17.5rem] rounded-3xl p-4">
          <ul className="space-y-2.5">
            {keys.map((key) => (
              <li key={key} className="flex items-center gap-2.5">
                <input
                  type="color"
                  className="swatch shrink-0"
                  value={colors[key]}
                  aria-label={colorLabels[key]}
                  onFocus={() => setActive(key)}
                  onChange={(e) => set(key, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setActive(key)}
                  aria-pressed={active === key}
                  className={`mr-auto cursor-pointer text-left font-medium ${active === key ? '' : 'text-mist'}`}
                >
                  {colorLabels[key]}
                </button>
                <button
                  type="button"
                  onClick={() => copy(key, colors[key])}
                  aria-label={`Copy ${colorLabels[key]} hex ${colors[key]}`}
                  className="cursor-pointer rounded-full border border-line bg-white/60 px-2.5 py-1 tabular-nums hover:bg-white"
                >
                  {copied === key ? 'Copied' : colors[key]}
                </button>
              </li>
            ))}
          </ul>

          <p className="label mt-4">Swatches for {colorLabels[active].toLowerCase()}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {swatches.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => set(active, hex)}
                aria-label={`Set ${colorLabels[active]} to ${hex}`}
                className="size-6 cursor-pointer rounded-full shadow-[0_0_0_1px_var(--color-line)] transition-transform hover:scale-110"
                style={{ background: hex }}
              />
            ))}
          </div>

          <div className="mt-4 flex gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => copy('all', `"colors": ${JSON.stringify(colors, null, 2)}`)}
              className="btn btn-solid min-h-9 flex-1 px-3 text-[0.8125rem]"
            >
              {copied === 'all' ? 'Copied' : 'Copy all as JSON'}
            </button>
            <button
              type="button"
              onClick={() => onChange(settings.sphere.colors)}
              className="btn btn-glass min-h-9 border border-line px-3 text-[0.8125rem]"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="glass flex cursor-pointer items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 font-medium"
      >
        <span className="size-6 rounded-full shadow-[0_0_0_1px_var(--color-line)]" style={{ background: colors.tint }} />
        {open ? 'Close' : colors.tint}
      </button>
    </aside>
  )
}
