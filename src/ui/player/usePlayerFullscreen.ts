import { SystemBars } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { isNative } from '../../native'

// Serialize native changes so exiting during rotation cannot leave the phone locked.
let displayChanges = Promise.resolve()

export function usePlayerFullscreen(root: RefObject<HTMLDivElement | null>, video: RefObject<HTMLVideoElement | null>) {
  const [fullscreen, setFullscreen] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    if (!isNative || !fullscreen) return
    displayChanges = displayChanges.then(async () => {
      await ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => undefined)
      await SystemBars.hide().catch(() => undefined)
    })
    const onBack = (event: Event) => {
      event.preventDefault()
      setFullscreen(false)
    }
    window.addEventListener('niho:exit-fullscreen', onBack)
    return () => {
      window.removeEventListener('niho:exit-fullscreen', onBack)
      displayChanges = displayChanges.then(async () => {
        await ScreenOrientation.unlock().catch(() => undefined)
        await SystemBars.show().catch(() => undefined)
      })
    }
  }, [fullscreen])

  useEffect(() => {
    if (isNative) return
    const element = root.current
    const media = video.current
    let active = true
    let ownedFullscreen = false
    const unlock = () => {
      try { screen.orientation?.unlock() } catch { /* Unsupported browser. */ }
    }
    const onChange = async () => {
      const entered = document.fullscreenElement === element
      setFullscreen(entered)
      if (entered) {
        ownedFullscreen = true
        await ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => undefined)
        if (!active || document.fullscreenElement !== element) unlock()
      } else if (ownedFullscreen) {
        ownedFullscreen = false
        unlock()
      }
    }
    const onNativeBegin = () => setFullscreen(true)
    const onNativeEnd = () => setFullscreen(false)
    document.addEventListener('fullscreenchange', onChange)
    media?.addEventListener('webkitbeginfullscreen', onNativeBegin)
    media?.addEventListener('webkitendfullscreen', onNativeEnd)
    return () => {
      active = false
      document.removeEventListener('fullscreenchange', onChange)
      media?.removeEventListener('webkitbeginfullscreen', onNativeBegin)
      media?.removeEventListener('webkitendfullscreen', onNativeEnd)
      if (ownedFullscreen) unlock()
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined)
    }
  }, [root, video])

  const toggleFullscreen = useCallback(async () => {
    if (isNative) {
      setFullscreen((value) => !value)
      return
    }
    if (busy.current) return
    busy.current = true
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen()
      else (video.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void } | null)?.webkitEnterFullscreen?.()
    } catch {
      // Keep inline playback available if fullscreen is denied.
    } finally {
      busy.current = false
    }
  }, [root, video])

  return { fullscreen, toggleFullscreen }
}
