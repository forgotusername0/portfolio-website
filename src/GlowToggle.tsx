type Props = { glow: boolean; onGlow: (on: boolean) => void }

/** Tiny bottom-right switch for the mouse trail. Only shown where the custom cursor runs (mouse devices). */
export default function GlowToggle({ glow, onGlow }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={glow}
      onClick={() => onGlow(!glow)}
      className="glass fixed right-4 bottom-4 z-30 hidden cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:text-ink [@media(hover:hover)_and_(pointer:fine)]:block"
    >
      Glow: {glow ? 'On' : 'Off'}
    </button>
  )
}
