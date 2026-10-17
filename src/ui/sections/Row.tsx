import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../Icon'

interface Props {
  title: string
  seeAll?: string
  children: ReactNode
}

/** A titled, horizontally scrolling row with arrow buttons on wide screens. */
export function Row({ title, seeAll, children }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <section className="row" aria-label={title}>
      <header className="row__head">
        <h2 className="row__title">{title}</h2>
        {seeAll && (
          <Link to={seeAll} className="row__see-all">
            See all <Icon name="chevron" size={16} />
          </Link>
        )}
      </header>
      <div className="row__viewport">
        <button className="row__arrow row__arrow--prev" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} tabIndex={-1}>
          <Icon name="back" />
        </button>
        <div className="row__track" ref={track}>
          {children}
        </div>
        <button className="row__arrow row__arrow--next" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} tabIndex={-1}>
          <Icon name="chevron" />
        </button>
      </div>
    </section>
  )
}
