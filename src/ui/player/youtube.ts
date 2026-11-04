/**
 * Minimal typed loader for the official YouTube IFrame Player API.
 * TMDB trailers are YouTube videos; YouTube's terms only allow playing them
 * through its own embedded player, so we drive that player instead of <video>.
 */

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
}

export interface YTPlayerEvent {
  target: YTPlayer
  data: number
}

export interface YTPlayerOptions {
  host?: string
  videoId: string
  width?: string
  height?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: YTPlayerEvent) => void
    onStateChange?: (e: YTPlayerEvent) => void
    onError?: (e: YTPlayerEvent) => void
  }
}

export interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Privacy-enhanced host: no YouTube cookies until the viewer presses play. */
export const YOUTUBE_HOST = 'https://www.youtube-nocookie.com'

let loading: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!loading) {
    loading = new Promise<YTNamespace>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        resolve(window.YT!)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        loading = null
        reject(new Error('YouTube player failed to load'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

/** Plain embed URL for lightweight muted previews (Clips feed). */
export function youtubeEmbedUrl(key: string, params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams({ playsinline: '1', rel: '0', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  return `${YOUTUBE_HOST}/embed/${encodeURIComponent(key)}?${query}`
}

export const youtubeWatchUrl = (key: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`

/** YouTube player error codes → viewer-facing reason. */
export function youtubeErrorMessage(code: number): string {
  if (code === 101 || code === 150 || code === 153) return 'The owner of this trailer doesn’t allow it to be played outside YouTube.'
  if (code === 100) return 'This trailer has been removed from YouTube.'
  return 'This trailer can’t be played right now.'
}
