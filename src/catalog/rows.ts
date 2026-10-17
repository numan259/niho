import type { TitleKind } from '../providers'

export type Category = 'all' | 'movies' | 'series'

/** A row backed by a set of Internet Archive collections (or the curated open movies). */
export interface RowDef {
  id: string
  title: string
  /** Archive collections; empty for the curated "open" row */
  collections: string[]
  kind?: TitleKind
  category: Exclude<Category, 'all'>
  /** Shown on kids profiles */
  kids?: boolean
  /** Shown as a genre chip in the chip bar */
  chip?: string
}

export const ROWS: RowDef[] = [
  { id: 'open', title: 'Niho Open Originals', collections: [], category: 'movies', kids: true },
  { id: 'films', title: 'Popular Classic Films', collections: ['feature_films'], category: 'movies' },
  { id: 'tv', title: 'Classic TV Series', collections: ['classic_tv'], kind: 'series', category: 'series' },
  { id: 'noir', title: 'Film Noir', collections: ['Film_Noir'], category: 'movies', chip: 'Noir' },
  { id: 'scifi', title: 'Sci‑Fi & Horror', collections: ['SciFi_Horror'], category: 'movies', chip: 'Sci‑Fi & Horror' },
  { id: 'comedy', title: 'Comedy Classics', collections: ['Comedy_Films'], category: 'movies', chip: 'Comedy' },
  { id: 'cartoons', title: 'Cartoons', collections: ['classic_cartoons'], category: 'movies', kids: true, chip: 'Cartoons' },
]

export const SEARCH_COLLECTIONS = [...new Set(ROWS.flatMap((r) => r.collections))]
export const KIDS_COLLECTIONS = [...new Set(ROWS.filter((r) => r.kids).flatMap((r) => r.collections))]

export function getRow(id: string | undefined): RowDef | undefined {
  return ROWS.find((r) => r.id === id)
}

export function rowsFor({ kids, category }: { kids: boolean; category: Category }): RowDef[] {
  return ROWS.filter((r) => (!kids || r.kids) && (category === 'all' || r.category === category))
}
