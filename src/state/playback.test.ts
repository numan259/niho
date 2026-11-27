import { expect, it } from 'vitest'
import { DEFAULT_PLAYBACK, usePlaybackPreferences } from './playback'
import { useProfiles } from './profiles'
it('persists normalized preferences across hydration and isolates profiles', async () => {
  usePlaybackPreferences.setState({ ...DEFAULT_PLAYBACK, profiles: {} })
  useProfiles.getState().select('me')
  usePlaybackPreferences.getState().update({ audioLanguage: 'tur', subtitleLanguage: 'ja-JP', languagePriority: 'balanced' })
  useProfiles.getState().select('kids')
  expect(usePlaybackPreferences.getState().audioLanguage).toBe('en')
  usePlaybackPreferences.getState().update({ audioLanguage: 'ko' })
  await usePlaybackPreferences.persist.rehydrate()
  useProfiles.getState().select('me')
  expect(usePlaybackPreferences.getState()).toMatchObject({ audioLanguage: 'tr', subtitleLanguage: 'ja', languagePriority: 'balanced' })
  useProfiles.getState().select('kids')
  expect(usePlaybackPreferences.getState().audioLanguage).toBe('ko')
})
it('migrates legacy settings to the current profile', async () => {
  useProfiles.getState().select('me')
  localStorage.setItem('niho.playback', JSON.stringify({ version: 1, state: { audioLanguage: 'tr', subtitleLanguage: 'en' } }))
  await usePlaybackPreferences.persist.rehydrate()
  expect(usePlaybackPreferences.getState()).toMatchObject({ audioLanguage: 'tr', subtitleLanguage: 'en', languagePriority: 'audio' })
})
