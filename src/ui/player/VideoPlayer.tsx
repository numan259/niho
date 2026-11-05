import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Source } from '../../providers'
import { Icon } from '../Icon'
import { formatClock } from './time'
import { isHlsSource, usesNativePlayer } from './routing'
import { YouTubeStage } from './YouTubeStage'
import { usePlayerFullscreen } from './usePlayerFullscreen'
import { SubtitleOverlay } from './SubtitleOverlay'

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

interface TrackOption {
  id: number
  label: string
  language?: string
}

const HIDE_AFTER_MS = 3000
const REPORT_EVERY_MS = 5000
const UP_NEXT_SEC = 25
const STREAM_LOAD_TIMEOUT_MS = 15000
const AUDIO_LANGUAGE_KEY = 'niho.audioLanguage'
const SUBTITLE_LANGUAGE_KEY = 'niho.subtitleLanguage'

function readTrackPreference(key: string): string | undefined {
  try {
    return sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

function writeTrackPreference(key: string, value: string | undefined) {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // Track preferences are optional when storage is unavailable.
  }
}

/**
 * Single entry point for playback. TMDB trailers (YouTube) play in YouTube's
 * official embedded player; direct HLS / MP4 streams use our own <video> + hls.js.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  return usesNativePlayer(props.sources[0]) ? <StreamPlayer {...props} /> : <YouTubeStage {...props} />
}

function StreamPlayer({ sources, title, subtitle, poster, startAt = 0, onBack, onProgress, onEnded, next, sourcePage }: VideoPlayerProps) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hls = useRef<Hls | null>(null)
  const resumeAt = useRef(startAt)
  const hideTimer = useRef<number | undefined>(undefined)
  const feedbackTimer = useRef<number | undefined>(undefined)
  const lastTap = useRef<{ side: 'left' | 'right'; time: number } | null>(null)
  const sourceTimeout = useRef<number | undefined>(undefined)
  const playbackStarted = useRef(false)
  const preferredAudioLanguage = useRef<string | undefined>(readTrackPreference(AUDIO_LANGUAGE_KEY))
  const preferredSubtitleLanguage = useRef<string | undefined>(readTrackPreference(SUBTITLE_LANGUAGE_KEY))

  const [sourceIndex, setSourceIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const { fullscreen, toggleFullscreen } = usePlayerFullscreen(root, video)
  const [seekFeedback, setSeekFeedback] = useState<'left' | 'right' | null>(null)
  const [controls, setControls] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hlsLevels, setHlsLevels] = useState<QualityOption[]>([])
  const [hlsLevel, setHlsLevel] = useState(-1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([])
  const [audioTrack, setAudioTrack] = useState(-1)
  const [subtitleTracks, setSubtitleTracks] = useState<TrackOption[]>([])
  const [subtitleTrack, setSubtitleTrack] = useState(-1)
  const [trackMenu, setTrackMenu] = useState<'audio' | 'subtitles' | null>(null)
  const [moreSubtitlesOpen, setMoreSubtitlesOpen] = useState(false)
  const controlsVisible = controls || !playing || menuOpen || trackMenu !== null

  // Keep latest callbacks in refs so effects don't re-run when parents re-render.
  const cb = useRef({ onProgress, onEnded })
  useEffect(() => {
    cb.current = { onProgress, onEnded }
  })

  const report = useCallback(() => {
    const v = video.current
    if (v && v.duration && Number.isFinite(v.duration)) cb.current.onProgress(v.currentTime, v.duration)
  }, [])

  const markPlaybackStarted = useCallback(() => {
    playbackStarted.current = true
    window.clearTimeout(sourceTimeout.current)
    sourceTimeout.current = undefined
  }, [])

  const source = sources[sourceIndex]
  const isEnglishTrack = (track: TrackOption) => {
    const value = `${track.language ?? ''} ${track.label}`.toLowerCase()
    return value === 'en' || value.startsWith('en ') || value.includes('english') || value.includes('(en)')
  }
  const isTurkishTrack = (track: TrackOption) => {
    const value = `${track.language ?? ''} ${track.label}`.toLowerCase()
    return value === 'tr' || value.startsWith('tr ') || value.includes('turkish') || value.includes('(tr)')
  }
  const englishSubtitles = subtitleTracks.filter(isEnglishTrack)
  const turkishSubtitles = subtitleTracks.filter(isTurkishTrack)
  const moreSubtitles = subtitleTracks.filter(
    (track) => !englishSubtitles.some((english) => english.id === track.id) && !turkishSubtitles.some((turkish) => turkish.id === track.id),
  )

  const trackLabel = (track: { name?: string; lang?: string; language?: string }, fallback: string) => {
    const language = track.lang ?? track.language
    return track.name || language || fallback
  }

  const toTrackOptions = (tracks: Array<{ name?: string; lang?: string; language?: string }>): TrackOption[] =>
    tracks.map((track, id) => ({
      id,
      label: trackLabel(track, `Track ${id + 1}`),
      language: track.lang ?? track.language,
    }))

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
    let retriedNetwork = false
    let loadTimer: number | undefined
    playbackStarted.current = false
    const startLoadTimeout = () => {
      window.clearTimeout(loadTimer)
      loadTimer = window.setTimeout(() => {
        if (cancelled || playbackStarted.current || !v.paused || v.currentTime > 0) return
        console.warn('[Niho HLS] SOURCE_TIMEOUT', {
          url: source.url,
          action: sourceIndex + 1 < sources.length ? 'trying_next_source' : 'showing_error',
        })
        failOver('The CinePro stream did not start playing within 15 seconds.')
      }, STREAM_LOAD_TIMEOUT_MS)
      sourceTimeout.current = loadTimer
    }
    setError(null)
    setWaiting(true)
    setHlsLevels([])
    setAudioTracks([])
    setAudioTrack(-1)
    setSubtitleTracks([])
    setSubtitleTrack(-1)
    setTrackMenu(null)
    setMoreSubtitlesOpen(false)
    const start = () => v.play().catch(() => setPlaying(false))

    if (isHlsSource(source)) {
      import('hls.js')
        .then(({ default: HlsJs }) => {
          if (cancelled) return
          if (!HlsJs.isSupported()) {
            if (v.canPlayType('application/vnd.apple.mpegurl')) {
              v.src = source.url
              start()
            } else {
              failOver('Adaptive streaming is not supported in this browser.')
            }
            return
          }
          console.info('[Niho HLS] FINAL_STREAM_URL', source.url)
          const h = new HlsJs({ startPosition: resumeAt.current || -1 })
          h.subtitleDisplay = false
          hls.current = h
          const updateAudioTracks = () => {
            const tracks = toTrackOptions(h.audioTracks)
            console.info('[Niho HLS] AUDIO_TRACKS_UPDATED', tracks)
            setAudioTracks(tracks)
            const preferred = preferredAudioLanguage.current
            const selected = preferred
              ? tracks.find((track) => track.language?.toLowerCase() === preferred.toLowerCase())?.id
              : tracks.find((track) => track.language?.toLowerCase().startsWith('en'))?.id
            const nextTrack = selected ?? (tracks.length ? h.audioTrack : -1)
            if (nextTrack >= 0) h.audioTrack = nextTrack
            setAudioTrack(nextTrack)
          }
          const updateSubtitleTracks = () => {
            const tracks = toTrackOptions(h.subtitleTracks)
            console.info('[Niho HLS] SUBTITLE_TRACKS_UPDATED', tracks)
            setSubtitleTracks(tracks)
            const preferred = preferredSubtitleLanguage.current
            const selected = preferred
              ? tracks.find((track) => track.language?.toLowerCase() === preferred.toLowerCase())?.id
              : undefined
            const nextTrack = selected ?? -1
            h.subtitleTrack = nextTrack
            setSubtitleTrack(nextTrack)
          }
          h.on(HlsJs.Events.AUDIO_TRACKS_UPDATED, updateAudioTracks)
          h.on(HlsJs.Events.SUBTITLE_TRACKS_UPDATED, updateSubtitleTracks)
          h.on(HlsJs.Events.MANIFEST_LOADING, (_e, data) => {
            console.info('[Niho HLS] MANIFEST_LOADING', {
              url: data.url,
            })
          })
          h.on(HlsJs.Events.MANIFEST_PARSED, (_e, data) => {
            console.info('[Niho HLS] MANIFEST_PARSED', {
              url: source.url,
              levels: data.levels.length,
              codecs: data.levels.map((level) => level.codecSet),
            })
            const levels = data.levels
              .map((l, i) => ({ label: `${l.height}p`, value: i, height: l.height }))
              .sort((a, b) => b.height - a.height)
              .map(({ label, value }) => ({ label, value }))
            setHlsLevels([{ label: 'Auto', value: -1 }, ...levels])
            updateAudioTracks()
            updateSubtitleTracks()
            markPlaybackStarted()
            start()
          })
          h.on(HlsJs.Events.LEVEL_LOADED, (_e, data) => {
            console.info('[Niho HLS] LEVEL_LOADED', {
              url: data.details.url,
              fragments: data.details.fragments.length,
            })
          })
          h.on(HlsJs.Events.FRAG_LOADING, (_e, data) => {
            console.info('[Niho HLS] FRAG_LOADING', {
              url: data.frag.url,
              start: data.frag.start,
              duration: data.frag.duration,
            })
          })
          h.on(HlsJs.Events.FRAG_LOADED, (_e, data) => {
            console.info('[Niho HLS] FRAG_LOADED', {
              url: data.frag.url,
              start: data.frag.start,
              duration: data.frag.duration,
            })
            markPlaybackStarted()
          })
          h.on(HlsJs.Events.FRAG_BUFFERED, () => {
            markPlaybackStarted()
          })
          h.on(HlsJs.Events.ERROR, (_e, data) => {
            console.error('[Niho HLS] ERROR', {
              type: data.type,
              details: data.details,
              isFragLoadError: data.details === 'fragLoadError',
              isBufferStalledError: data.details === 'bufferStalledError',
              isMediaError: data.type === HlsJs.ErrorTypes.MEDIA_ERROR,
              fatal: data.fatal,
              url: data.url,
              responseCode: data.response?.code,
              reason: data.reason,
            })
            if (!data.fatal || playbackStarted.current || !v.paused || v.currentTime > 0) return
            window.clearTimeout(loadTimer)
            if (data.type === HlsJs.ErrorTypes.NETWORK_ERROR && !retriedNetwork && !cancelled) {
              retriedNetwork = true
              h.startLoad()
              return
            }
            if (data.details === 'manifestIncompatibleCodecsError') {
              failOver('This browser does not support the CinePro stream codecs (H.264/AAC).')
              return
            }
            const detail = data.details ? ` (${data.details})` : ''
            failOver(`This stream is unavailable right now${detail}.`)
          })
          h.loadSource(source.url)
          h.attachMedia(v)
          startLoadTimeout()
        })
        .catch(() => {
          if (!cancelled) {
            startLoadTimeout()
            failOver('Could not load the streaming player.')
          }
        })
    } else {
      v.src = source.url
      startLoadTimeout()
      start()
    }

    return () => {
      cancelled = true
      window.clearTimeout(loadTimer)
      window.clearTimeout(sourceTimeout.current)
      sourceTimeout.current = undefined
      // Report before tearing down: resetting the element clears currentTime/duration.
      report()
      hls.current?.destroy()
      hls.current = null
      setAudioTracks([])
      setSubtitleTracks([])
      v.removeAttribute('src')
      v.load()
    }
  }, [source, sourceIndex, sources.length, failOver, markPlaybackStarted, report])

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
  useEffect(() => () => {
    window.clearTimeout(hideTimer.current)
    window.clearTimeout(feedbackTimer.current)
  }, [])

  const seekBy = useCallback(
    (sec: number) => {
      const v = video.current
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + sec))
      setTime(v.currentTime)
      showControls()
    },
    [showControls],
  )

  function onSurfaceClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button, input, a, [role="menu"]')) {
      lastTap.current = null
      showControls()
      return
    }
    showControls()
    root.current?.focus({ preventScroll: true })
    const bounds = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - bounds.left) / bounds.width
    const side = fraction < 0.4 ? 'left' : fraction > 0.6 ? 'right' : null
    if (!side || error || menuOpen || trackMenu) {
      lastTap.current = null
      return
    }
    const now = performance.now()
    if (lastTap.current?.side === side && now - lastTap.current.time < 350) {
      lastTap.current = null
      const v = video.current
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return
      seekBy(side === 'left' ? -10 : 10)
      setSeekFeedback(side)
      window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setSeekFeedback(null), 700)
    } else {
      lastTap.current = { side, time: now }
    }
  }

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

  function chooseAudioTrack(track: TrackOption) {
    if (!hls.current) return
    hls.current.audioTrack = track.id
    preferredAudioLanguage.current = track.language
    writeTrackPreference(AUDIO_LANGUAGE_KEY, track.language)
    setAudioTrack(track.id)
    setTrackMenu(null)
  }

  function chooseSubtitleTrack(track: TrackOption | null) {
    if (!hls.current) return
    const id = track?.id ?? -1
    hls.current.subtitleTrack = id
    preferredSubtitleLanguage.current = track?.language
    writeTrackPreference(SUBTITLE_LANGUAGE_KEY, track?.language)
    setSubtitleTrack(id)
    setTrackMenu(null)
    setMoreSubtitlesOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest('button, input, a')) return
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
      className={`player player--stream ${controlsVisible ? 'player--controls' : ''}`}
      onPointerMove={(e) => { if (e.pointerType === 'mouse') showControls() }}
      onClick={onSurfaceClick}
      onFocus={showControls}
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
        onPlaying={() => {
          markPlaybackStarted()
          setWaiting(false)
        }}
        onCanPlay={() => {
          markPlaybackStarted()
          setWaiting(false)
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          setDuration(v.duration)
          if (!hls.current && resumeAt.current > 0 && resumeAt.current < v.duration - 5) v.currentTime = resumeAt.current
        }}
        onTimeUpdate={(e) => {
          markPlaybackStarted()
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

      <SubtitleOverlay video={video} controlsVisible={controlsVisible} hidden={Boolean(error)} />

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

      {seekFeedback && (
        <div className={`player__seek-feedback player__seek-feedback--${seekFeedback}`} role="status">
          <Icon name={seekFeedback === 'left' ? 'rewind' : 'forward'} size={32} />
          <span>{seekFeedback === 'left' ? '−10' : '+10'} seconds</span>
        </div>
      )}

      <div className="player__top" inert={!controlsVisible}>
        <button className="icon-btn icon-btn--lg" onClick={onBack} aria-label="Back">
          <Icon name="back" size={28} />
        </button>
        <div className="player__heading">
          <span className="player__title">{title}</span>
          {subtitle && <span className="player__subtitle">{subtitle}</span>}
        </div>
      </div>

      <div className="player__center" inert={!controlsVisible || Boolean(error)}>
        <button className="player__big-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={40} />
        </button>
      </div>

      {showUpNext && (
        <button className="btn btn--primary player__up-next" onClick={next.onSelect}>
          <Icon name="next" size={20} /> {next.label}
        </button>
      )}

      <div className="player__bottom" inert={!controlsVisible}>
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
          {audioTracks.length > 1 && (
            <div className="player__menu-wrap">
                  <button
                    className="icon-btn player__labelled"
                    onClick={() => setTrackMenu((current) => (current === 'audio' ? null : 'audio'))}
                    aria-haspopup="menu"
                    aria-expanded={trackMenu === 'audio'}
                    aria-label="Audio"
                  >
                    <Icon name="audio" /> <span>Audio</span>
                  </button>
                  {trackMenu === 'audio' && (
                    <ul className="player__menu" role="menu" aria-label="Audio tracks">
                      {audioTracks.map((track) => (
                        <li key={track.id}>
                          <button role="menuitemradio" aria-checked={track.id === audioTrack} onClick={() => chooseAudioTrack(track)}>
                            {track.id === audioTrack && <Icon name="check" size={16} />} {track.label}
                            {track.language && ` (${track.language})`}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
            </div>
          )}
          {subtitleTracks.length > 0 && (
                <div className="player__menu-wrap">
                  <button
                    className="icon-btn player__labelled"
                    onClick={() => setTrackMenu((current) => (current === 'subtitles' ? null : 'subtitles'))}
                    aria-haspopup="menu"
                    aria-expanded={trackMenu === 'subtitles'}
                    aria-label="Subtitles"
                  >
                    <Icon name="captions" /> <span>CC</span>
                  </button>
                  {trackMenu === 'subtitles' && (
                    <ul className="player__menu" role="menu" aria-label="Subtitle tracks">
                      <li>
                        <button role="menuitemradio" aria-checked={subtitleTrack === -1} onClick={() => chooseSubtitleTrack(null)}>
                          {subtitleTrack === -1 && <Icon name="check" size={16} />} Off
                        </button>
                      </li>
                      {englishSubtitles.map((track) => (
                        <li key={track.id}>
                          <button role="menuitemradio" aria-checked={track.id === subtitleTrack} onClick={() => chooseSubtitleTrack(track)}>
                            {track.id === subtitleTrack && <Icon name="check" size={16} />} {track.label}
                            {track.language && ` (${track.language})`}
                          </button>
                        </li>
                      ))}
                      {turkishSubtitles.map((track) => (
                        <li key={track.id}>
                          <button role="menuitemradio" aria-checked={track.id === subtitleTrack} onClick={() => chooseSubtitleTrack(track)}>
                            {track.id === subtitleTrack && <Icon name="check" size={16} />} {track.label}
                            {track.language && ` (${track.language})`}
                          </button>
                        </li>
                      ))}
                      {moreSubtitles.length > 0 && (
                        <li>
                          <button
                            role="menuitem"
                            aria-expanded={moreSubtitlesOpen}
                            onClick={() => setMoreSubtitlesOpen((open) => !open)}
                          >
                            {moreSubtitlesOpen ? 'Less' : 'More'}
                          </button>
                          {moreSubtitlesOpen && (
                            <ul className="player__menu player__menu--nested" role="group" aria-label="More subtitle tracks">
                              {moreSubtitles.map((track) => (
                                <li key={track.id}>
                                  <button role="menuitemradio" aria-checked={track.id === subtitleTrack} onClick={() => chooseSubtitleTrack(track)}>
                                    {track.id === subtitleTrack && <Icon name="check" size={16} />} {track.label}
                                    {track.language && ` (${track.language})`}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )}
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
