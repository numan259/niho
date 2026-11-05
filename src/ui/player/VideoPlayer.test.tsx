import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoPlayer } from './VideoPlayer'

const orientation = vi.hoisted(() => ({ lock: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@capacitor/screen-orientation', () => ({ ScreenOrientation: orientation }))
vi.mock('../../native', () => ({ isNative: false }))

let paused: boolean
let media: HTMLVideoElement
let region: HTMLElement
let fullscreenElement: Element | null
const unlock = vi.fn()

beforeEach(() => {
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
  const result = render(<VideoPlayer sources={[{ type: 'mp4', url: '/test.mp4' }]} title="Test movie" onBack={vi.fn()} onProgress={vi.fn()} onEnded={vi.fn()} />)
  media = result.container.querySelector('video')!
  region = screen.getByRole('region')
  vi.spyOn(region, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 } as DOMRect)
  fireEvent.loadedMetadata(media)
  media.currentTime = 50
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
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
})
