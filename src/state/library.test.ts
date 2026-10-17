import { describe, expect, it } from 'vitest'
import type { TitleSummary } from '../providers'
import { applyProgress, continueWatching, remainingLabel, useLibraryStore } from './library'

const title = (id: string): TitleSummary => ({
  key: `archive/${id}`,
  provider: 'archive',
  id,
  name: id,
  tags: [],
  poster: '',
  license: { url: '', kind: 'public-domain', label: 'Public domain' },
})

describe('applyProgress', () => {
  it('records partial progress for a movie', () => {
    const p = applyProgress({}, { title: title('a'), episodeIndex: 0, episodeCount: 1, position: 600.7, duration: 5400, now: 1 })
    expect(p['archive/a']).toMatchObject({ position: 600, duration: 5400, episodeIndex: 0, updatedAt: 1 })
  })

  it('removes a finished movie', () => {
    let p = applyProgress({}, { title: title('a'), episodeIndex: 0, episodeCount: 1, position: 600, duration: 5400 })
    p = applyProgress(p, { title: title('a'), episodeIndex: 0, episodeCount: 1, position: 5300, duration: 5400 })
    expect(p).toEqual({})
  })

  it('moves a finished episode on to the next one', () => {
    const p = applyProgress({}, { title: title('s'), episodeIndex: 2, episodeCount: 10, position: 1500, duration: 1550 })
    expect(p['archive/s']).toMatchObject({ episodeIndex: 3, position: 0, upNext: true })
  })

  it('drops a series after its last episode', () => {
    const p = applyProgress({}, { title: title('s'), episodeIndex: 9, episodeCount: 10, position: 1549, duration: 1550 })
    expect(p).toEqual({})
  })
})

describe('continueWatching', () => {
  it('lists resumable entries newest first and hides barely-started ones', () => {
    let p = applyProgress({}, { title: title('old'), episodeIndex: 0, episodeCount: 1, position: 100, duration: 1000, now: 1 })
    p = applyProgress(p, { title: title('new'), episodeIndex: 0, episodeCount: 1, position: 100, duration: 1000, now: 2 })
    p = applyProgress(p, { title: title('tiny'), episodeIndex: 0, episodeCount: 1, position: 5, duration: 1000, now: 3 })
    p = applyProgress(p, { title: title('next'), episodeIndex: 0, episodeCount: 4, position: 999, duration: 1000, now: 0 })
    expect(continueWatching(p).map((e) => e.title.id)).toEqual(['new', 'old', 'next'])
  })
})

describe('remainingLabel', () => {
  it('formats minutes and hours', () => {
    const base = { title: title('a'), episodeIndex: 0, episodeCount: 1, updatedAt: 0 }
    expect(remainingLabel({ ...base, position: 0, duration: 22 * 60 })).toBe('22 min left')
    expect(remainingLabel({ ...base, position: 0, duration: 61 * 60 })).toBe('1 h 1 min left')
    expect(remainingLabel({ ...base, position: 0, duration: 0, upNext: true })).toBe('Next episode')
  })
})

describe('library store', () => {
  it('keeps each profile separate', () => {
    const s = useLibraryStore.getState()
    s.toggleMyList('p1', title('a'))
    s.toggleMyList('p2', title('b'))
    s.toggleMyList('p1', title('c'))
    const libs = useLibraryStore.getState().libraries
    expect(libs.p1.myList.map((t) => t.id)).toEqual(['c', 'a'])
    expect(libs.p2.myList.map((t) => t.id)).toEqual(['b'])

    useLibraryStore.getState().toggleMyList('p1', title('a'))
    expect(useLibraryStore.getState().libraries.p1.myList.map((t) => t.id)).toEqual(['c'])
  })
})
