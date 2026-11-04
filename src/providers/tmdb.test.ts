import { describe, expect, it } from 'vitest'
import movieDetail from '../test/fixtures/tmdb/movie-detail.json'
import season from '../test/fixtures/tmdb/season.json'
import trending from '../test/fixtures/tmdb/trending.json'
import tvDetail from '../test/fixtures/tmdb/tv-detail.json'
import {
  buildRequest,
  detectRegion,
  imageUrl,
  listRequest,
  mapDetail,
  mapList,
  mapSeason,
  mapWatchProviders,
  mergePages,
  pickVideos,
  yearOf,
} from './tmdb'

describe('buildRequest', () => {
  it('sends a v4 read token as a Bearer header, never in the URL', () => {
    const { url, headers } = buildRequest('/movie/27205', { append_to_response: 'videos' }, 'eyJhbGciOi.token')
    expect(headers.Authorization).toBe('Bearer eyJhbGciOi.token')
    expect(url).toBe('https://api.themoviedb.org/3/movie/27205?language=en-US&append_to_response=videos')
  })

  it('sends a v3 key as the api_key query parameter', () => {
    const { url, headers } = buildRequest('/trending/all/week', { page: 2 }, 'abc123')
    expect(headers.Authorization).toBeUndefined()
    expect(new URL(url).searchParams.get('api_key')).toBe('abc123')
    expect(new URL(url).searchParams.get('page')).toBe('2')
  })

  it('skips undefined params', () => {
    const { url } = buildRequest('/search/multi', { query: 'x', page: undefined }, 'k')
    expect(new URL(url).searchParams.has('page')).toBe(false)
  })
})

describe('mapList', () => {
  const page = mapList(trending)

  it('keeps movies and series keyed by numeric TMDB id', () => {
    expect(page.items.map((t) => t.key)).toEqual(['movie/27205', 'tv/1396', 'movie/129'])
    expect(page.items[0]).toMatchObject({ id: 27205, mediaType: 'movie', name: 'Inception', year: 2010, rating: 8.4 })
    expect(page.items[1]).toMatchObject({ id: 1396, mediaType: 'tv', name: 'Breaking Bad', year: 2008 })
  })

  it('drops people, adult titles and duplicates', () => {
    expect(page.items.some((t) => t.name === 'Someone Famous' || t.name === 'Hidden Adult Title')).toBe(false)
    expect(page.items.filter((t) => t.id === 27205)).toHaveLength(1)
  })

  it('maps genres, w500 posters and original backdrops', () => {
    expect(page.items[0].tags).toEqual(['Action', 'Science Fiction', 'Adventure'])
    expect(page.items[0].poster).toBe('https://image.tmdb.org/t/p/w500/sample-inception-poster.jpg')
    expect(page.items[0].backdrop).toBe('https://image.tmdb.org/t/p/original/sample-inception-backdrop.jpg')
    expect(page.items[1].backdrop).toBeUndefined()
    expect(page.items[2].poster).toBeUndefined()
    expect(page.items[2].rating).toBeUndefined()
  })

  it('caps paging at TMDB’s 500-page limit', () => {
    expect(page.hasMore).toBe(true)
    expect(mapList({ ...trending, page: 500 }).hasMore).toBe(false)
  })

  it('uses the fallback media type for single-type lists', () => {
    const tv = mapList({ page: 1, total_pages: 1, total_results: 1, results: [{ id: 5, name: 'Show' }] }, 'tv')
    expect(tv.items[0].key).toBe('tv/5')
    expect(tv.hasMore).toBe(false)
  })
})

describe('mergePages', () => {
  it('flattens pages and drops titles repeated across pages', () => {
    const p1 = mapList(trending)
    const p2 = mapList({ ...trending, page: 2 })
    expect(mergePages([p1, p2]).map((t) => t.key)).toEqual(['movie/27205', 'tv/1396', 'movie/129'])
    expect(mergePages(undefined)).toEqual([])
  })
})

describe('pickVideos', () => {
  it('keeps YouTube only and ranks official trailers first', () => {
    const videos = pickVideos(movieDetail.videos.results)
    expect(videos.map((v) => v.key)).toEqual(['official-trailer', 'fan-trailer', 'teaser-key', 'featurette-key'])
    expect(videos[0]).toEqual({ key: 'official-trailer', name: 'Official Trailer', type: 'Trailer', official: true })
  })

  it('handles missing results', () => {
    expect(pickVideos(undefined)).toEqual([])
  })
})

describe('mapDetail', () => {
  it('maps a movie with cast, director, runtime, certification and trailers', () => {
    const t = mapDetail(movieDetail, 'movie', 'US')!
    expect(t).toMatchObject({
      key: 'movie/27205',
      id: 27205,
      runtimeMin: 148,
      certification: 'PG-13',
      makers: ['The Director'],
      tagline: 'Your mind is the scene of the crime.',
      sourcePage: 'https://www.themoviedb.org/movie/27205',
    })
    expect(t.cast.map((c) => c.name)).toEqual(['Lead Actor', 'Second Billed'])
    expect(t.cast[0].photo).toBe('https://image.tmdb.org/t/p/w185/sample-lead.jpg')
    expect(t.videos[0].key).toBe('official-trailer')
    expect(t.seasons).toEqual([])
  })

  it('falls back to the US certification for other regions', () => {
    expect(mapDetail(movieDetail, 'movie', 'PK')!.certification).toBe('PG-13')
  })

  it('maps a series with creators, ordered seasons (no specials or empty seasons)', () => {
    const t = mapDetail(tvDetail, 'tv', 'DE')!
    expect(t).toMatchObject({ key: 'tv/1396', runtimeMin: 47, certification: '16', makers: ['Show Creator'] })
    expect(t.seasons).toEqual([
      { number: 1, name: 'Season 1', episodeCount: 7, year: 2008 },
      { number: 2, name: 'Season 2', episodeCount: 13, year: 2009 },
    ])
    expect(t.watch).toBeUndefined()
  })
})

describe('mapWatchProviders', () => {
  const results = movieDetail['watch/providers'].results

  it('groups providers by stream / free / rent / buy in display order', () => {
    const w = mapWatchProviders(results, 'US')!
    expect(w.link).toContain('locale=US')
    expect(w.stream.map((p) => p.name)).toEqual(['Stream Service A', 'Stream Service B'])
    expect(w.stream[0].logo).toBe('https://image.tmdb.org/t/p/w92/logo-a.jpg')
    expect(w.free.map((p) => p.name)).toEqual(['Free With Ads'])
    expect(w.free[0].logo).toBeUndefined()
    expect(w.rent).toHaveLength(1)
    expect(w.buy).toHaveLength(1)
  })

  it('is region specific', () => {
    expect(mapWatchProviders(results, 'PK')!.stream.map((p) => p.name)).toEqual(['Stream Service A'])
    expect(mapWatchProviders(results, 'FR')).toBeUndefined()
  })
})

describe('mapSeason', () => {
  it('orders episodes and fills gaps', () => {
    const eps = mapSeason(season)
    expect(eps.map((e) => e.number)).toEqual([1, 2, 3])
    expect(eps[1]).toMatchObject({ season: 1, name: 'Second Episode', runtimeMin: 48, still: 'https://image.tmdb.org/t/p/w300/sample-s1e2.jpg' })
    expect(eps[2]).toMatchObject({ name: 'Episode 3', overview: undefined, runtimeMin: undefined })
  })
})

describe('listRequest', () => {
  it('builds trending, popular and kids-safe discover requests', () => {
    expect(listRequest({ kind: 'trending', media: 'all' }).path).toBe('/trending/all/week')
    expect(listRequest({ kind: 'top_rated', media: 'tv' }).path).toBe('/tv/top_rated')
    const kids = listRequest({ kind: 'discover', media: 'movie', genres: [16, 10751], kidsSafe: true })
    expect(kids.path).toBe('/discover/movie')
    expect(kids.params).toMatchObject({ with_genres: '16|10751', include_adult: false, 'certification.lte': 'PG' })
  })
})

describe('helpers', () => {
  it('detectRegion reads the country from the locale', () => {
    expect(detectRegion('en-PK')).toBe('PK')
    expect(detectRegion('ur_pk')).toBe('PK')
    expect(detectRegion('en')).toBe('US')
    expect(detectRegion(undefined)).toBe('US')
  })

  it('yearOf and imageUrl', () => {
    expect(yearOf('1999-03-31')).toBe(1999)
    expect(yearOf('')).toBeUndefined()
    expect(imageUrl(null, 'w500')).toBeUndefined()
  })
})
