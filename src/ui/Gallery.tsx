import { useEffect, useRef } from 'react'
import type { TitleSummary } from '../providers'
import { TitleCard } from './cards'
import { Spinner } from './States'

interface Props {
  items: TitleSummary[]
  hasMore?: boolean
  loading?: boolean
  onMore?: () => void
}

/** Responsive poster grid with infinite scroll (plus a button fallback). */
export function Gallery({ items, hasMore, loading, onMore }: Props) {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || !onMore || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) onMore()
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, onMore])

  return (
    <>
      <div className="gallery">
        {items.map((t, i) => (
          <TitleCard key={t.key} title={t} priority={i < 6} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinel} className="gallery__more">
          {loading ? (
            <Spinner />
          ) : (
            <button className="btn btn--secondary" onClick={onMore}>
              Load more
            </button>
          )}
        </div>
      )}
    </>
  )
}
