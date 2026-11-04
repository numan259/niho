import type { ListSource } from '../providers/tmdb'

export type Category = 'all' | 'movies' | 'series'

/** A home-page row backed by a TMDB list. */
export interface RowDef {
  id: string
  title: string
  source: ListSource
  /** mixed rows (movies + series) only show on the unfiltered home page */
  category: 'movies' | 'series' | 'mixed'
  /** Shown on kids profiles */
  kids?: boolean
  /** Shown as a genre chip in the chip bar */
  chip?: string
}

export const ROWS: RowDef[] = [
  { id: 'trending', title: 'Trending This Week', source: { kind: 'trending', media: 'all' }, category: 'mixed' },
  { id: 'popular-movies', title: 'Popular Movies', source: { kind: 'popular', media: 'movie' }, category: 'movies' },
  { id: 'popular-tv', title: 'Popular Series', source: { kind: 'popular', media: 'tv' }, category: 'series' },
  { id: 'top-movies', title: 'Top Rated Movies', source: { kind: 'top_rated', media: 'movie' }, category: 'movies' },
  { id: 'top-tv', title: 'Top Rated Series', source: { kind: 'top_rated', media: 'tv' }, category: 'series' },
  { id: 'action', title: 'Action & Adventure', source: { kind: 'discover', media: 'movie', genres: [28, 12] }, category: 'movies', chip: 'Action' },
  { id: 'comedy', title: 'Comedies', source: { kind: 'discover', media: 'movie', genres: [35] }, category: 'movies', chip: 'Comedy' },
  { id: 'scifi', title: 'Sci‑Fi & Fantasy', source: { kind: 'discover', media: 'movie', genres: [878, 14] }, category: 'movies', chip: 'Sci‑Fi' },
  { id: 'horror', title: 'Horror', source: { kind: 'discover', media: 'movie', genres: [27] }, category: 'movies', chip: 'Horror' },
  { id: 'crime-tv', title: 'Crime Series', source: { kind: 'discover', media: 'tv', genres: [80] }, category: 'series', chip: 'Crime' },
  {
    id: 'animation',
    title: 'Animated Movies',
    source: { kind: 'discover', media: 'movie', genres: [16], kidsSafe: true },
    category: 'movies',
    kids: true,
    chip: 'Animation',
  },
  {
    id: 'family',
    title: 'Family Movies',
    source: { kind: 'discover', media: 'movie', genres: [10751], kidsSafe: true },
    category: 'movies',
    kids: true,
  },
  { id: 'kids-tv', title: 'Kids’ Series', source: { kind: 'discover', media: 'tv', genres: [10762] }, category: 'series', kids: true, chip: 'Kids' },
]

export function getRow(id: string | undefined): RowDef | undefined {
  return ROWS.find((r) => r.id === id)
}

export function rowsFor({ kids, category }: { kids: boolean; category: Category }): RowDef[] {
  return ROWS.filter((r) => {
    if (kids && !r.kids) return false
    if (category === 'all') return true
    return r.category === category
  })
}
