import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRow, useTitle } from '../catalog/queries'
import { getRow } from '../catalog/rows'
import type { TitleSummary } from '../providers'
import { OPEN_MOVIES } from '../providers/openMovies'
import { useLibrary } from '../state/library'
import { titlePath } from '../ui/paths'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/States'

/** Vertical, swipeable feed of muted previews from short open-licensed titles. */
export default function Clips() {
  const { data, isPending } = useRow(getRow('cartoons')!)
  const feed = useMemo(() => interleave(OPEN_MOVIES, data?.items ?? []), [data])
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)

  if (isPending) return <Spinner />
  return (
    <div className="clips">
      {feed.map((t, i) => (
        <Clip
          key={t.key}
          title={t}
          index={i}
          active={i === active}
          near={Math.abs(i - active) <= 1}
          muted={muted}
          onMute={() => setMuted((m) => !m)}
          onVisible={setActive}
        />
      ))}
    </div>
  )
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (b[i]) out.push(b[i])
    if (a[i]) out.push(a[i])
  }
  return out
}

interface ClipProps {
  title: TitleSummary
  index: number
  active: boolean
  near: boolean
  muted: boolean
  onMute: () => void
  onVisible: (i: number) => void
}

function Clip({ title, index, active, near, muted, onMute, onVisible }: ClipProps) {
  const ref = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const lib = useLibrary()
  const { data } = useTitle(near ? title.provider : undefined, near ? title.id : undefined)
  const t = data ?? title
  const mp4 = data?.episodes[0]?.sources.find((s) => s.type === 'mp4')
  const inList = lib.inMyList(title.key)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(index), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [index, onVisible])

  useEffect(() => {
    const v = video.current
    if (!v) return
    if (active) v.play().catch(() => undefined)
    else v.pause()
  }, [active, mp4])

  // Start a little way in so the preview skips titles and logos.
  const start = Math.min(90, Math.floor((data?.episodes[0]?.durationSec ?? 300) * 0.15))

  return (
    <article ref={ref} className="clip" aria-label={t.name}>
      {mp4 && near ? (
        <video ref={video} className="clip__video" src={`${mp4.url}#t=${start}`} muted={muted} loop playsInline preload="metadata" poster={t.backdrop ?? t.poster} />
      ) : (
        <img className="clip__video" src={t.backdrop ?? t.poster} alt="" />
      )}
      <div className="clip__shade" />
      <div className="clip__info">
        <h2 className="clip__title">{t.name}</h2>
        {t.tags.length > 0 && <p className="clip__tags">{t.tags.slice(0, 3).join('  •  ')}</p>}
        {t.synopsis && <p className="clip__synopsis">{t.synopsis}</p>}
        <span className="badge">{t.license.label}</span>
      </div>
      <div className="clip__actions">
        <button className="action" onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          <Icon name={muted ? 'mute' : 'volume'} size={28} />
        </button>
        <button className="action" onClick={() => lib.toggleMyList(t)} aria-pressed={inList} aria-label={inList ? 'Remove from My List' : 'Add to My List'}>
          <Icon name={inList ? 'check' : 'plus'} size={28} />
          <span>My List</span>
        </button>
        <Link className="action" to={titlePath(t)} aria-label={`More details for ${t.name}`}>
          <Icon name="info" size={28} />
          <span>Details</span>
        </Link>
      </div>
      {active && !mp4 && near && <div className="clip__loading"><Spinner /></div>}
    </article>
  )
}
