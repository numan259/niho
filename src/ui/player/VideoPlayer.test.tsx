import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { VideoPlayer } from './VideoPlayer'
import { DEFAULT_PLAYBACK, usePlaybackPreferences } from '../../state/playback'

const orientation = vi.hoisted(() => ({ lock: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@capacitor/screen-orientation', () => ({ ScreenOrientation: orientation }))
vi.mock('../../native', () => ({ isNative: false }))

let paused: boolean
let media: HTMLVideoElement
let region: HTMLElement
let fullscreenElement: Element | null
const unlock = vi.fn()
let onProgress: Mock<(position: number, duration: number) => void>
let onNext: Mock<() => void>
let unmountPlayer: () => void

beforeEach(() => {
  usePlaybackPreferences.setState(DEFAULT_PLAYBACK)
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.useFakeTimers()
  paused = true
  fullscreenElement = null
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    paused = false
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    paused = true
    this.dispatchEvent(new Event('pause'))
  })
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused)
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(120)
  vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(Object.assign(new EventTarget(), {
    [Symbol.iterator]: function* () {},
  }) as unknown as TextTrackList)
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })
  Object.defineProperty(window.screen, 'orientation', { configurable: true, value: { unlock } })
  onProgress = vi.fn()
  onNext = vi.fn()
  const result = render(<VideoPlayer sources={[{ type: 'mp4', url: '/test.mp4' }]} title="Test movie" onBack={vi.fn()} onProgress={onProgress} onEnded={vi.fn()} next={{ label: 'Next episode', onSelect: onNext }} />)
  unmountPlayer = result.unmount
  media = result.container.querySelector('video')!
  region = screen.getByRole('region')
  vi.spyOn(region, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 } as DOMRect)
  fireEvent.loadedMetadata(media)
  fireEvent.playing(media)
  media.currentTime = 50
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('stream player interaction', () => {
  it('reveals hidden controls on a single tap without pausing or seeking', () => {
    act(() => vi.advanceTimersByTime(3000))
    expect(region).not.toHaveClass('player--controls')
    expect(region.querySelector('.player__center')).toHaveAttribute('inert')
    fireEvent.click(media, { clientX: 500 })
    expect(region).toHaveClass('player--controls')
    expect(media.pause).not.toHaveBeenCalled()
    expect(media.currentTime).toBe(50)
  })

  it('only pauses from the center play/pause control', () => {
    expect(screen.getAllByRole('button', { name: 'Pause' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Back 10 seconds' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(media.pause).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(paused).toBe(false)
  })

  it.each([false, true])('toggles every control on picture taps while paused=%s', (pauseFirst) => {
    if (pauseFirst) fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(media, { clientX: 500 })
    expect(region).not.toHaveClass('player--controls')
    expect(region.querySelector('.player__center')).toHaveAttribute('inert')
    expect(region.querySelector('.player__bottom')).toHaveAttribute('inert')
    act(() => vi.advanceTimersByTime(4000))
    expect(region).not.toHaveClass('player--controls')
    fireEvent.click(media, { clientX: 500 })
    expect(region).toHaveClass('player--controls')
    expect(paused).toBe(pauseFirst)
    expect(media.currentTime).toBe(50)
  })

  it('seeks ten seconds on double taps on each side, without pausing', () => {
    fireEvent.click(media, { clientX: 850 })
    fireEvent.click(media, { clientX: 850 })
    expect(media.currentTime).toBe(60)
    expect(screen.getByRole('status')).toHaveTextContent('+10 seconds')
    fireEvent.click(media, { clientX: 150 })
    fireEvent.click(media, { clientX: 150 })
    expect(media.currentTime).toBe(50)
    expect(screen.getByRole('status')).toHaveTextContent('\u221210 seconds')
    expect(media.pause).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(700))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not combine opposite-side taps or separate single taps', () => {
    fireEvent.click(media, { clientX: 150 })
    fireEvent.click(media, { clientX: 850 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(media, { clientX: 850 })
    expect(media.currentTime).toBe(50)
  })

  it('double taps in the middle pause and resume without seeking', () => {
    fireEvent.click(media, { clientX: 500 })
    expect(paused).toBe(false)
    fireEvent.click(media, { clientX: 500 })
    expect(paused).toBe(true)
    fireEvent.click(media, { clientX: 500 })
    fireEvent.click(media, { clientX: 500 })
    expect(paused).toBe(false)
    expect(media.currentTime).toBe(50)
  })

  it('a double tap directly on the play button toggles only once', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }), { detail: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Play' }), { detail: 2 })
    expect(paused).toBe(true)
    act(() => vi.advanceTimersByTime(400))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }), { detail: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }), { detail: 2 })
    expect(paused).toBe(false)
  })

  it('keeps seeking within the video duration and preserves keyboard seeking', () => {
    media.currentTime = 4
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(media.currentTime).toBe(0)
    media.currentTime = 116
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(media.currentTime).toBe(120)
  })

  it('requests landscape after entering fullscreen and unlocks on exit', async () => {
    Object.defineProperty(region, 'requestFullscreen', { configurable: true, value: vi.fn(async () => {
      fullscreenElement = region
      document.dispatchEvent(new Event('fullscreenchange'))
    }) })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn(async () => {
      fullscreenElement = null
      document.dispatchEvent(new Event('fullscreenchange'))
    }) })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Full screen' })))
    expect(orientation.lock).toHaveBeenCalledWith({ orientation: 'landscape' })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' })))
    expect(unlock).toHaveBeenCalled()
  })

  it('saves the last position when unmounting and when the page is hidden', () => {
    media.currentTime = 61
    fireEvent(window, new Event('pagehide'))
    expect(onProgress).toHaveBeenLastCalledWith(61, 120)
    media.currentTime = 62
    unmountPlayer()
    expect(onProgress).toHaveBeenLastCalledWith(62, 120)
  })

  it('holding the picture boosts speed and releasing restores it without a tap', () => {
    media.playbackRate = 1.25
    fireEvent.pointerDown(media, { button: 0, clientX: 150, clientY: 150 })
    act(() => vi.advanceTimersByTime(500))
    expect(media.playbackRate).toBe(2)
    expect(screen.getByText(/2× speed/)).toBeVisible()
    fireEvent.pointerUp(region)
    fireEvent.click(media, { clientX: 150 })
    expect(media.playbackRate).toBe(1.25)
    expect(media.currentTime).toBe(50)
    expect(paused).toBe(false)
    expect(region).toHaveClass('player--controls')
  })

  it('cancels a speed hold when the pointer moves, is cancelled, or the window blurs', () => {
    fireEvent.pointerDown(media, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(region, { clientX: 160, clientY: 100 })
    act(() => vi.advanceTimersByTime(500))
    expect(media.playbackRate).toBe(1)
    fireEvent.pointerDown(media, { button: 0 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.pointerCancel(region)
    expect(media.playbackRate).toBe(1)
    fireEvent.pointerDown(media, { button: 0 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.blur(window)
    expect(media.playbackRate).toBe(1)
  })

  it('locks gestures until the unlock confirmation is tapped', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Lock controls' }))
    fireEvent.click(media, { clientX: 150 })
    fireEvent.click(media, { clientX: 150 })
    fireEvent.keyDown(region, { key: ' ' })
    fireEvent.pointerDown(media, { button: 0 })
    act(() => vi.advanceTimersByTime(500))
    expect(media.currentTime).toBe(50)
    expect(media.playbackRate).toBe(1)
    expect(paused).toBe(false)
    expect(region).not.toHaveClass('player--controls')
    fireEvent.click(screen.getByRole('button', { name: 'Unlock controls' }))
    expect(region).not.toHaveClass('player--controls')
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to unlock' }))
    expect(region).toHaveClass('player--controls')
  })

  it('autoplays after ten seconds and allows cancellation', () => {
    fireEvent.ended(media)
    expect(onNext).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(9000))
    expect(screen.getByText('Next episode in 1 second')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel autoplay' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(onNext).not.toHaveBeenCalled()
    fireEvent.play(media)
    fireEvent.ended(media)
    act(() => vi.advanceTimersByTime(10000))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('does not advance when autoplay is disabled', () => {
    act(() => usePlaybackPreferences.getState().update({ autoplay: false }))
    fireEvent.ended(media)
    act(() => vi.advanceTimersByTime(15000))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('provides retry after a media error and keeps the playback position', () => {
    fireEvent.error(media)
    expect(screen.getByRole('alert')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry playback' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    media.currentTime = 0
    fireEvent.loadedMetadata(media)
    expect(media.currentTime).toBe(50)
  })
})
