import { describe, expect, it } from 'vitest'
import movieFixture from '../test/fixtures/metadata-movie.json'
import seriesFixture from '../test/fixtures/metadata-series.json'
import searchFixture from '../test/fixtures/search-noir.json'
import {
  buildEpisodes,
  buildSearchUrl,
  cleanEpisodeName,
  cleanText,
  mapMetadata,
  mapSearchDoc,
  parseDuration,
  parseTags,
  sanitizeText,
  variantKey,
} from './archive'

describe('buildSearchUrl', () => {
  it('always restricts to the given collections, video items and PD/CC licenses', () => {
    const url = new URL(buildSearchUrl({ collections: ['Film_Noir'], rows: 10, page: 2 }))
    const q = url.searchParams.get('q')!
    expect(q).toContain('collection:(Film_Noir)')
    expect(q).toContain('mediatype:(movies)')
    expect(q).toContain('licenseurl:(*publicdomain* OR *creativecommons.org*)')
    expect(url.searchParams.get('rows')).toBe('10')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.getAll('sort[]')).toEqual(['downloads desc'])
  })

  it('cannot be escaped by user text', () => {
    const q = new URL(buildSearchUrl({ collections: ['feature_films'], text: 'noir) OR (licenseurl:*' })).searchParams.get('q')!
    expect(q.startsWith('(noir AND licenseurl) AND collection:')).toBe(true)
  })
})

describe('sanitizeText', () => {
  it('drops Lucene operators and syntax', () => {
    expect(sanitizeText('  night "of the" living-dead OR zombies*  ')).toEqual(['night', 'of', 'the', 'living', 'dead', 'zombies'])
  })
})

describe('mapSearchDoc', () => {
  it('maps every licensed doc in a real search response', () => {
    const items = searchFixture.response.docs.map((d) => mapSearchDoc(d))
    expect(items.every((i) => i !== null)).toBe(true)
    const first = items[0]!
    expect(first.key).toBe(`archive/${first.id}`)
    expect(first.poster).toBe(`https://archive.org/services/img/${first.id}`)
    expect(first.year).toBeGreaterThan(1900)
    expect(first.license.kind).toBe('public-domain')
  })

  it('drops items without a recognised license', () => {
    expect(mapSearchDoc({ identifier: 'x', title: 'X', licenseurl: 'All rights reserved' })).toBeNull()
    expect(mapSearchDoc({ identifier: 'x', title: 'X' })).toBeNull()
  })
})

describe('mapMetadata', () => {
  it('maps a film to a single-episode movie and picks the best encoding first', () => {
    const t = mapMetadata(movieFixture)!
    expect(t.kind).toBe('movie')
    expect(t.name).toBe('His Girl Friday')
    expect(t.year).toBe(1940)
    expect(t.tags).toEqual(['Romance', 'Comedy'])
    expect(t.episodes).toHaveLength(1)
    expect(t.episodes[0].sources.map((s) => s.quality)).toEqual(['Original', 'Low'])
    expect(t.episodes[0].sources[0].url).toBe('https://archive.org/download/his_girl_friday/his_girl_friday.mp4')
    expect(t.backdrop).toMatch(/his_girl_friday\.thumbs\/.+\.jpg$/)
    expect(t.sourcePage).toBe('https://archive.org/details/his_girl_friday')
  })

  it('maps a multi-file item to an ordered series with season/episode numbers', () => {
    const t = mapMetadata(seriesFixture)!
    expect(t.kind).toBe('series')
    expect(t.episodes.length).toBeGreaterThan(1)
    expect(t.episodes[0]).toMatchObject({ index: 0, season: 1, number: 19, name: 'Episode 19' })
    expect(t.episodes[1]).toMatchObject({ index: 1, season: 1, number: 20 })
    expect(t.episodes[0].durationSec).toBe(2896)
    expect(t.episodes[0].sources[0].url).toBe('https://archive.org/download/Bonanza_pd/Bonanza%20s01e19.mp4')
  })

  it('returns null for unlicensed items', () => {
    expect(mapMetadata({ metadata: { identifier: 'x', licenseurl: '' }, files: [] })).toBeNull()
  })
})

describe('buildEpisodes', () => {
  it('treats resolution / audio variants as quality options, not episodes', () => {
    const eps = buildEpisodes('Tears-of-Steel', [
      { name: 'tears_of_steel_1080p.mp4', format: 'h.264' },
      { name: 'tears_of_steel_720p.mp4', format: 'h.264' },
    ])
    expect(eps).toHaveLength(1)
    expect(eps[0].sources.map((s) => s.quality)).toEqual(['1080p', '720p'])

    const sintel = buildEpisodes('Sintel', [
      { name: 'sintel-2048-stereo.mp4', format: 'MPEG4' },
      { name: 'sintel-2048-surround.mp4', format: 'MPEG4' },
      { name: 'sintel-2048-stereo_512kb.mp4', format: '512Kb MPEG4' },
    ])
    expect(sintel).toHaveLength(1)
  })

  it('orders episodes naturally (2 before 10) and ignores unplayable formats', () => {
    const eps = buildEpisodes('show', [
      { name: 'Show 10.mp4', format: 'MPEG4' },
      { name: 'Show 2.mp4', format: 'MPEG4' },
      { name: 'Show 2.ogv', format: 'Ogg Video' },
      { name: 'Show 3.mpeg', format: 'MPEG2' },
    ])
    expect(eps.map((e) => e.name)).toEqual(['Show 2', 'Show 10'])
  })

  it('variantKey keeps episode numbers', () => {
    expect(variantKey('Bonanza s01e19.mp4')).not.toBe(variantKey('Bonanza s01e20.mp4'))
    expect(variantKey('ed_hd.mp4')).toBe(variantKey('ed_1024.mp4'))
  })
})

describe('cleanEpisodeName', () => {
  it.each([
    ['Bonanza s01e19', 'Bonanza public domain episodes', 19, 'Episode 19'],
    ['Sherlock Holmes 01 The Case of the Cunningham Heritage', 'The Adventures of Sherlock Holmes (1954)', 1, 'The Case of the Cunningham Heritage'],
    ['Lone Ranger - 05 - The Legion of Old Timers', 'The Lone Ranger TV Show', 5, 'The Legion of Old Timers'],
    ['Pilot', 'Some Show', 1, 'Pilot'],
  ])('%s → %s', (name, series, num, expected) => {
    expect(cleanEpisodeName(name, series, num)).toBe(expected)
  })
})

describe('helpers', () => {
  it('parseDuration handles seconds and clock time', () => {
    expect(parseDuration('2896.11')).toBe(2896)
    expect(parseDuration('1:31:44')).toBe(5504)
    expect(parseDuration('nope')).toBeUndefined()
  })

  it('parseTags splits, dedupes and capitalises', () => {
    expect(parseTags('film noir; Crime;crime')).toEqual(['Film noir', 'Crime'])
    expect(parseTags(['Horror', 'sci-fi'])).toEqual(['Horror', 'Sci-fi'])
  })

  it('cleanText strips HTML from descriptions', () => {
    expect(cleanText('A <b>great</b> film<br/>Tom &amp; Jerry')).toBe('A great film\nTom & Jerry')
  })
})
