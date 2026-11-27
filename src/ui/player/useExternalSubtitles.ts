import { useEffect, useState, type RefObject } from 'react'
import type { Source } from '../../providers/types'

export const externalTextTracks = new WeakSet<TextTrack>()

/** Load only the selected track; removal cancels stale captions on source changes. */
export function useExternalSubtitles(video: RefObject<HTMLVideoElement | null>, track: NonNullable<Source['subtitles']>[number] | undefined, sourceUrl?: string) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reset the previous network request's error when attaching a new track.
    setError(null)
    const media = video.current
    if (!media || !track) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let element: HTMLTrackElement | undefined
    let blobUrl: string | undefined
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(track.url, { signal: controller.signal })
        if (!response.ok) throw new Error('Subtitle request failed')
        const text = await response.text()
        if (cancelled) return
        if (text.length > 2 * 1024 * 1024 || !/^\uFEFF?WEBVTT(?:\s|$)/.test(text)) throw new Error('Invalid subtitles')
        blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }))
        element = document.createElement('track')
        element.kind = 'subtitles'
        element.label = track.label
        element.srclang = track.language ?? ''
        element.src = blobUrl
        externalTextTracks.add(element.track)
        element.onerror = () => { if (!cancelled) setError('These subtitles could not be loaded. Try another track.') }
        media.appendChild(element)
        element.track.mode = 'hidden'
      } catch {
        if (!cancelled) setError('These subtitles could not be loaded. Try another track.')
      } finally { clearTimeout(timeout) }
    })()
    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
      if (element) { element.track.mode = 'disabled'; element.remove() }
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [video, track, sourceUrl])
  return error
}
