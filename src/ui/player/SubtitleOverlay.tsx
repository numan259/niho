import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

// Only retain subtitle formatting, never arbitrary markup or styles from a stream.
function cueContent(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  const children = Array.from(node.childNodes, cueContent)
  if (node instanceof Element) {
    switch (node.tagName.toLowerCase()) {
      case 'i': return <i key={key}>{children}</i>
      case 'b': return <b key={key}>{children}</b>
      case 'u': return <u key={key}>{children}</u>
      case 'ruby': return <ruby key={key}>{children}</ruby>
      case 'rt': return <rt key={key}>{children}</rt>
    }
  }
  return <span key={key}>{children}</span>
}

export function SubtitleOverlay({ video, controlsVisible, hidden }: {
  video: RefObject<HTMLVideoElement | null>
  controlsVisible: boolean
  hidden: boolean
}) {
  const [cues, setCues] = useState<VTTCue[]>([])
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [layout, setLayout] = useState({ left: 0, top: 0, width: 0, height: 0, bottom: 20, fontSize: 24 })
  const nativeMode = useRef(false)

  useEffect(() => {
    const media = video.current
    if (!media) return
    const list = media.textTracks
    const attached = new Set<TextTrack>()
    const isSubtitle = (track: TextTrack) => track.kind === 'subtitles' || track.kind === 'captions'
    const update = () => {
      const next: VTTCue[] = []
      for (const track of Array.from(list)) {
        if (!isSubtitle(track) || track.mode === 'disabled') continue
        // Hidden keeps cue timing/loading active, while avoiding duplicate browser captions.
        const mode = nativeMode.current ? 'showing' : 'hidden'
        if (track.mode !== mode) track.mode = mode
        for (const cue of Array.from(track.activeCues ?? [])) {
          if ('getCueAsHTML' in cue) next.push(cue as VTTCue)
        }
      }
      setCues((previous) => previous.length === next.length && previous.every((cue, i) => cue === next[i]) ? previous : next)
    }
    const syncTracks = () => {
      for (const track of attached) {
        if (!Array.from(list).includes(track)) {
          track.removeEventListener('cuechange', update)
          attached.delete(track)
        }
      }
      for (const track of Array.from(list)) {
        if (isSubtitle(track) && !attached.has(track)) {
          track.addEventListener('cuechange', update)
          attached.add(track)
        }
      }
      update()
    }
    const beginNativeFullscreen = () => {
      nativeMode.current = true
      setNativeFullscreen(true)
      update()
    }
    const endNativeFullscreen = () => {
      nativeMode.current = false
      setNativeFullscreen(false)
      update()
    }
    list.addEventListener('addtrack', syncTracks)
    list.addEventListener('removetrack', syncTracks)
    list.addEventListener('change', update)
    media.addEventListener('emptied', update)
    media.addEventListener('webkitbeginfullscreen', beginNativeFullscreen)
    media.addEventListener('webkitendfullscreen', endNativeFullscreen)
    syncTracks()
    return () => {
      list.removeEventListener('addtrack', syncTracks)
      list.removeEventListener('removetrack', syncTracks)
      list.removeEventListener('change', update)
      media.removeEventListener('emptied', update)
      media.removeEventListener('webkitbeginfullscreen', beginNativeFullscreen)
      media.removeEventListener('webkitendfullscreen', endNativeFullscreen)
      for (const track of attached) track.removeEventListener('cuechange', update)
    }
  }, [video])

  useLayoutEffect(() => {
    const media = video.current
    const player = media?.parentElement
    if (!media || !player) return
    const scrubber = player.querySelector('.player__scrub')
    const measure = () => {
      const bounds = media.getBoundingClientRect()
      const parent = player.getBoundingClientRect()
      const scale = media.videoWidth && media.videoHeight
        ? Math.min(bounds.width / media.videoWidth, bounds.height / media.videoHeight)
        : 0
      const width = scale ? media.videoWidth * scale : bounds.width
      const height = scale ? media.videoHeight * scale : bounds.height
      const top = bounds.top - parent.top + (bounds.height - height) / 2
      const left = bounds.left - parent.left + (bounds.width - width) / 2
      const restingBottom = Math.max(16, height * 0.075)
      const controlsTop = scrubber?.getBoundingClientRect().top ?? bounds.bottom
      const raisedBottom = controlsVisible ? parent.top + top + height - controlsTop + 14 : 0
      setLayout({ left, top, width, height,
        bottom: Math.min(height * 0.6, Math.max(restingBottom, raisedBottom)),
        fontSize: Math.max(16, Math.min(48, width * 0.026, height * 0.06)),
      })
    }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(player)
    if (scrubber) observer?.observe(scrubber)
    media.addEventListener('loadedmetadata', measure)
    media.addEventListener('resize', measure)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer?.disconnect()
      media.removeEventListener('loadedmetadata', measure)
      media.removeEventListener('resize', measure)
      window.removeEventListener('resize', measure)
    }
  }, [video, controlsVisible])

  return (
    <div className="player__subtitle-frame" hidden={hidden || nativeFullscreen || !cues.length}
      style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}>
      <div className="player__captions" style={{ bottom: layout.bottom, fontSize: layout.fontSize }}>
        {cues.map((cue, index) => <div key={`${cue.id}-${cue.startTime}-${index}`} dir="auto">{cueContent(cue.getCueAsHTML(), index)}</div>)}
      </div>
    </div>
  )
}
