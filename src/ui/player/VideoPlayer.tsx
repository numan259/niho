import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Source } from '../../providers'
import { Icon } from '../Icon'
import { formatClock } from './time'
import { isHlsSource, usesNativePlayer } from './routing'
import { YouTubeStage } from './YouTubeStage'

export interface VideoPlayerProps {
  sources: Source[]
  title: string
  subtitle?: string
  poster?: string
  /** seconds to resume from */
  startAt?: number
  onBack: () => void
  /** called every few seconds while playing, on pause and on exit */
  onProgress: (position: number, duration: number) => void
  onEnded: () => void
  next?: { label: string; onSelect: () => void }
  sourcePage?: string
}

interface QualityOption {
  label: string
  /** hls level index (-1 = auto) or source index for mp4 */
  value: number
}

const HIDE_AFTER_MS = 3000
const REPORT_EVERY_MS = 5000
const UP_NEXT_SEC = 25

/**
 * Single entry point for playback. TMDB trailers (YouTube) play in YouTube's
 * official embedded player; direct HLS / MP4 streams use our own <video> + hls.js.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  // Local media-server URLs (http://localhost…) always use the native player so playback is tracked natively.
  return usesNativePlayer(props.sources[0]) ? <StreamPlayer {...props} /> : <YouTubeStage {...props} />
}

function StreamPlayer({ sources, title, subtitle, poster, startAt = 0, onBack, onProgress, onEnded, next, sourcePage }: VideoPlayerProps) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hls = useRef<Hls | null>(null)
  const resumeAt = useRef(startAt)
  const hideTimer = useRef<number | undefined>(undefined)

  const [sourceIndex, setSourceIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controls, setControls] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hlsLevels, setHlsLevels] = useState<QualityOption[]>([])
  const [hlsLevel, setHlsLevel] = useState(-1)
  const [menuOpen, setMenuOpen] = useState(false)

  // Keep latest callbacks in refs so effects don't re-run when parents re-render.
  const cb = useRef({ onProgress, onEnded })
  useEffect(() => {
    cb.current = { onProgress, onEnded }
  })

  const report = useCallback(() => {
    const v = video.current
    if (v && v.duration && Number.isFinite(v.duration)) cb.current.onProgress(v.currentTime, v.duration)
  }, [])

  const source = sources[sourceIndex]

  const failOver = useCallback(
    (reason: string) => {
      if (video.current) resumeAt.current = video.current.currentTime || resumeAt.current
      if (sourceIndex + 1 < sources.length) setSourceIndex(sourceIndex + 1)
      else setError(reason)
    },
    [sourceIndex, sources.length],
  )

  // Attach the current source (HLS via hls.js where needed, MP4 natively).
  useEffect(() => {
    const v = video.current
    if (!v || !source) return
    let cancelled = false
    setError(null)
    setWaiting(true)
    setHlsLevels([])
    const start = () => v.play().catch(() => setPlaying(false))

    // Safari plays HLS natively; elsewhere hls.js is loaded on demand so MP4-only sessions never download it.
    if (isHlsSource(source) && !v.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then(({ default: HlsJs }) => {
          if (cancelled) return
          if (!HlsJs.isSupported()) return failOver('Adaptive streaming is not supported in this browser.')
          const h = new HlsJs({ startPosition: resumeAt.current || -1 })
          hls.current = h
          h.on(HlsJs.Events.MANIFEST_PARSED, (_e, data) => {
            const levels = data.levels
              .map((l, i) => ({ label: `${l.height}p`, value: i, height: l.height }))
              .sort((a, b) => b.height - a.height)
              .map(({ label, value }) => ({ label, value }))
            setHlsLevels([{ label: 'Auto', value: -1 }, ...levels])
          })
          h.on(HlsJs.Events.ERROR, (_e, data) => {
            if (data.fatal) failOver('This stream is unavailable right now.')
          })
          h.loadSource(source.url)
          h.attachMedia(v)
          start()
        })
        .catch(() => {
          if (!cancelled) failOver('Could not load the streaming player.')
        })
    } else {
      v.src = source.url
      start()
    }

    return () => {
      cancelled = true
      // Report before tearing down: resetting the element clears currentTime/duration.
      report()
      hls.current?.destroy()
      hls.current = null
      v.removeAttribute('src')
      v.load()
    }
  }, [source, failOver, report])

  // Report progress periodically while playing.
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(report, REPORT_EVERY_MS)
    return () => window.clearInterval(id)
  }, [playing, report])

  const showControls = useCallback(() => {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (!video.current?.paused) setControls(false)
    }, HIDE_AFTER_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const seekBy = useCallback(
    (sec: number) => {
      const v = video.current
      if (!v) return
      v.currentTime = Math.max(0, Math.min((v.duration || 0) - 1, v.currentTime + sec))
      showControls()
    },
    [showControls],
  )

  // Fullscreen state + media session (lock screen / headset controls).
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: subtitle ?? 'Niho', artwork: poster ? [{ src: poster }] : [] })
    navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10))
    navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10))
    return () => {
      navigator.mediaSession.metadata = null
    }
  }, [title, subtitle, poster, seekBy])

  function togglePlay() {
    const v = video.current
    if (!v) return
    if (v.paused) v.play().catch(() => undefined)
    else v.pause()
    showControls()
  }

  function toggleMute() {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  async function toggleFullscreen() {
    const el = root.current
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!el) return
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
    else if (el.requestFullscreen) await el.requestFullscreen().catch(() => undefined)
    else v?.webkitEnterFullscreen?.()
  }

  function chooseQuality(option: QualityOption) {
    setMenuOpen(false)
    if (hlsLevels.length && hls.current) {
      hls.current.currentLevel = option.value
      setHlsLevel(option.value)
    } else if (option.value !== sourceIndex) {
      resumeAt.current = video.current?.currentTime ?? 0
      setSourceIndex(option.value)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    const handled: Record<string, () => void> = {
      ' ': togglePlay,
      k: togglePlay,
      ArrowLeft: () => seekBy(-10),
      ArrowRight: () => seekBy(10),
      j: () => seekBy(-10),
      l: () => seekBy(10),
      f: toggleFullscreen,
      m: toggleMute,
    }
    const fn = handled[e.key]
    const onSlider = e.target instanceof HTMLInputElement && e.key.startsWith('Arrow')
    if (fn && !onSlider) {
      e.preventDefault()
      fn()
    }
  }

  const qualityOptions: QualityOption[] = hlsLevels.length
    ? hlsLevels
    : sources.map((s, i) => ({ label: s.quality ?? (s.type === 'hls' ? 'Auto' : `Source ${i + 1}`), value: i }))
  const activeQuality = hlsLevels.length ? hlsLevel : sourceIndex
  const showUpNext = next && duration > 0 && duration - time < UP_NEXT_SEC

  return (
    <div
      ref={root}
      className={`player ${controls || !playing ? 'player--controls' : ''}`}
      onMouseMove={showControls}
      onTouchStart={showControls}
      onKeyDown={onKey}
      tabIndex={-1}
      role="region"
      aria-label={`Video player: ${title}`}
    >
      <video
        ref={video}
        className="player__video"
        poster={poster}
        playsInline
        preload="auto"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true)
          showControls()
        }}
        onPause={() => {
          setPlaying(false)
          setControls(true)
          report()
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          setDuration(v.duration)
          if (!hls.current && resumeAt.current > 0 && resumeAt.current < v.duration - 5) v.currentTime = resumeAt.current
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          setTime(v.currentTime)
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          report()
          cb.current.onEnded()
        }}
        onError={() => {
          if (!hls.current) failOver("This video file can't be played in your browser.")
        }}
      />

      {waiting && !error && <div className="player__spinner spinner" aria-hidden="true" />}

      {error && (
        <div className="player__error" role="alert">
          <p>{error}</p>
          {sourcePage && (
            <a className="btn btn--secondary" href={sourcePage} target="_blank" rel="noreferrer">
              Open on source site <Icon name="external" size={18} />
            </a>
          )}
        </div>
      )}

      <div className="player__top">
        <button className="icon-btn icon-btn--lg" onClick={onBack} aria-label="Back">
          <Icon name="back" size={28} />
        </button>
        <div className="player__heading">
          <span className="player__title">{title}</span>
          {subtitle && <span className="player__subtitle">{subtitle}</span>}
        </div>
      </div>

      <div className="player__center">
        <button className="icon-btn icon-btn--lg" onClick={() => seekBy(-10)} aria-label="Back 10 seconds">
          <Icon name="rewind" size={32} />
        </button>
        <button className="player__big-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={40} />
        </button>
        <button className="icon-btn icon-btn--lg" onClick={() => seekBy(10)} aria-label="Forward 10 seconds">
          <Icon name="forward" size={32} />
        </button>
      </div>

      {showUpNext && (
        <button className="btn btn--primary player__up-next" onClick={next.onSelect}>
          <Icon name="next" size={20} /> {next.label}
        </button>
      )}

      <div className="player__bottom">
        <div className="player__scrub">
          <span className="player__time">{formatClock(time)}</span>
          <div className="player__bar">
            <div className="player__buffered" style={{ width: duration ? `${(buffered / duration) * 100}%` : 0 }} />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={Math.min(time, duration || 0)}
              onChange={(e) => {
                if (video.current) video.current.currentTime = Number(e.target.value)
                setTime(Number(e.target.value))
              }}
              aria-label="Seek"
              aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}`}
              style={{ '--pct': duration ? `${(time / duration) * 100}%` : '0%' } as React.CSSProperties}
            />
          </div>
          <span className="player__time">-{formatClock(Math.max(0, duration - time))}</span>
        </div>
        <div className="player__buttons">
          <button className="icon-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            <Icon name={muted ? 'mute' : 'volume'} />
          </button>
          <span className="player__spacer" />
          {next && (
            <button className="icon-btn player__labelled" onClick={next.onSelect} aria-label={next.label}>
              <Icon name="next" /> <span>Next</span>
            </button>
          )}
          {qualityOptions.length > 1 && (
            <div className="player__menu-wrap">
              <button
                className="icon-btn player__labelled"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Quality"
              >
                <Icon name="settings" /> <span>{qualityOptions.find((q) => q.value === activeQuality)?.label}</span>
              </button>
              {menuOpen && (
                <ul className="player__menu" role="menu">
                  {qualityOptions.map((q) => (
                    <li key={q.value}>
                      <button role="menuitemradio" aria-checked={q.value === activeQuality} onClick={() => chooseQuality(q)}>
                        {q.value === activeQuality && <Icon name="check" size={16} />} {q.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button className="icon-btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
            <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} />
          </button>
        </div>
      </div>
    </div>
  )
}
