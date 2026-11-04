import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import type { VideoPlayerProps } from './VideoPlayer'
import { loadYouTubeApi, YOUTUBE_HOST, youtubeErrorMessage, youtubeWatchUrl, type YTPlayer } from './youtube'

const REPORT_EVERY_MS = 5000

/**
 * Player stage for TMDB trailers. Keeps Niho's chrome (back, title, next, video
 * switcher) around YouTube's official embedded player and reports progress so
 * Continue Watching works exactly like it does for direct streams.
 */
export function YouTubeStage({ sources, title, subtitle, startAt = 0, onBack, onProgress, onEnded, next }: VideoPlayerProps) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  // Resume point belongs to the first video only; other trailers start from 0.
  const resume = useRef({ videoId: sources[0]?.url, at: startAt })
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const cb = useRef({ onProgress, onEnded })
  useEffect(() => {
    cb.current = { onProgress, onEnded }
  })

  const report = useCallback(() => {
    const p = player.current
    if (!p || typeof p.getDuration !== 'function') return
    const duration = p.getDuration()
    if (duration > 0) cb.current.onProgress(p.getCurrentTime(), duration)
  }, [])

  const videoId = sources[index]?.url

  useEffect(() => {
    const container = host.current
    if (!videoId || !container) return
    let cancelled = false
    let timer: number | undefined
    setError(null)
    // The API replaces its target element, so give it a fresh one each time.
    const target = document.createElement('div')
    container.replaceChildren(target)

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        player.current = new YT.Player(target, {
          host: YOUTUBE_HOST,
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            start: resume.current.videoId === videoId ? Math.floor(resume.current.at) : 0,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => e.target.playVideo(),
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PAUSED) report()
              if (e.data === YT.PlayerState.ENDED) {
                report()
                cb.current.onEnded()
              }
            },
            onError: (e) => {
              // Some trailers block embedding; quietly try the next one first.
              if (index + 1 < sources.length) setIndex(index + 1)
              else setError(youtubeErrorMessage(e.data))
            },
          },
        })
        timer = window.setInterval(report, REPORT_EVERY_MS)
      })
      .catch(() => {
        if (!cancelled) setError('The YouTube player could not be loaded. Check your connection.')
      })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      report()
      player.current?.destroy()
      player.current = null
    }
  }, [videoId, index, sources.length, report])

  return (
    <div className="player player--controls player--youtube" role="region" aria-label={`Trailer player: ${title}`}>
      <div className="player__top player__top--static">
        <button className="icon-btn icon-btn--lg" onClick={onBack} aria-label="Back">
          <Icon name="back" size={28} />
        </button>
        <div className="player__heading">
          <span className="player__title">{title}</span>
          <span className="player__subtitle">{[subtitle, sources[index]?.quality].filter(Boolean).join(' · ')}</span>
        </div>
        <span className="player__spacer" />
        {next && (
          <button className="icon-btn player__labelled" onClick={next.onSelect} aria-label={next.label}>
            <Icon name="next" /> <span>Next</span>
          </button>
        )}
        {sources.length > 1 && (
          <div className="player__menu-wrap">
            <button
              className="icon-btn player__labelled"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Choose video"
            >
              <Icon name="clips" /> <span>Videos</span>
            </button>
            {menuOpen && (
              <ul className="player__menu player__menu--down" role="menu">
                {sources.map((s, i) => (
                  <li key={s.url}>
                    <button
                      role="menuitemradio"
                      aria-checked={i === index}
                      onClick={() => {
                        setMenuOpen(false)
                        setIndex(i)
                      }}
                    >
                      {i === index && <Icon name="check" size={16} />} {s.quality ?? `Video ${i + 1}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="player__frame" ref={host} />

      {error && (
        <div className="player__error" role="alert">
          <p>{error}</p>
          {videoId && (
            <a className="btn btn--secondary" href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">
              Watch on YouTube <Icon name="external" size={18} />
            </a>
          )}
          <button className="btn btn--ghost" onClick={onBack}>
            Go back
          </button>
        </div>
      )}
    </div>
  )
}
