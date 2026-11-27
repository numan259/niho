import { expect, it } from 'vitest'
import { DEFAULT_PLAYBACK, languageMatches } from '../state/playback'
import { rankSources } from './languages'
import type { Source } from './types'
const source = (url: string, audioLanguages?: string[], subtitleLanguages?: string[]): Source => ({ url, type: 'hls', audioLanguages, subtitleLanguages })
it('normalizes ISO aliases and regional tags', () => {
  expect(languageMatches('jpn', 'ja-JP')).toBe(true)
  expect(languageMatches('tur', 'tr_TR')).toBe(true)
  expect(languageMatches('en', 'off')).toBe(false)
})
it('ranks both, preferred single match, unknown, then mismatch and preserves ties', () => {
  const sources = [source('wrong', ['en'], []), source('unknown'), source('subtitle', ['en'], ['tr']), source('audio', ['tr'], []), source('both', ['tur'], ['tr'])]
  const prefs = { ...DEFAULT_PLAYBACK, audioLanguage: 'tr', subtitleLanguage: 'tr' }
  expect(rankSources(sources, prefs).map(s => s.url)).toEqual(['both', 'audio', 'subtitle', 'unknown', 'wrong'])
  expect(rankSources(sources, { ...prefs, languagePriority: 'subtitle' }).map(s => s.url)).toEqual(['both', 'subtitle', 'audio', 'unknown', 'wrong'])
  expect(rankSources(sources, { ...prefs, languagePriority: 'balanced' }).map(s => s.url)).toEqual(['both', 'subtitle', 'audio', 'unknown', 'wrong'])
  expect(rankSources(sources, { ...prefs, audioLanguage: '', subtitleLanguage: 'off' })).toEqual(sources)
})
