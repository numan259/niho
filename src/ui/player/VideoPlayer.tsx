import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { languageName, rankSources } from '../../providers/languages'
import type { Source } from '../../providers'
import { Icon } from '../Icon'
import { formatClock } from './time'
import { isHlsSource, usesNativePlayer } from './routing'
import { YouTubeStage } from './YouTubeStage'
import { usePlayerFullscreen } from './usePlayerFullscreen'
import { SubtitleOverlay } from './SubtitleOverlay'
import { externalTextTracks, useExternalSubtitles } from './useExternalSubtitles'
import { languageMatches, usePlaybackPreferences } from '../../state/playback'
import { useWatchProgress } from './useWatchProgress'
import { useHoldSpeed } from './useHoldSpeed'
import { PlayerPanel } from './PlayerPanel'
import { LanguageChoices, ServerChoices } from './PlayerChoices'
import { EpisodePicker, type EpisodePickerProps } from './EpisodePicker'
import { OFFLINE_BASE } from '../../offline/storage'
import { OfflineLoader } from '../../offline/loader'

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
  episodes?: EpisodePickerProps
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
const UP_NEXT_SEC = 25
const STREAM_LOAD_TIMEOUT_MS = 15000

/**
 * Single entry point for playback. TMDB trailers (YouTube) play in YouTube's
 * official embedded player; direct HLS / MP4 streams use our own <video> + hls.js.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  return usesNativePlayer(props.sources[0]) ? <StreamPlayer {...props} /> : <YouTubeStage {...props} />
}

function StreamPlayer({ sources, title, subtitle, poster, startAt = 0, onBack, onProgress, onEnded, next, episodes, sourcePage }: VideoPlayerProps) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hls = useRef<Hls | null>(null)
  const resumeAt = useRef(startAt)
  const hideTimer = useRef<number | undefined>(undefined)
  const feedbackTimer = useRef<number | undefined>(undefined)
  const lastTap = useRef<{ side: 'left' | 'center' | 'right'; time: number } | null>(null)
  const lastPlayButtonTap = useRef<number | null>(null)
  const sourceTimeout = useRef<number | undefined>(undefined)
  const playbackStarted = useRef(false)
  const preferences = usePlaybackPreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [episodesOpen, setEpisodesOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [unlockArmed, setUnlockArmed] = useState(false)
  const [lockHint, setLockHint] = useState(false)
  const lockTimer = useRef<number | undefined>(undefined)
  const [reload, setReload] = useState(0)
  const [recovering, setRecovering] = useState(false)
  const [ended, setEnded] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const [autoplayCancelled, setAutoplayCancelled] = useState(false)
  const hasNext = Boolean(next)

  const failedSources = useRef(new Set<string>())
  const [selectedSourceUrl, setSelectedSourceUrl] = useState(() => rankSources(sources, preferences)[0]?.url)
  const sourceIndex = sources.findIndex(item => item.url === selectedSourceUrl)
  const setSourceIndex = (index: number) => setSelectedSourceUrl(sources[index]?.url)
  // Keep the active source stable; preference changes affect menus and subsequent fallback.
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
  const controlsVisible = !locked && (controls || menuOpen || trackMenu !== null || settingsOpen || episodesOpen)
  const hold = useHoldSpeed(video, locked || Boolean(error) || settingsOpen || episodesOpen || menuOpen || trackMenu !== null)

  // Keep latest callbacks in refs so effects don't re-run when parents re-render.
  const cb = useRef({ onProgress, onEnded, next })
  useEffect(() => {
    cb.current = { onProgress, onEnded, next }
  })

  const report = useWatchProgress(video, startAt, onProgress)

  const markPlaybackStarted = useCallback(() => {
    playbackStarted.current = true
    window.clearTimeout(sourceTimeout.current)
    sourceTimeout.current = undefined
    setRecovering(false)
  }, [])

  const source = sources[sourceIndex]
  const [externalSelection, setExternalSelection] = useState<{ source: string; url: string } | null>(null)
  const externalSelected = source?.url === externalSelection?.source ? source?.subtitles?.find(track => track.url === externalSelection?.url) : undefined
  const manualSubtitlePreference = useRef<{source: string; language: string} | null>(null)
  const externalActive = useRef(false)
  useEffect(() => { externalActive.current = Boolean(externalSelected) }, [externalSelected])
  const externalError = useExternalSubtitles(video, externalSelected, source?.url)
  const externalOptions = source?.subtitles?.map((track, index) => ({ id: 10000 + index, label: track.label, language: track.language })) ?? []
  const visibleSubtitleTracks = [...subtitleTracks, ...externalOptions]
  const visibleSubtitleTrack = externalSelected ? 10000 + (source?.subtitles?.indexOf(externalSelected) ?? 0) : subtitleTrack
  useEffect(() => {
    if (manualSubtitlePreference.current?.source === source?.url && manualSubtitlePreference.current?.language === preferences.subtitleLanguage) return
    const track = source?.subtitles?.find(track => languageMatches(track.language, preferences.subtitleLanguage))
    setExternalSelection(track && source ? { source: source.url, url: track.url } : null)
  }, [source, preferences.subtitleLanguage])
  useEffect(() => {
    if (!externalSelected) return
    if (hls.current) hls.current.subtitleTrack = -1
    for (const track of Array.from(video.current?.textTracks ?? [])) {
      if (!externalTextTracks.has(track) && (track.kind === 'subtitles' || track.kind === 'captions')) track.mode = 'disabled'
    }
    // oxlint-disable-next-line react/set-state-in-effect -- reflect the embedded track disabled on the media engine above.
    setSubtitleTrack(-1)
  }, [externalSelected])
  const trackLabel = (track: { name?: string; lang?: string; language?: string }, fallback: string) => {
    const language = track.lang ?? track.language
    return track.name || (language ? languageName(language) : fallback)
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
      if (source) failedSources.current.add(source.url)
      const candidate = rankSources(sources, usePlaybackPreferences.getState()).find(item => !failedSources.current.has(item.url))
      if (candidate) setSelectedSourceUrl(candidate.url)
      else {
        window.clearTimeout(sourceTimeout.current)
        hls.current?.stopLoad()
        video.current?.pause()
        setError(reason)
        setWaiting(false)
        setRecovering(false)
        setLocked(false)
        setControls(true)
      }
    },
    [source, sources],
  )

  const retryStream = useCallback(() => {
    report()
    if (video.current?.currentTime) resumeAt.current = video.current.currentTime
    if (source) failedSources.current.delete(source.url)
    setError(null)
    setEnded(false)
    setRecovering(true)
    setReload((value) => value + 1)
  }, [report, source])

  useEffect(() => {
    const h = hls.current
    if (!h) return
    const preferredAudio = h.audioTracks.findIndex((track) => languageMatches(track.lang, preferences.audioLanguage))
    const audio = preferredAudio >= 0 ? preferredAudio : Math.max(0, h.audioTracks.findIndex((track) => track.default))
    if (audio >= 0) { h.audioTrack = audio; setAudioTrack(audio) }
    const subtitles = externalActive.current ? -1 : h.subtitleTracks.findIndex((track) => languageMatches(track.lang, preferences.subtitleLanguage))
    h.subtitleTrack = subtitles
    setSubtitleTrack(subtitles)
  }, [preferences.audioLanguage, preferences.subtitleLanguage])

  useEffect(() => {
    const media = video.current
    if (!media) return
    const sync = () => {
      if (hls.current) return
      const tracks = Array.from(media.textTracks).map((track, id) => ({ track, id }))
        .filter(({ track }) => !externalTextTracks.has(track) && (track.kind === 'subtitles' || track.kind === 'captions'))
      const selected = externalActive.current ? -1 : tracks.find(({ track }) => languageMatches(track.language, usePlaybackPreferences.getState().subtitleLanguage))?.id ?? -1
      tracks.forEach(({ track, id }) => {
        const mode = id === selected ? 'hidden' : 'disabled'
        if (track.mode !== mode) track.mode = mode
      })
      setSubtitleTracks(tracks.map(({ track, id }) => ({ id, label: track.label || track.language || `Track ${id + 1}`, language: track.language })))
      setSubtitleTrack(selected)
    }
    media.textTracks.addEventListener('addtrack', sync)
    media.textTracks.addEventListener('removetrack', sync)
    media.addEventListener('loadedmetadata', sync)
    sync()
    return () => {
      media.textTracks.removeEventListener('addtrack', sync)
      media.textTracks.removeEventListener('removetrack', sync)
      media.removeEventListener('loadedmetadata', sync)
    }
  }, [preferences.subtitleLanguage])

  useEffect(() => {
    if (!ended || !hasNext || !preferences.autoplay || autoplayCancelled || locked || settingsOpen || episodesOpen) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setCountdown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [ended, hasNext, preferences.autoplay, autoplayCancelled, locked, settingsOpen, episodesOpen])

  useEffect(() => {
    if (ended && countdown === 0 && preferences.autoplay && !autoplayCancelled && !locked && !settingsOpen && !episodesOpen) {
      // oxlint-disable-next-line react/set-state-in-effect -- consume the completed countdown once before navigating.
      setEnded(false)
      report()
      cb.current.next?.onSelect()
    }
  }, [ended, countdown, preferences.autoplay, autoplayCancelled, locked, settingsOpen, episodesOpen, report])

  // Bound recovery attempts so a broken stream always reaches a useful Retry state.
  useEffect(() => {
    const media = video.current
    if (!media || !source) return
    let cancelled = false
    let stream: Hls | null = null
    let networkRetries = 0
    let mediaRetries = 0
    let stallRetries = 0
    let lastPosition = media.currentTime
    let lastAdvance = Date.now()
    playbackStarted.current = false
    const armTimeout = () => {
      window.clearTimeout(sourceTimeout.current)
      sourceTimeout.current = window.setTimeout(() => {
        if (!cancelled) failOver('The stream is taking too long to respond. Check your connection and try again.')
      }, STREAM_LOAD_TIMEOUT_MS)
    }
    const start = () => media.play().catch(() => {
      // Autoplay denial is not a stream failure; let the user press Play.
      if (cancelled) return
      window.clearTimeout(sourceTimeout.current)
      setPlaying(false)
      setWaiting(false)
      setControls(true)
    })
    setError(null)
    setWaiting(true)
    setHlsLevels([])
    setAudioTracks([])
    setAudioTrack(-1)
    setSubtitleTracks([])
    setSubtitleTrack(-1)
    setTrackMenu(null)
    armTimeout()

    if (isHlsSource(source)) {
      import('hls.js').then(({ default: HlsJs }) => {
        if (cancelled) return
        if (!HlsJs.isSupported()) {
          if (source.url.startsWith(OFFLINE_BASE)) {
            failOver('Offline playback is not supported in this browser. Use the Android app or a browser with Media Source support.')
            return
          }
          if (media.canPlayType('application/vnd.apple.mpegurl')) {
            media.src = source.url
            start()
          } else failOver('Adaptive streaming is not supported in this browser.')
          return
        }
        const h = new HlsJs({ startPosition: resumeAt.current || -1, ...(source.url.startsWith(OFFLINE_BASE) ? { loader: OfflineLoader } : {}) })
        stream = h
        hls.current = h
        h.subtitleDisplay = false
        const updateAudio = () => {
          const tracks = toTrackOptions(h.audioTracks)
          setAudioTracks(tracks)
          const preference = usePlaybackPreferences.getState().audioLanguage
          const preferred = tracks.find((track) => languageMatches(track.language, preference))?.id
          const selected = preferred ?? Math.max(0, h.audioTracks.findIndex((track) => track.default))
          if (selected >= 0) h.audioTrack = selected
          setAudioTrack(selected)
        }
        const updateSubtitles = () => {
          const tracks = toTrackOptions(h.subtitleTracks)
          setSubtitleTracks(tracks)
          const preference = usePlaybackPreferences.getState().subtitleLanguage
          const selected = externalActive.current ? -1 : tracks.find((track) => languageMatches(track.language, preference))?.id ?? -1
          h.subtitleTrack = selected
          setSubtitleTrack(selected)
        }
        // hls.js selects its default after these events return. Apply preferences
        // after that selection so it cannot silently disable a saved language.
        h.on(HlsJs.Events.AUDIO_TRACKS_UPDATED, () => queueMicrotask(() => { if (!cancelled) updateAudio() }))
        h.on(HlsJs.Events.SUBTITLE_TRACKS_UPDATED, () => queueMicrotask(() => { if (!cancelled) updateSubtitles() }))
        h.on(HlsJs.Events.MANIFEST_PARSED, (_event, data) => {
          setHlsLevels([{ label: 'Auto', value: -1 }, ...data.levels
            .map((level, value) => ({ label: `${level.height}p`, value, height: level.height }))
            .sort((a, b) => b.height - a.height)])
          updateAudio()
          updateSubtitles()
          start()
        })
        h.on(HlsJs.Events.ERROR, (_event, data) => {
          if (!data.fatal || cancelled) return
          if (source.url.startsWith(OFFLINE_BASE)) {
            failOver('This download could not be played. Delete it from Downloads and download it again.')
            return
          }
          if (data.type === HlsJs.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
            networkRetries += 1
            setRecovering(true)
            setWaiting(true)
            armTimeout()
            h.startLoad(playbackStarted.current ? media.currentTime : resumeAt.current || -1)
          } else if (data.type === HlsJs.ErrorTypes.MEDIA_ERROR && mediaRetries < 1) {
            mediaRetries += 1
            setRecovering(true)
            setWaiting(true)
            armTimeout()
            h.recoverMediaError()
          } else failOver('Playback was interrupted. Try again to resume from your last position.')
        })
        h.loadSource(source.url)
        h.attachMedia(media)
      }).catch(() => {
        if (!cancelled) failOver('Could not load the streaming player. Please try again.')
      })
    } else {
      media.src = source.url
      start()
    }

    const watchdog = window.setInterval(() => {
      if (cancelled || document.visibilityState === 'hidden' || media.paused || media.ended) {
        lastAdvance = Date.now()
        return
      }
      if (media.currentTime !== lastPosition) {
        lastPosition = media.currentTime
        lastAdvance = Date.now()
        markPlaybackStarted()
        return
      }
      if (!playbackStarted.current || Date.now() - lastAdvance < 8000) return
      lastAdvance = Date.now()
      if (stream && stallRetries < 2) {
        stallRetries += 1
        setRecovering(true)
        setWaiting(true)
        stream.startLoad(media.currentTime)
      } else failOver('Playback has stalled. Try again to continue from here.')
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(watchdog)
      window.clearTimeout(sourceTimeout.current)
      report(media)
      stream?.destroy()
      hls.current = null
      media.removeAttribute('src')
      media.load()
    }
  }, [source, sourceIndex, sources.length, failOver, markPlaybackStarted, report, reload])

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
    window.clearTimeout(lockTimer.current)
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
    if (locked) return
    if ((e.target as HTMLElement).closest('button, input, select, a, [role="menu"], [role="dialog"]')) {
      lastTap.current = null
      showControls()
      return
    }
    root.current?.focus({ preventScroll: true })
    const bounds = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - bounds.left) / bounds.width
    const side = fraction < 1 / 3 ? 'left' : fraction > 2 / 3 ? 'right' : 'center'
    const now = e.timeStamp
    const canGesture = !error && !menuOpen && !trackMenu && !settingsOpen && !episodesOpen
    if (canGesture && lastTap.current?.side === side && now - lastTap.current.time < 350) {
      lastTap.current = null
      if (side === 'center') {
        togglePlay()
        return
      }
      const v = video.current
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return
      seekBy(side === 'left' ? -10 : 10)
      setSeekFeedback(side)
      window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setSeekFeedback(null), 700)
      return
    }
    lastTap.current = canGesture ? { side, time: now } : null
    if (controlsVisible) {
      window.clearTimeout(hideTimer.current)
      setControls(false)
      setMenuOpen(false)
      setTrackMenu(null)
    } else {
      showControls()
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

  function onPlayButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    lastTap.current = null
    const now = e.timeStamp
    // A double tap directly on the button should toggle playback only once.
    if (e.detail > 0 && lastPlayButtonTap.current !== null && now - lastPlayButtonTap.current < 350) {
      lastPlayButtonTap.current = null
      return
    }
    lastPlayButtonTap.current = e.detail > 0 ? now : null
    togglePlay()
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
    if (track.language) preferences.update({ audioLanguage: track.language })
    setAudioTrack(track.id)
  }

  function chooseSubtitleTrack(track: TrackOption | null) {
    if (source) manualSubtitlePreference.current = {source: source.url, language: track?.language ?? 'off'}
    const external = track && track.id >= 10000 ? source?.subtitles?.[track.id - 10000] : undefined
    setExternalSelection(external && source ? { source: source.url, url: external.url } : null)
    const id = external ? -1 : track?.id ?? -1
    if (hls.current) hls.current.subtitleTrack = id
    else Array.from(video.current?.textTracks ?? []).forEach((item, index) => {
      if (!externalTextTracks.has(item) && (item.kind === 'subtitles' || item.kind === 'captions')) item.mode = index === id ? 'hidden' : 'disabled'
    })
    if (!track || track.language) preferences.update({ subtitleLanguage: track?.language ?? 'off' })
    setSubtitleTrack(id)
  }

  function onKey(e: React.KeyboardEvent) {
    if (locked || (e.target as HTMLElement).closest('button, input, select, a, [role="dialog"]')) return
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

  const qualityOptions: QualityOption[] = hlsLevels
  const activeQuality = hlsLevel
  const showUpNext = next && duration > 0 && duration - time < UP_NEXT_SEC

  function revealLockHint() {
    setLockHint(true)
    window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(() => { setLockHint(false); setUnlockArmed(false) }, 3500)
  }

  function lockScreen() {
    hold.stop()
    lastTap.current = null
    setLocked(true)
    setControls(false)
    setMenuOpen(false)
    setTrackMenu(null)
    revealLockHint()
  }

  function goNext() {
    report()
    hold.stop()
    setEnded(false)
    next?.onSelect()
  }

  return (
    <div
      ref={root}
      className={`player player--stream ${controlsVisible ? 'player--controls' : ''} ${locked ? 'player--locked' : ''}`}
      onPointerDown={hold.onPointerDown}
      onPointerUp={hold.stop}
      onPointerCancel={hold.stop}
      onLostPointerCapture={hold.stop}
      onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('input, select')) event.preventDefault() }}
      onPointerMove={(e) => {
        hold.onPointerMove(e)
        if (!locked && !hold.boosting && e.pointerType === 'mouse') showControls()
      }}
      onClickCapture={(event) => {
        if (hold.consumeClick()) {
          lastTap.current = null
          event.preventDefault(); event.stopPropagation()
        } else if (locked && !(event.target as HTMLElement).closest('.player__unlock')) {
          event.preventDefault(); event.stopPropagation(); revealLockHint()
        }
      }}
      onClick={onSurfaceClick}
      onFocus={(e) => {
        if (!locked && e.target.matches(':focus-visible')) showControls()
      }}
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
          setEnded(false)
          setAutoplayCancelled(false)
          showControls()
        }}
        onPause={() => {
          setPlaying(false)
          setControls(true)
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          markPlaybackStarted()
          setWaiting(false)
        }}
        onCanPlay={() => {
          if (video.current?.paused) setWaiting(false)
        }}
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
          hold.stop()
          setPlaying(false)
          setWaiting(false)
          setEnded(true)
          setCountdown(10)
          setControls(true)
          if (!next) cb.current.onEnded()
        }}
        onError={() => {
          if (!hls.current) failOver("This video file can't be played in your browser.")
        }}
      />

      <SubtitleOverlay video={video} controlsVisible={controlsVisible} hidden={Boolean(error)} size={preferences.subtitleSize} />

      {waiting && !error && !ended && <div className="player__buffering" role="status"><div className="spinner" aria-hidden="true" /><span>{recovering ? 'Reconnecting…' : playing ? 'Buffering…' : 'Getting your video ready…'}</span></div>}
      {hold.boosting && <div className="player__speed-feedback" role="status"><Icon name="forward" size={20} /> 2× speed <span>Release to return</span></div>}
      {locked && lockHint && <button className="player__unlock" onClick={(event) => {
        event.stopPropagation()
        if (unlockArmed) { setLocked(false); setUnlockArmed(false); showControls() }
        else { setUnlockArmed(true); revealLockHint() }
      }}><Icon name="lock" />{unlockArmed ? 'Tap again to unlock' : 'Unlock controls'}</button>}

      {error && (
        <div className="player__error" role="alert">
          <p>{error}</p>
          <button className="btn btn--primary" onClick={retryStream}>Retry playback</button>
          {episodes && <button className="btn btn--secondary" onClick={() => setEpisodesOpen(true)}>Choose episode</button>}
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
        <button className="icon-btn icon-btn--lg" onClick={() => { report(); hold.stop(); onBack() }} aria-label="Back">
          <Icon name="back" size={28} />
        </button>
        <div className="player__heading">
          <span className="player__title">{title}</span>
          {subtitle && <span className="player__subtitle">{subtitle}</span>}
        </div>
        <span className="player__spacer" />
        <button className="icon-btn" onClick={lockScreen} aria-label="Lock controls"><Icon name="lock" /></button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Change server" aria-haspopup="dialog"><Icon name="settings" /></button>
      </div>

      <div className="player__center" inert={!controlsVisible || Boolean(error)}>
        <button className="player__big-play" onClick={onPlayButtonClick} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={40} />
        </button>
      </div>

      {next && (showUpNext || ended) && controlsVisible && (
        <div className="player__up-next">
          {ended && preferences.autoplay && !autoplayCancelled && <p role="status">Next episode in {countdown} {countdown === 1 ? 'second' : 'seconds'}</p>}
          <button className="btn btn--primary" onClick={goNext}><Icon name="next" size={20} />{next.label}</button>
          {ended && preferences.autoplay && !autoplayCancelled && <button className="btn btn--secondary" onClick={() => setAutoplayCancelled(true)}>Cancel autoplay</button>}
        </div>
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
            <button className="icon-btn player__labelled" onClick={goNext} aria-label={next.label}>
              <Icon name="next" /> <span>Next</span>
            </button>
          )}
          {episodes && <button className="icon-btn player__labelled" onClick={() => setEpisodesOpen(true)} aria-label="Episodes"><Icon name="episodes" /><span>Episodes</span></button>}
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
          <button className="icon-btn player__labelled" onClick={() => { setTrackMenu('audio'); setMenuOpen(false) }} aria-label="Audio and subtitles" aria-haspopup="dialog"><Icon name="captions" /><span>Audio & subtitles</span></button>
          <button className="icon-btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
            <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} />
          </button>
        </div>
      </div>
      {settingsOpen && <PlayerPanel title="Change server" variant="playback" onClose={() => { setSettingsOpen(false); showControls() }}>
        <p className="player__panel-note">Choose a provider, then a server. Your playback position is kept.</p>
        <p className="player__selection-summary">Audio: {audioTracks.find(track => track.id === audioTrack)?.label ?? 'Stream default'} &middot; Subtitles: {visibleSubtitleTracks.find(track => track.id === visibleSubtitleTrack)?.label ?? 'Off'}</p>
        <ServerChoices sources={sources} active={source} onSelect={item => {
          resumeAt.current = video.current?.currentTime || resumeAt.current
          if (item.url === source?.url && error) retryStream()
          else setSelectedSourceUrl(item.url)
          setSettingsOpen(false); showControls()
        }} />
        {sources.length <= 1 && <p className="player__panel-note">{sources.length ? 'Only one stream is available for this episode or movie.' : 'No providers are available.'}</p>}
      </PlayerPanel>}
      {trackMenu && <PlayerPanel title="Audio & subtitles" variant="languages" onClose={() => { setTrackMenu(null); showControls() }}>
        <p className="player__selection-summary">{source?.provider ?? 'Current stream'} &middot; Audio: {audioTracks.find(track => track.id === audioTrack)?.label ?? 'Stream default'} &middot; Subtitles: {visibleSubtitleTracks.find(track => track.id === visibleSubtitleTrack)?.label ?? 'Off'}</p>
        <LanguageChoices audio={audioTracks} subtitles={visibleSubtitleTracks} audioId={audioTrack} subtitleId={visibleSubtitleTrack} onAudio={chooseAudioTrack} onSubtitle={chooseSubtitleTrack} error={externalError} />
        <footer className="player__language-footer"><span>Language choices are saved for your profile.</span><button onClick={() => { setTrackMenu(null); setSettingsOpen(true) }}>Change server <Icon name="chevron" size={16} /></button></footer>
      </PlayerPanel>}
      {episodesOpen && episodes && <EpisodePicker {...episodes} onClose={() => { setEpisodesOpen(false); showControls() }} onSelect={(selectedSeason, selectedEpisode) => {
        report(); hold.stop(); setEpisodesOpen(false); episodes.onSelect(selectedSeason, selectedEpisode)
      }} />}
    </div>
  )
}
