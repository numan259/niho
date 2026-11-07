import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { persistStorage } from './storage'

export type SubtitleSize = 'small' | 'medium' | 'large'
interface PlaybackPreferences {
  audioLanguage: string
  subtitleLanguage: string
  subtitleSize: SubtitleSize
  autoplay: boolean
}
export const DEFAULT_PLAYBACK: PlaybackPreferences = {
  audioLanguage: 'en', subtitleLanguage: 'off', subtitleSize: 'medium', autoplay: true,
}
export const usePlaybackPreferences = create<PlaybackPreferences & { update: (patch: Partial<PlaybackPreferences>) => void }>()(
  persist((set) => ({ ...DEFAULT_PLAYBACK, update: (patch) => set(patch) }), {
    name: 'niho.playback', storage: persistStorage, version: 1,
  }),
)

export function languageMatches(language: string | undefined, preference: string) {
  if (!language || !preference || preference === 'off') return false
  const normalize = (value: string) => {
    const code = value.toLowerCase().split(/[-_]/)[0]
    return ({ eng: 'en', tur: 'tr', spa: 'es', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de' } as Record<string, string>)[code] ?? code
  }
  return normalize(language) === normalize(preference)
}
