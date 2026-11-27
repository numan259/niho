import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { persistStorage } from './storage'
import { useProfiles } from './profiles'

export type SubtitleSize = 'small' | 'medium' | 'large'
export type LanguagePriority = 'audio' | 'subtitle' | 'balanced'
export interface PlaybackPreferences {
  audioLanguage: string
  subtitleLanguage: string
  languagePriority: LanguagePriority
  subtitleSize: SubtitleSize
  autoplay: boolean
}
export const DEFAULT_PLAYBACK: PlaybackPreferences = {
  audioLanguage: 'en', subtitleLanguage: 'off', languagePriority: 'audio', subtitleSize: 'medium', autoplay: true,
}
export function normalizeLanguage(value: string): string {
  const code = value.trim().toLowerCase().split(/[-_]/)[0]
  return ({ eng: 'en', tur: 'tr', spa: 'es', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de', jpn: 'ja', kor: 'ko', ara: 'ar', hin: 'hi', por: 'pt', zho: 'zh', chi: 'zh', rus: 'ru' } as Record<string, string>)[code] ?? code
}
export function languageMatches(language: string | undefined, preference: string) {
  return Boolean(language && preference && preference !== 'off' && normalizeLanguage(language) === normalizeLanguage(preference))
}
const profileId = () => useProfiles.getState().activeId ?? 'guest'
interface PlaybackState extends PlaybackPreferences {
  profiles: Record<string, PlaybackPreferences>
  update: (patch: Partial<PlaybackPreferences>) => void
}
export const usePlaybackPreferences = create<PlaybackState>()(
  persist((set, get) => ({
    ...DEFAULT_PLAYBACK, profiles: {},
    update: (patch) => {
      const current = get()
      const prefs = { ...DEFAULT_PLAYBACK, ...Object.fromEntries(Object.keys(DEFAULT_PLAYBACK).map(key => [key, current[key as keyof PlaybackPreferences]])), ...patch } as PlaybackPreferences
      prefs.audioLanguage = normalizeLanguage(prefs.audioLanguage)
      prefs.subtitleLanguage = normalizeLanguage(prefs.subtitleLanguage)
      set({ ...prefs, profiles: { ...current.profiles, [profileId()]: prefs } })
    },
  }), {
    name: 'niho.playback', storage: persistStorage, version: 2,
    partialize: (state) => ({ profiles: state.profiles }),
    migrate: (saved) => {
      const owner = useProfiles.getState().activeId ?? useProfiles.getState().profiles[0]?.id ?? 'guest'
      const prefs = { ...DEFAULT_PLAYBACK, ...(saved as Partial<PlaybackPreferences>) }
      prefs.audioLanguage = normalizeLanguage(prefs.audioLanguage)
      prefs.subtitleLanguage = normalizeLanguage(prefs.subtitleLanguage)
      return { profiles: { [owner]: prefs } }
    },
    merge: (saved, current) => {
      const profiles = (saved as { profiles?: Record<string, PlaybackPreferences> })?.profiles ?? {}
      return { ...current, profiles, ...DEFAULT_PLAYBACK, ...profiles[profileId()] }
    },
  }),
)
useProfiles.subscribe((state, previous) => {
  if (state.activeId !== previous.activeId) {
    usePlaybackPreferences.setState({ ...DEFAULT_PLAYBACK, ...usePlaybackPreferences.getState().profiles[profileId()] })
  }
})
export function getPlaybackPreferences(id: string): PlaybackPreferences {
  return { ...DEFAULT_PLAYBACK, ...usePlaybackPreferences.getState().profiles[id] }
}
