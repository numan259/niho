export type MediaType = 'movie' | 'tv'

export interface Source {
  url: string
  /** youtube = official YouTube embed; hls/mp4 = direct streams */
  type: 'mp4' | 'hls' | 'youtube'
  /** Label shown in the player's source menu, e.g. "Official Trailer" or "720p" */
  quality?: string
}

/** A trailer / teaser / clip as listed by TMDB (hosted on YouTube). */
export interface Video {
  /** YouTube video id */
  key: string
  name: string
  type: string
  official: boolean
}

/** Light-weight title as returned by list / search endpoints. */
export interface TitleSummary {
  /** Stable unique key: `${mediaType}/${id}` */
  key: string
  mediaType: MediaType
  /** Numerical TMDB id */
  id: number
  name: string
  year?: number
  synopsis?: string
  /** Genre names */
  tags: string[]
  poster?: string
  backdrop?: string
  /** TMDB user score 0–10, one decimal */
  rating?: number
}

export interface CastMember {
  id: number
  name: string
  character?: string
  photo?: string
}

export interface SeasonSummary {
  number: number
  name: string
  episodeCount: number
  year?: number
}

export interface Episode {
  season: number
  number: number
  name: string
  overview?: string
  still?: string
  runtimeMin?: number
  airDate?: string
}

export interface WatchProvider {
  id: number
  name: string
  logo?: string
}

/** JustWatch availability data for one country, via TMDB. */
export interface WatchAvailability {
  region: string
  /** TMDB "where to watch" page for this title + region */
  link?: string
  stream: WatchProvider[]
  free: WatchProvider[]
  rent: WatchProvider[]
  buy: WatchProvider[]
}

export interface TitleDetail extends TitleSummary {
  tagline?: string
  runtimeMin?: number
  /** Age rating for the viewer's region, e.g. "PG-13" or "TV-14" */
  certification?: string
  /** Directors (movies) or creators (series) */
  makers: string[]
  cast: CastMember[]
  /** Best trailer first */
  videos: Video[]
  /** Series only, specials (season 0) excluded */
  seasons: SeasonSummary[]
  watch?: WatchAvailability
  /** Public TMDB page for sharing / attribution */
  sourcePage: string
}

export interface SearchPage {
  items: TitleSummary[]
  total: number
  page: number
  hasMore: boolean
}
