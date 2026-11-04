import { describe, expect, it } from 'vitest'
import { buildHomePage } from './pages'

describe('buildHomePage', () => {
  it('starts with a billboard and continue-watching, then rows', () => {
    const page = buildHomePage({ profileName: 'Sam', kids: false, category: 'all' })
    expect(page[0]).toMatchObject({ variant: 'billboard' })
    expect(page[1]).toMatchObject({ variant: 'continue', title: 'Continue Watching for Sam' })
    expect(page.filter((s) => s.variant === 'carousel').length).toBeGreaterThan(4)
    expect(page.some((s) => s.variant === 'my-list')).toBe(true)
  })

  it('only shows kids rows on a kids profile', () => {
    const page = buildHomePage({ profileName: 'Kids', kids: true, category: 'all' })
    const rowIds = page.flatMap((s) => (s.variant === 'carousel' ? [s.row.id] : []))
    expect(rowIds).toEqual(['animation', 'family', 'kids-tv'])
    expect(page[0]).toMatchObject({ variant: 'billboard', row: { id: 'animation' } })
  })

  it('features trending on the unfiltered home page', () => {
    const page = buildHomePage({ profileName: 'Sam', kids: false, category: 'all' })
    expect(page[0]).toMatchObject({ variant: 'billboard', row: { id: 'trending' } })
  })

  it('filters rows by category chip and drops mixed rows', () => {
    const page = buildHomePage({ profileName: 'Sam', kids: false, category: 'series' })
    const rowIds = page.flatMap((s) => (s.variant === 'carousel' ? [s.row.id] : []))
    expect(rowIds).toEqual(['popular-tv', 'top-tv', 'crime-tv', 'kids-tv'])
    expect(page[0]).toMatchObject({ variant: 'billboard', row: { id: 'popular-tv' } })
  })
})
