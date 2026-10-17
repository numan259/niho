export type LicenseKind = 'public-domain' | 'cc-by' | 'cc-by-sa' | 'cc-other'

export interface License {
  url: string
  kind: LicenseKind
  /** Short human label, e.g. "Public domain" or "CC BY 3.0" */
  label: string
}

export interface Source {
  url: string
  type: 'mp4' | 'hls'
  /** Optional label shown in the quality menu, e.g. "720p" or "Low" */
  quality?: string
}

export interface Episode {
  /** Position in the episode list (0-based) */
  index: number
  name: string
  season?: number
  number?: number
  durationSec?: number
  sources: Source[]
}

export type Provider = 'archive' | 'open'
export type TitleKind = 'movie' | 'series'

/** Light-weight title as returned by catalogue/search calls. */
export interface TitleSummary {
  /** Stable unique key: `${provider}/${id}` */
  key: string
  provider: Provider
  id: string
  name: string
  kind?: TitleKind
  year?: number
  synopsis?: string
  tags: string[]
  poster: string
  backdrop?: string
  license: License
}

/** Full title with playable episodes (a movie has exactly one). */
export interface TitleDetail extends TitleSummary {
  kind: TitleKind
  episodes: Episode[]
  sourcePage: string
  credit?: string
}

export interface SearchPage {
  items: TitleSummary[]
  total: number
  page: number
  hasMore: boolean
}
