import { getTitleDetail } from './tmdb'
import type { MediaType, Source, TitleDetail, TitleSummary, Video } from './types'

export * from './types'

export function getTitle(mediaType: MediaType, id: number, signal?: AbortSignal): Promise<TitleDetail | null> {
  return getTitleDetail(mediaType, id, undefined, signal)
}

export function isMediaType(v: string | undefined): v is MediaType {
  return v === 'movie' || v === 'tv'
}

/** Route param → positive integer TMDB id, or undefined. */
export function parseTmdbId(v: string | undefined): number | undefined {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** Strips a detail down to what lists and local storage need. */
export function toSummary(t: TitleSummary): TitleSummary {
  const { key, mediaType, id, name, year, synopsis, tags, poster, backdrop, rating } = t
  return { key, mediaType, id, name, year, synopsis, tags, poster, backdrop, rating }
}

/** TMDB videos → player sources (official YouTube embeds). */
export function videoSources(videos: Video[]): Source[] {
  return videos.map((v) => ({ url: v.key, type: 'youtube', quality: v.name }))
}
