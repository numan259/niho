import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useExternalSubtitles } from './useExternalSubtitles'

const english = { url: 'https://cinepro.example/en', label: 'English', language: 'en', format: 'vtt' as const }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLTrackElement.prototype, 'track') })

it('loads selected captions, clears them on Off, and revokes old URLs on source switching', async () => {
  const video = { current: document.createElement('video') }
  const tracks = new WeakMap<HTMLTrackElement, {mode: string}>()
  Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: function (this: HTMLTrackElement) {
    if (!tracks.has(this)) tracks.set(this, {mode: 'disabled'})
    return tracks.get(this) as TextTrack
  } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, text: async () => 'WEBVTT\n\n00:01.000 --> 00:02.000\nHello'}))
  const create = vi.fn().mockReturnValue('blob:subtitles')
  const revoke = vi.fn()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
  const { rerender, unmount } = renderHook(({track, source}: {track: typeof english | undefined; source: string}) => useExternalSubtitles(video, track, source), {initialProps: {track: english as typeof english | undefined, source: 'one'}})
  await waitFor(() => expect(video.current.querySelector('track')).not.toBeNull())
  expect(video.current.querySelector('track')!.track.mode).toBe('hidden')
  rerender({track: undefined, source: 'one'})
  expect(video.current.querySelector('track')).toBeNull()
  expect(revoke).toHaveBeenCalledWith('blob:subtitles')
  rerender({track: english, source: 'two'})
  await waitFor(() => expect(video.current.querySelector('track')).not.toBeNull())
  unmount()
  expect(video.current.querySelector('track')).toBeNull()
})

it('reports a subtitle failure without failing the video', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false}))
  const video = {current: document.createElement('video')}
  const {result} = renderHook(() => useExternalSubtitles(video, english, 'one'))
  await waitFor(() => expect(result.current).toMatch(/could not be loaded/))
})

it('ignores a pending subtitle response after switching Off', async () => {
  let resolve!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r })))
  const video = { current: document.createElement('video') }
  const {rerender} = renderHook(({track}: {track: typeof english | undefined}) => useExternalSubtitles(video, track, 'one'), {initialProps: {track: english as typeof english | undefined}})
  rerender({track: undefined})
  await act(async () => resolve({ok: true, text: async () => 'WEBVTT\n\n'}))
  expect(video.current.querySelector('track')).toBeNull()
})
