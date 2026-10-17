import { useState } from 'react'

/** Deterministic hue from a string so fallback art stays stable per title. */
function hueOf(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

interface Props {
  src?: string
  title: string
  className?: string
  /** eager for above-the-fold images */
  priority?: boolean
}

/** Image with a generated gradient + title fallback for missing / broken artwork. */
export function Artwork({ src, title, className = '', priority = false }: Props) {
  const [failed, setFailed] = useState(false)
  const hue = hueOf(title)
  return (
    <div
      className={`artwork ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 45% 28%), hsl(${(hue + 40) % 360} 50% 12%))` }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="artwork__fallback">{title}</span>
      )}
    </div>
  )
}
