import { describe, expect, it } from 'vitest'
import { nextEpisode } from './episodes'

const seasons = [{ number: 1, name: 'Season 1', episodeCount: 2 }, { number: 2, name: 'Season 2', episodeCount: 0 }, { number: 3, name: 'Season 3', episodeCount: 5 }]
describe('next episode', () => {
  it('advances within a season', () => expect(nextEpisode(seasons, 1, 1)).toEqual({ season: 1, episode: 2, episodeCount: 2 }))
  it('continues to the next nonempty season', () => expect(nextEpisode(seasons, 1, 2)).toEqual({ season: 3, episode: 1, episodeCount: 5 }))
  it('ends at the final episode', () => expect(nextEpisode(seasons, 3, 5)).toBeUndefined())
})
