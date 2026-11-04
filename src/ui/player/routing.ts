import type { Source } from '../../providers'

/** http://localhost[:port]/… or http://127.0.0.1[:port]/… — a media server on the dev machine. */
export function isLocalStream(url: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)
}

/**
 * Which player handles a source: our native <video> + hls.js player for direct
 * streams (always for local media servers), YouTube's embed only for TMDB trailers.
 */
export function usesNativePlayer(source: Source | undefined): boolean {
  if (!source) return true
  return source.type !== 'youtube' || isLocalStream(source.url)
}

/** HLS playlists are recognised by type or by a .m3u8 path. */
export function isHlsSource(source: Source): boolean {
  return source.type === 'hls' || /\.m3u8($|[?#])/i.test(source.url)
}
