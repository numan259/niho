import type { MediaType, Source } from './types'

const API = (
  import.meta.env.VITE_CINEPRO_URL || 'http://localhost:3000'
).replace(/\/$/, '')

export async function getCineProSources(
  mediaType: MediaType,
  tmdbId: number,
  season?: number,
  episode?: number,
  _signal?: AbortSignal,
): Promise<Source[]> {
  const path = mediaType === 'movie'
    ? `/streams/movie/${tmdbId}/master.m3u8`
    : `/streams/tv/${tmdbId}/${season}/${episode}/master.m3u8`

  return [
    {
      url: `${API}${path}`,
      type: 'hls',
      quality: 'CinePro',
    },
  ]
}
