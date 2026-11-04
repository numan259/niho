import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRow, useTitle } from '../catalog/queries'
import { getRow } from '../catalog/rows'
import type { TitleSummary } from '../providers'
import { useLibrary } from '../state/library'
import { useActiveProfile } from '../state/profiles'
import { Icon } from '../ui/Icon'
import { titlePath } from '../ui/paths'
import { YOUTUBE_HOST, youtubeEmbedUrl } from '../ui/player/youtube'
import { ErrorMessage, Spinner } from '../ui/States'

/** Vertical, swipeable feed of muted trailers for this week's trending titles. */
export default function Clips() {
  const profile = useActiveProfile()!
  const { data, isPending, error, refetch } = useRow(getRow(profile.kids ? 'animation' : 'trending')!)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)

  if (isPending) return <Spinner />
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />
  return (
    <div className="clips">
      {data.items.map((t, i) => (
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

interface ClipProps {
  title: TitleSummary
  index: number
  active: boolean
  near: boolean
  muted: boolean
  onMute: () => void
  onVisible: (i: number) => void
}

/** Sends a command to an embedded YouTube player (enablejsapi=1). */
function command(frame: HTMLIFrameElement | null, func: 'mute' | 'unMute') {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), YOUTUBE_HOST)
}

function Clip({ title, index, active, near, muted, onMute, onVisible }: ClipProps) {
  const ref = useRef<HTMLElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const lib = useLibrary()
  // Only fetch details (and the trailer id) for the visible clip and its neighbours.
  const { data } = useTitle(near ? title.mediaType : undefined, near ? title.id : undefined)
  const t = data ?? title
  const trailer = data?.videos[0]
  const inList = lib.inMyList(title.key)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(index), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [index, onVisible])

  useEffect(() => {
    command(frame.current, muted ? 'mute' : 'unMute')
  }, [muted])

  return (
    <article ref={ref} className="clip" aria-label={t.name}>
      <img className="clip__video" src={t.backdrop ?? t.poster} alt="" />
      {active && trailer && (
        <iframe
          ref={frame}
          className="clip__video clip__frame"
          src={youtubeEmbedUrl(trailer.key, {
            autoplay: 1,
            mute: 1,
            controls: 0,
            loop: 1,
            playlist: trailer.key,
            enablejsapi: 1,
            origin: window.location.origin,
          })}
          title={`${t.name} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => !muted && command(frame.current, 'unMute')}
        />
      )}
      <div className="clip__shade" />
      <div className="clip__info">
        <h2 className="clip__title">{t.name}</h2>
        {t.tags.length > 0 && <p className="clip__tags">{t.tags.slice(0, 3).join('  •  ')}</p>}
        {t.synopsis && <p className="clip__synopsis">{t.synopsis}</p>}
        {t.rating && <span className="badge">★ {t.rating}</span>}
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
      {active && near && !data && (
        <div className="clip__loading">
          <Spinner />
        </div>
      )}
    </article>
  )
}
