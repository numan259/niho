import { rowsFor, type Category, type RowDef } from './rows'

/**
 * Server-driven-style page description: a page is an ordered list of sections,
 * each with a `variant` that decides which component renders it.
 * Today it is built on the client; a backend could return the same JSON.
 */
export type Section =
  | { id: string; variant: 'billboard'; row: RowDef }
  | { id: string; variant: 'continue'; title: string }
  | { id: string; variant: 'my-list'; title: string }
  | { id: string; variant: 'carousel'; row: RowDef }

export interface PageContext {
  profileName: string
  kids: boolean
  category: Category
}

export function buildHomePage({ profileName, kids, category }: PageContext): Section[] {
  const rows = rowsFor({ kids, category })
  if (rows.length === 0) return []
  const featured = kids ? rows[0] : (rows.find((r) => r.id === (category === 'series' ? 'tv' : 'open')) ?? rows[0])

  const sections: Section[] = [{ id: 'billboard', variant: 'billboard', row: featured }]
  sections.push({ id: 'continue', variant: 'continue', title: `Continue Watching for ${profileName}` })
  rows.forEach((row, i) => {
    sections.push({ id: row.id, variant: 'carousel', row })
    if (i === 1) sections.push({ id: 'my-list', variant: 'my-list', title: 'My List' })
  })
  if (rows.length < 2) sections.push({ id: 'my-list', variant: 'my-list', title: 'My List' })
  return sections
}
