import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from '../Icon'

export function PlayerPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    return () => previous?.focus()
  }, [])
  return (
    <div className="player__panel-layer" onClick={(event) => event.stopPropagation()}>
      <button className="player__panel-backdrop" aria-label={`Close ${title}`} onClick={onClose} tabIndex={-1} />
      <div ref={panel} className="player__panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') onClose()
          if (event.key !== 'Tab') return
          const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, [tabindex="0"]') ?? [])
          const first = elements[0]
          const last = elements.at(-1)
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
            event.preventDefault(); last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus()
          }
        }}>
        <header><h2>{title}</h2><button className="icon-btn" aria-label="Close panel" onClick={onClose}><Icon name="close" /></button></header>
        {children}
      </div>
    </div>
  )
}
