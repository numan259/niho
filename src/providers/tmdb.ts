import type {
  CastMember,
  Episode,
  MediaType,
  SearchPage,
  SeasonSummary,
  TitleDetail,
  TitleSummary,
  Video,
  WatchAvailability,
  WatchProvider,
} from './types'

const API = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'
/** TMDB serves at most 500 pages of any list. */
const MAX_PAGES = 500

export const IMAGE_SIZES = {
  poster: 'w500',
  backdrop: 'original',
  /** smaller backdrop for cards (Continue Watching, search list) */
  thumb: 'w780',
  still: 'w300',
  logo: 'w92',
  profile: 'w185',
} as const

export function imageUrl(path: string | null | undefined, size: string): string | undefined {
  return path ? `${IMG}/${size}${path}` : undefined
}

/** Re-sizes a TMDB image URL, e.g. an `original` backdrop down to `w780` for a small card. */
export function resizeImage(url: string | undefined, size: string): string | undefined {
  return url?.replace(/(image\.tmdb\.org\/t\/p\/)[^/]+/, `$1${size}`)
}

/** TMDB's fixed genre ids (movie + TV lists combined). */
export const GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
}

/** Genres a Kids profile is allowed to see. */
export const KIDS_GENRES = [16, 10751, 10762]

// ----------------------------------------------------------------- client

const CREDENTIAL = (import.meta.env.VITE_TMDB_API_KEY ?? '').trim()
export const hasTmdbKey = CREDENTIAL.length > 0

export class TmdbError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TmdbError'
    this.status = status
  }
}

export const MISSING_KEY_MESSAGE = 'Add your TMDB key as VITE_TMDB_API_KEY in .env.local, then restart the app.'

type Params = Record<string, string | number | boolean | undefined>

/** Builds a TMDB request; v4 read tokens go in a header, v3 keys in the query. */
export function buildRequest(path: string, params: Params = {}, credential = CREDENTIAL) {
  const url = new URL(API + path)
  url.searchParams.set('language', 'en-US')
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v))
  const headers: Record<string, string> = { accept: 'application/json' }
  if (credential.startsWith('eyJ')) headers.Authorization = `Bearer ${credential}`
  else url.searchParams.set('api_key', credential)
  return { url: url.toString(), headers }
}

function errorFor(status: number): string {
  if (status === 401) return 'TMDB rejected the API key. Check VITE_TMDB_API_KEY in .env.local.'
  if (status === 404) return 'This title was not found on TMDB.'
  if (status === 429) return 'TMDB rate limit reached. Try again in a moment.'
  return `TMDB request failed (${status}).`
}

async function tmdb<T>(path: string, params: Params, signal?: AbortSignal): Promise<T> {
  if (!hasTmdbKey) throw new TmdbError(MISSING_KEY_MESSAGE, 401)
  const { url, headers } = buildRequest(path, params)
  const res = await fetch(url, { headers, signal })
  if (!res.ok) throw new TmdbError(errorFor(res.status), res.status)
  return (await res.json()) as T
}

// ------------------------------------------------------------- raw shapes

export interface RawListItem {
  id: number
  media_type?: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  overview?: string
  genre_ids?: number[]
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  adult?: boolean
}

export interface RawList {
  page: number
  results: RawListItem[]
  total_pages: number
  total_results: number
}

interface RawVideo {
  key: string
  site: string
  name: string
  type: string
  official?: boolean
  size?: number
  published_at?: string
}

interface RawProvider {
  provider_id: number
  provider_name: string
  logo_path?: string | null
  display_priority?: number
}

interface RawRegionProviders {
  link?: string
  flatrate?: RawProvider[]
  free?: RawProvider[]
  ads?: RawProvider[]
  rent?: RawProvider[]
  buy?: RawProvider[]
}

export interface RawDetail extends RawListItem {
  genres?: { id: number; name: string }[]
  tagline?: string
  runtime?: number | null
  episode_run_time?: number[]
  seasons?: { season_number: number; name: string; episode_count: number; air_date?: string | null }[]
  created_by?: { name: string }[]
  credits?: {
    cast?: { id: number; name: string; character?: string; profile_path?: string | null; order?: number }[]
    crew?: { job?: string; name: string }[]
  }
  videos?: { results?: RawVideo[] }
  'watch/providers'?: { results?: Record<string, RawRegionProviders> }
  release_dates?: { results?: { iso_3166_1: string; release_dates: { certification?: string; type?: number }[] }[] }
  content_ratings?: { results?: { iso_3166_1: string; rating?: string }[] }
}

export interface RawSeason {
  season_number: number
  episodes?: {
    episode_number: number
    season_number?: number
    name?: string
    overview?: string
    still_path?: string | null
    runtime?: number | null
    air_date?: string | null
  }[]
}

// ---------------------------------------------------------------- mapping

export function yearOf(date: string | null | undefined): number | undefined {
  const m = date?.match(/^(\d{4})/)
  return m ? Number(m[1]) : undefined
}

function roundRating(v: number | undefined): number | undefined {
  return v && v > 0 ? Math.round(v * 10) / 10 : undefined
}

/** List / search result → summary. Drops people, adult titles and nameless entries. */
export function mapListItem(raw: RawListItem, fallback?: MediaType): TitleSummary | null {
  const mediaType = raw.media_type ?? fallback
  if (mediaType !== 'movie' && mediaType !== 'tv') return null
  if (raw.adult) return null
  const name = (raw.title ?? raw.name ?? '').trim()
  if (!name || !Number.isInteger(raw.id)) return null
  return {
    key: `${mediaType}/${raw.id}`,
    mediaType,
    id: raw.id,
    name,
    year: yearOf(raw.release_date ?? raw.first_air_date),
    synopsis: raw.overview?.trim() || undefined,
    tags: (raw.genre_ids ?? []).map((g) => GENRES[g]).filter(Boolean).slice(0, 3),
    poster: imageUrl(raw.poster_path, IMAGE_SIZES.poster),
    backdrop: imageUrl(raw.backdrop_path, IMAGE_SIZES.backdrop),
    rating: roundRating(raw.vote_average),
  }
}

export function mapList(raw: RawList, fallback?: MediaType, keep?: (item: RawListItem) => boolean): SearchPage {
  const items: TitleSummary[] = []
  const seen = new Set<string>()
  for (const r of raw.results) {
    if (keep && !keep(r)) continue
    const t = mapListItem(r, fallback)
    if (t && !seen.has(t.key)) {
      seen.add(t.key)
      items.push(t)
    }
  }
  return {
    items,
    total: raw.total_results,
    page: raw.page,
    hasMore: raw.page < Math.min(raw.total_pages, MAX_PAGES),
  }
}

/** Flattens infinite-scroll pages; TMDB can repeat a title on consecutive pages as rankings shift. */
export function mergePages(pages: SearchPage[] | undefined): TitleSummary[] {
  const seen = new Set<string>()
  return (pages ?? []).flatMap((p) => p.items).filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)))
}

const VIDEO_TYPE_RANK: Record<string, number> = { Trailer: 0, Teaser: 1, Clip: 2, Featurette: 3 }

/** Playable (YouTube) videos, best trailer first. */
export function pickVideos(results: RawVideo[] | undefined): Video[] {
  const rank = (t: string) => VIDEO_TYPE_RANK[t] ?? 9
  const seen = new Set<string>()
  return (results ?? [])
    .filter((v) => v.site === 'YouTube' && v.key)
    .sort(
      (a, b) =>
        rank(a.type) - rank(b.type) ||
        Number(Boolean(b.official)) - Number(Boolean(a.official)) ||
        (b.size ?? 0) - (a.size ?? 0) ||
        (Date.parse(b.published_at ?? '') || 0) - (Date.parse(a.published_at ?? '') || 0),
    )
    .filter((v) => (seen.has(v.key) ? false : (seen.add(v.key), true)))
    .slice(0, 8)
    .map((v) => ({ key: v.key, name: v.name, type: v.type, official: Boolean(v.official) }))
}

function mapProviders(...lists: (RawProvider[] | undefined)[]): WatchProvider[] {
  const seen = new Set<number>()
  return lists
    .flatMap((l) => l ?? [])
    .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
    .filter((p) => (seen.has(p.provider_id) ? false : (seen.add(p.provider_id), true)))
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logo: imageUrl(p.logo_path, IMAGE_SIZES.logo) }))
}

/** JustWatch availability for one country (via TMDB), or undefined when there is none. */
export function mapWatchProviders(results: Record<string, RawRegionProviders> | undefined, region: string): WatchAvailability | undefined {
  const r = results?.[region]
  if (!r) return undefined
  return {
    region,
    link: r.link,
    stream: mapProviders(r.flatrate),
    free: mapProviders(r.free, r.ads),
    rent: mapProviders(r.rent),
    buy: mapProviders(r.buy),
  }
}

function certificationOf(raw: RawDetail, mediaType: MediaType, region: string): string | undefined {
  const pick = (r: string) => {
    if (mediaType === 'movie') {
      const dates = raw.release_dates?.results?.find((x) => x.iso_3166_1 === r)?.release_dates ?? []
      // Prefer the theatrical (3) rating, then any non-empty one.
      return (dates.find((d) => d.type === 3 && d.certification) ?? dates.find((d) => d.certification))?.certification
    }
    return raw.content_ratings?.results?.find((x) => x.iso_3166_1 === r)?.rating || undefined
  }
  return pick(region) || (region !== 'US' ? pick('US') : undefined) || undefined
}

export function mapDetail(raw: RawDetail, mediaType: MediaType, region: string): TitleDetail | null {
  const summary = mapListItem({ ...raw, media_type: mediaType, genre_ids: raw.genres?.map((g) => g.id) }, mediaType)
  if (!summary) return null

  const makers =
    mediaType === 'movie'
      ? (raw.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name)
      : (raw.created_by ?? []).map((c) => c.name)

  const cast: CastMember[] = [...(raw.credits?.cast ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 12)
    .map((c) => ({ id: c.id, name: c.name, character: c.character || undefined, photo: imageUrl(c.profile_path, IMAGE_SIZES.profile) }))

  const seasons: SeasonSummary[] = (raw.seasons ?? [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count, year: yearOf(s.air_date) }))

  return {
    ...summary,
    tags: (raw.genres ?? []).map((g) => g.name).slice(0, 4),
    tagline: raw.tagline?.trim() || undefined,
    runtimeMin: (mediaType === 'movie' ? raw.runtime : raw.episode_run_time?.[0]) || undefined,
    certification: certificationOf(raw, mediaType, region),
    makers: [...new Set(makers)].slice(0, 3),
    cast,
    videos: pickVideos(raw.videos?.results),
    seasons,
    watch: mapWatchProviders(raw['watch/providers']?.results, region),
    sourcePage: `https://www.themoviedb.org/${mediaType}/${raw.id}`,
  }
}

export function mapSeason(raw: RawSeason): Episode[] {
  return (raw.episodes ?? [])
    .map((e) => ({
      season: e.season_number ?? raw.season_number,
      number: e.episode_number,
      name: e.name?.trim() || `Episode ${e.episode_number}`,
      overview: e.overview?.trim() || undefined,
      still: imageUrl(e.still_path, IMAGE_SIZES.still),
      runtimeMin: e.runtime || undefined,
      airDate: e.air_date || undefined,
    }))
    .sort((a, b) => a.number - b.number)
}

/** "en-PK" → "PK"; falls back to US when the locale has no country. */
export function detectRegion(locale: string | undefined = typeof navigator !== 'undefined' ? navigator.language : undefined): string {
  const m = locale?.match(/[-_]([A-Za-z]{2})\b/)
  return m ? m[1].toUpperCase() : 'US'
}

// --------------------------------------------------------------- endpoints

export type ListSource =
  | { kind: 'trending'; media: MediaType | 'all' }
  | { kind: 'popular' | 'top_rated'; media: MediaType }
  | { kind: 'discover'; media: MediaType; genres: number[]; kidsSafe?: boolean }

export function listRequest(src: ListSource): { path: string; params: Params } {
  switch (src.kind) {
    case 'trending':
      return { path: `/trending/${src.media}/week`, params: {} }
    case 'popular':
    case 'top_rated':
      return { path: `/${src.media}/${src.kind}`, params: {} }
    case 'discover':
      return {
        path: `/discover/${src.media}`,
        params: {
          with_genres: src.genres.join('|'),
          sort_by: 'popularity.desc',
          include_adult: false,
          'vote_count.gte': 50,
          ...(src.kidsSafe && src.media === 'movie' ? { certification_country: 'US', 'certification.lte': 'PG' } : {}),
        },
      }
  }
}

export async function fetchList(src: ListSource, page = 1, signal?: AbortSignal): Promise<SearchPage> {
  const { path, params } = listRequest(src)
  const raw = await tmdb<RawList>(path, { ...params, page }, signal)
  return mapList(raw, src.media === 'all' ? undefined : src.media)
}

export async function searchTitles(query: string, page = 1, opts: { kids?: boolean } = {}, signal?: AbortSignal): Promise<SearchPage> {
  const raw = await tmdb<RawList>('/search/multi', { query: query.trim(), page, include_adult: false }, signal)
  const keep = opts.kids ? (r: RawListItem) => (r.genre_ids ?? []).some((g) => KIDS_GENRES.includes(g)) : undefined
  return mapList(raw, undefined, keep)
}

export async function getTitleDetail(mediaType: MediaType, id: number, region = detectRegion(), signal?: AbortSignal): Promise<TitleDetail | null> {
  const ratings = mediaType === 'movie' ? 'release_dates' : 'content_ratings'
  const raw = await tmdb<RawDetail>(
    `/${mediaType}/${id}`,
    { append_to_response: `videos,credits,watch/providers,${ratings}`, include_video_language: 'en,null' },
    signal,
  )
  return mapDetail(raw, mediaType, region)
}

export async function getSeason(tvId: number, season: number, signal?: AbortSignal): Promise<Episode[]> {
  return mapSeason(await tmdb<RawSeason>(`/tv/${tvId}/season/${season}`, {}, signal))
}

/** Episode clip, else the season trailer — callers fall back to the show's own trailers. */
export async function getEpisodeVideos(tvId: number, season: number, episode: number, signal?: AbortSignal): Promise<Video[]> {
  const params = { include_video_language: 'en,null' }
  const ep = await tmdb<{ results?: RawVideo[] }>(`/tv/${tvId}/season/${season}/episode/${episode}/videos`, params, signal)
  const epVideos = pickVideos(ep.results)
  if (epVideos.length) return epVideos
  const se = await tmdb<{ results?: RawVideo[] }>(`/tv/${tvId}/season/${season}/videos`, params, signal)
  return pickVideos(se.results)
}

export async function getRecommendations(mediaType: MediaType, id: number, signal?: AbortSignal): Promise<TitleSummary[]> {
  const rec = mapList(await tmdb<RawList>(`/${mediaType}/${id}/recommendations`, {}, signal), mediaType).items
  if (rec.length) return rec
  return mapList(await tmdb<RawList>(`/${mediaType}/${id}/similar`, {}, signal), mediaType).items
}
