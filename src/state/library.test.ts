import { describe, expect, it } from 'vitest'
import type { TitleSummary } from '../providers'
import { applyProgress, continueWatching, remainingLabel, useLibraryStore } from './library'

const title = (id: number, name = `Title ${id}`): TitleSummary => ({
  key: `movie/${id}`,
  mediaType: 'movie',
  id,
  name,
  tags: [],
})

const series = (id: number): TitleSummary => ({ ...title(id), key: `tv/${id}`, mediaType: 'tv' })

describe('applyProgress', () => {
  it('records partial progress for a movie', () => {
    const p = applyProgress({}, { title: title(1), episodeIndex: 0, episodeCount: 1, position: 60.7, duration: 150, now: 1 })
    expect(p['movie/1']).toMatchObject({ position: 60, duration: 150, episodeIndex: 0, updatedAt: 1 })
  })

  it('removes a finished movie', () => {
    let p = applyProgress({}, { title: title(1), episodeIndex: 0, episodeCount: 1, position: 60, duration: 150 })
    p = applyProgress(p, { title: title(1), episodeIndex: 0, episodeCount: 1, position: 149, duration: 150 })
    expect(p).toEqual({})
  })

  it('moves a finished episode on to the next one in the same season', () => {
    const p = applyProgress({}, { title: series(7), season: 2, episodeIndex: 2, episodeCount: 10, position: 1500, duration: 1550 })
    expect(p['tv/7']).toMatchObject({ season: 2, episodeIndex: 3, position: 0, upNext: true })
  })

  it('drops a series after the last episode of the season', () => {
    const p = applyProgress({}, { title: series(7), season: 1, episodeIndex: 9, episodeCount: 10, position: 1549, duration: 1550 })
    expect(p).toEqual({})
  })

  it('queues the next season in Continue Watching when supplied', () => {
    const p = applyProgress({}, { title: series(7), season: 1, episodeIndex: 9, episodeCount: 10,
      position: 1549, duration: 1550, nextEpisode: { season: 2, episode: 1, episodeCount: 8 } })
    expect(p['tv/7']).toMatchObject({ season: 2, episodeIndex: 0, episodeCount: 8, position: 0, upNext: true })
  })

  it('stores only the summary fields of a title', () => {
    const detail = { ...title(3), cast: [{ id: 1, name: 'x' }], videos: [] } as TitleSummary
    const p = applyProgress({}, { title: detail, episodeIndex: 0, episodeCount: 1, position: 40, duration: 100 })
    expect(Object.keys(p['movie/3'].title)).not.toContain('cast')
  })
})

describe('continueWatching', () => {
  it('lists resumable entries newest first and hides barely-started ones', () => {
    let p = applyProgress({}, { title: title(1, 'old'), episodeIndex: 0, episodeCount: 1, position: 100, duration: 1000, now: 1 })
    p = applyProgress(p, { title: title(2, 'new'), episodeIndex: 0, episodeCount: 1, position: 100, duration: 1000, now: 2 })
    p = applyProgress(p, { title: title(3, 'tiny'), episodeIndex: 0, episodeCount: 1, position: 5, duration: 1000, now: 3 })
    p = applyProgress(p, { title: series(4), season: 1, episodeIndex: 0, episodeCount: 4, position: 999, duration: 1000, now: 0 })
    expect(continueWatching(p).map((e) => e.title.key)).toEqual(['movie/2', 'movie/1', 'tv/4'])
  })
})

describe('remainingLabel', () => {
  it('formats minutes and hours', () => {
    const base = { title: title(1), episodeIndex: 0, episodeCount: 1, updatedAt: 0 }
    expect(remainingLabel({ ...base, position: 0, duration: 22 * 60 })).toBe('22 min left')
    expect(remainingLabel({ ...base, position: 0, duration: 61 * 60 })).toBe('1 h 1 min left')
    expect(remainingLabel({ ...base, position: 0, duration: 0, upNext: true })).toBe('Next episode')
  })
})

describe('library store', () => {
  it('keeps each profile separate', () => {
    const s = useLibraryStore.getState()
    s.toggleMyList('p1', title(1))
    s.toggleMyList('p2', title(2))
    s.toggleMyList('p1', title(3))
    const libs = useLibraryStore.getState().libraries
    expect(libs.p1.myList.map((t) => t.id)).toEqual([3, 1])
    expect(libs.p2.myList.map((t) => t.id)).toEqual([2])

    useLibraryStore.getState().toggleMyList('p1', title(1))
    expect(useLibraryStore.getState().libraries.p1.myList.map((t) => t.id)).toEqual([3])
  })
})
