import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { App } from '@capacitor/app'
import { isNative } from '../../native'

export function useHoldSpeed(video: RefObject<HTMLVideoElement | null>, disabled: boolean) {
  const [boosting, setBoosting] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const active = useRef<{ media: HTMLVideoElement; rate: number } | null>(null)
  const suppressClick = useRef(false)
  const stop = useCallback(() => {
    window.clearTimeout(timer.current)
    pointer.current = null
    if (active.current) {
      active.current.media.playbackRate = active.current.rate
      active.current = null
    }
    setBoosting(false)
  }, [])
  useEffect(() => {
    const media = video.current
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    media?.addEventListener('pause', stop)
    const listener = isNative ? App.addListener('appStateChange', ({ isActive }) => { if (!isActive) stop() }) : null
    // oxlint-disable-next-line react/set-state-in-effect -- disabling a gesture must restore the media playback rate immediately.
    if (disabled) stop()
    return () => {
      stop()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      media?.removeEventListener('pause', stop)
      void listener?.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [video, disabled, stop])
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    stop()
    suppressClick.current = false
    const media = video.current
    if (disabled || !media || media.paused || event.button !== 0 || event.isPrimary === false ||
      (event.target as HTMLElement).closest('button, input, select, a, [role="dialog"], [role="menu"]')) return
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    const target = event.currentTarget
    const pointerId = event.pointerId
    timer.current = window.setTimeout(() => {
      if (!pointer.current || media.paused) return
      active.current = { media, rate: media.playbackRate }
      media.playbackRate = 2
      suppressClick.current = true
      setBoosting(true)
      try { target.setPointerCapture(pointerId) } catch { /* Pointer already released. */ }
    }, 450)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    if (start && !active.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 18) stop()
  }
  const consumeClick = () => {
    const result = suppressClick.current
    suppressClick.current = false
    return result
  }
  return { boosting, stop, consumeClick, onPointerDown, onPointerMove }
}
