import { App } from '@capacitor/app'
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { isNative } from '../../native'

/** Capture the actual media element: React clears its ref before passive cleanup. */
export function useWatchProgress(video: RefObject<HTMLVideoElement | null>, startAt: number, onProgress: (position: number, duration: number) => void) {
  const callback = useRef(onProgress)
  const initialPosition = useRef(startAt)
  const sampled = useRef(false)
  useLayoutEffect(() => { callback.current = onProgress })
  const report = useCallback((element?: HTMLVideoElement | null) => {
    const media = element ?? video.current
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0 || !Number.isFinite(media.currentTime)) return
    // Do not replace a saved resume point with zero before the stream seeks to it.
    if (!sampled.current && initialPosition.current > 0 && media.currentTime === 0) return
    sampled.current = true
    callback.current(Math.max(0, media.currentTime), media.duration)
  // oxlint-disable-next-line react/preserve-manual-memoization -- stable ref identity; read its current element only when saving, never during render.
  }, [video])

  useLayoutEffect(() => {
    const media = video.current
    if (!media) return
    const save = () => report(media)
    const timer = window.setInterval(() => { if (!media.paused) save() }, 5000)
    media.addEventListener('pause', save)
    media.addEventListener('seeked', save)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', save)
    document.addEventListener('freeze', save)
    const listener = isNative ? App.addListener('appStateChange', ({ isActive }) => { if (!isActive) save() }) : null
    return () => {
      save()
      window.clearInterval(timer)
      media.removeEventListener('pause', save)
      media.removeEventListener('seeked', save)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', save)
      document.removeEventListener('freeze', save)
      void listener?.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [video, report])
  return report
}
