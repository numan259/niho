import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest'
import { VideoPlayer } from './VideoPlayer'
import { DEFAULT_PLAYBACK, usePlaybackPreferences } from '../../state/playback'

interface EventData { fatal?: boolean; type?: string; levels?: { height: number }[] }
interface FakeStream {
  emit: (event: string, data: EventData) => void
  startLoad: Mock
  recoverMediaError: Mock
  audioTrack: number
  subtitleTrack: number
}
const state = vi.hoisted(() => ({ instances: [] as FakeStream[] }))
vi.mock('../../native', () => ({ isNative: false }))
vi.mock('hls.js', () => ({ default: class {
  static isSupported = () => true
  static Events = { AUDIO_TRACKS_UPDATED: 'audio', SUBTITLE_TRACKS_UPDATED: 'subtitles', MANIFEST_PARSED: 'manifest', ERROR: 'error' }
  static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' }
  handlers = new Map<string, (event: string, data: EventData) => void>()
  audioTracks = [{ lang: 'en', name: 'English' }, { lang: 'tr', name: 'Turkish' }]
  subtitleTracks = [{ lang: 'en', name: 'English' }, { lang: 'tr', name: 'Turkish' }]
  audioTrack = 0
  subtitleTrack = -1
  subtitleDisplay = true
  startLoad = vi.fn()
  recoverMediaError = vi.fn()
  stopLoad = vi.fn()
  destroy = vi.fn()
  loadSource = vi.fn()
  constructor() { state.instances.push(this) }
  on(event: string, handler: (event: string, data: EventData) => void) { this.handlers.set(event, handler) }
  emit(event: string, data: EventData) { this.handlers.get(event)?.(event, data) }
  attachMedia() { this.emit('manifest', { levels: [{ height: 720 }] }) }
} }))

let media: HTMLVideoElement
let paused = false
beforeEach(async () => {
  vi.useFakeTimers()
  state.instances.length = 0
  usePlaybackPreferences.setState(DEFAULT_PLAYBACK)
  paused = false
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) { paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve() })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) { paused = true; this.dispatchEvent(new Event('pause')) })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(600)
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused)
  vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(Object.assign(new EventTarget(), { [Symbol.iterator]: function* () {} }) as unknown as TextTrackList)
  await act(async () => {
    render(<VideoPlayer title="Recovery test" sources={[{ url: '/stream.m3u8', type: 'hls' }]} onProgress={vi.fn()} onBack={vi.fn()} onEnded={vi.fn()} />)
  })
  media = document.querySelector('video')!
  media.currentTime = 40
  fireEvent.playing(media)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

it('recovers network errors after playback began, then offers Retry instead of looping', () => {
  const stream = state.instances[0]
  act(() => stream.emit('error', { fatal: true, type: 'network' }))
  expect(stream.startLoad).toHaveBeenCalledWith(40)
  expect(screen.getByText('Reconnecting…')).toBeVisible()
  act(() => stream.emit('error', { fatal: true, type: 'network' }))
  act(() => stream.emit('error', { fatal: true, type: 'network' }))
  expect(stream.startLoad).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Retry playback' })).toBeVisible()
})

it('attempts media recovery once before showing an error', () => {
  const stream = state.instances[0]
  act(() => stream.emit('error', { fatal: true, type: 'media' }))
  expect(stream.recoverMediaError).toHaveBeenCalledOnce()
  act(() => stream.emit('error', { fatal: true, type: 'media' }))
  expect(screen.getByRole('alert')).toBeVisible()
})

it('detects a stalled clock and bounds automatic recovery', () => {
  const stream = state.instances[0]
  act(() => vi.advanceTimersByTime(26000))
  expect(stream.startLoad).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Retry playback' })).toBeVisible()
})

it('applies saved audio and subtitle preferences to an active stream', () => {
  const stream = state.instances[0]
  act(() => usePlaybackPreferences.getState().update({ audioLanguage: 'tr', subtitleLanguage: 'en' }))
  expect(stream.audioTrack).toBe(1)
  expect(stream.subtitleTrack).toBe(0)
  act(() => usePlaybackPreferences.getState().update({ subtitleLanguage: 'off' }))
  expect(stream.subtitleTrack).toBe(-1)
  act(() => usePlaybackPreferences.getState().update({ audioLanguage: '' }))
  expect(stream.audioTrack).toBe(0)
})

it('preserves the subtitle preference when hls.js resets its default after a track-list event', async () => {
  const stream = state.instances[0]
  await act(async () => {
    usePlaybackPreferences.getState().update({ subtitleLanguage: 'en' })
    stream.emit('subtitles', {})
    stream.subtitleTrack = -1
  })
  expect(stream.subtitleTrack).toBe(0)
})
