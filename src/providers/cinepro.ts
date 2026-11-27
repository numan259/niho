import type { MediaType, Source } from './types'
import { DEFAULT_PLAYBACK, type PlaybackPreferences } from '../state/playback'
import { rankSources } from './languages'

const API = (
  import.meta.env.VITE_CINEPRO_URL || 'http://localhost:3000'
).replace(/\/$/, '')

/** Validate the wire contract without trusting provider-specific payload fields. */
export function parseCineProSources(data: unknown): Source[] {
  if (!data || typeof data !== 'object' || !('sources' in data) || !Array.isArray(data.sources)) return []
  const seen = new Set<string>()
  const languages = (value: unknown): string[] | undefined => Array.isArray(value) && value.every(
    code => typeof code === 'string' && /^[a-z]{2,3}([-_][a-z0-9]+)*$/i.test(code),
  ) ? value : undefined
  return data.sources.flatMap((item: unknown): Source[] => {
    if (!item || typeof item !== 'object') return []
    const source = item as Record<string, unknown>
    if (typeof source.url !== 'string' || (source.type !== 'hls' && source.type !== 'mp4')) return []
    try {
      const url = new URL(source.url)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || seen.has(source.url)) return []
    } catch { return [] }
    seen.add(source.url)
    const subtitleUrls = new Set<string>()
    const subtitles: NonNullable<Source['subtitles']> = Array.isArray(source.subtitles) ? source.subtitles.slice(0, 100).flatMap((track) => {
      if (!track || typeof track !== 'object' || track.format !== 'vtt' || typeof track.url !== 'string' || typeof track.label !== 'string') return []
      try {
        const url = new URL(track.url)
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || subtitleUrls.has(url.href)) return []
        subtitleUrls.add(url.href)
        return [{ url: url.href, format: 'vtt' as const, label: track.label, language: languages([track.language])?.[0] }]
      } catch { return [] }
    }) : []
    return [{
      url: source.url, type: source.type,
      provider: typeof source.provider === 'string' ? source.provider : undefined,
      quality: typeof source.quality === 'string' ? source.quality : undefined,
      audioLanguages: languages(source.audioLanguages),
      subtitleLanguages: languages(source.subtitleLanguages),
      ...(subtitles.length ? { subtitles } : {}),
    }]
  })
}

export async function getCineProSources(
  mediaType: MediaType,
  tmdbId: number,
  season?: number,
  episode?: number,
  signal?: AbortSignal,
  preferences: PlaybackPreferences = DEFAULT_PLAYBACK,
): Promise<Source[]> {
  const path = mediaType === 'movie'
    ? `/streams/movie/${tmdbId}/master.m3u8`
    : `/streams/tv/${tmdbId}/${season}/${episode}/master.m3u8`

  const params = new URLSearchParams({ preferredAudioLanguage: preferences.audioLanguage, preferredSubtitleLanguage: preferences.subtitleLanguage, languagePriority: preferences.languagePriority })
  // Opt in only after the deployed backend supports this contract.
  const suffix = import.meta.env.VITE_CINEPRO_LANGUAGE_PARAMS === 'true' ? `?${params}` : ''
  const endpoint = import.meta.env.VITE_CINEPRO_SOURCES_URL
  if (endpoint) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 10000)
    try {
      signal?.throwIfAborted()
      const url = new URL(endpoint)
      url.searchParams.set('mediaType', mediaType)
      url.searchParams.set('tmdbId', String(tmdbId))
      if (season !== undefined) url.searchParams.set('season', String(season))
      if (episode !== undefined) url.searchParams.set('episode', String(episode))
      params.forEach((value, key) => url.searchParams.set(key, value))
      const response = await fetch(url, { signal: controller.signal })
      if (response.ok) {
        const valid = parseCineProSources(await response.json())
        if (valid.length) return rankSources(valid, preferences)
      }
    } catch (error) {
      if (signal?.aborted) throw error
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  return [
    {
      url: `${API}${path}${suffix}`,
      type: 'hls',
      quality: 'CinePro',
    },
  ]
}
