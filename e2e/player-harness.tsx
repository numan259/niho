import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { VideoPlayer } from '../src/ui/player/VideoPlayer'
import '../src/index.css'
import { usePlaybackPreferences } from '../src/state/playback'

// Deterministic media clock for browser gesture/layout checks; no external streams.
export function PlayerHarness() {
  useEffect(() => {
    const video = document.querySelector('video')!
    let paused = false
    Object.defineProperties(video, {
      duration: { get: () => 3600 },
      videoWidth: { get: () => 1920 },
      videoHeight: { get: () => 1080 },
      paused: { get: () => paused },
      play: { value: async () => { paused = false; video.dispatchEvent(new Event('play')) } },
      pause: { value: () => { paused = true; video.dispatchEvent(new Event('pause')) } },
    })
    video.currentTime = 120
    video.dispatchEvent(new Event('loadedmetadata'))
    video.dispatchEvent(new Event('timeupdate'))
    video.dispatchEvent(new Event('play'))
    video.dispatchEvent(new Event('playing'))
    if (new URLSearchParams(location.search).has('captions')) {
      usePlaybackPreferences.getState().update({ subtitleLanguage: 'en' })
      // A real local video clock exercises browser cue activation and cuechange.
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const context = canvas.getContext('2d')!
      const draw = () => {
        const gradient = context.createLinearGradient(0, 0, 1920, 1080)
        gradient.addColorStop(0, '#344751')
        gradient.addColorStop(1, '#967b61')
        context.fillStyle = gradient
        context.fillRect(0, 0, 1920, 1080)
      }
      draw()
      const stream = canvas.captureStream(2)
      video.srcObject = stream
      video.muted = true
      const track = video.addTextTrack('subtitles', 'English', 'en')
      track.mode = 'showing'
      track.addCue(new VTTCue(0, 3600, '-Hey.\n-Your <i>coffee</i>.'))
      void HTMLMediaElement.prototype.play.call(video)
      const timer = window.setInterval(draw, 500)
      return () => {
        window.clearInterval(timer)
        stream.getTracks().forEach((item) => item.stop())
      }
    }
  }, [])
  return <VideoPlayer sources={[]} title="The Mentalist" subtitle="S1:E1 · Nothing But Blue Skies" onBack={() => {}} onProgress={(position, duration) => { sessionStorage.setItem('test-progress', JSON.stringify({ position, duration })) }} onEnded={() => {}} next={{ label: 'Next episode', onSelect: () => { sessionStorage.setItem('test-next', 'played') } }} />
}

createRoot(document.getElementById('root')!).render(<PlayerHarness />)
