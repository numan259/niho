import type { Source } from './types'
import { languageMatches, normalizeLanguage, type PlaybackPreferences } from '../state/playback'

export function languageName(code: string): string {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(normalizeLanguage(code)) ?? code } catch { return code }
}
export function languageScore(source: Source, prefs: PlaybackPreferences): number {
  const audio = Boolean(prefs.audioLanguage)
  const subtitles = Boolean(prefs.subtitleLanguage && prefs.subtitleLanguage !== 'off')
  const a = audio && source.audioLanguages?.some(code => languageMatches(code, prefs.audioLanguage))
  const s = subtitles && source.subtitleLanguages?.some(code => languageMatches(code, prefs.subtitleLanguage))
  const score = (a ? (prefs.languagePriority === 'audio' ? 3 : 2) : 0) + (s ? (prefs.languagePriority === 'subtitle' ? 3 : 2) : 0)
  if (score) return score
  return (audio && source.audioLanguages === undefined) || (subtitles && source.subtitleLanguages === undefined) ? 1 : 0
}
/** Stable ties preserve backend ranking and existing quality/provider ordering. */
export function rankSources(sources: Source[], prefs: PlaybackPreferences): Source[] {
  return [...sources].sort((a, b) => languageScore(b, prefs) - languageScore(a, prefs))
}
export function sourceLanguages(source: Source): string {
  const audio = source.audioLanguages?.length ? `${source.audioLanguages.map(languageName).join(', ')} Audio` : 'Audio Unknown'
  const subtitles = source.subtitleLanguages === undefined ? 'Subtitles Unknown' : source.subtitleLanguages.length ? `Available subtitles: ${source.subtitleLanguages.map(languageName).join(', ')}` : 'No subtitles'
  return `${audio} / ${subtitles}`
}
