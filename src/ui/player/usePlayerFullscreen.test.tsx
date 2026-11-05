import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePlayerFullscreen } from './usePlayerFullscreen'

const native = vi.hoisted(() => ({
  lock: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue(undefined),
  hide: vi.fn().mockResolvedValue(undefined),
  show: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../native', () => ({ isNative: true }))
vi.mock('@capacitor/core', () => ({ SystemBars: { hide: native.hide, show: native.show } }))
vi.mock('@capacitor/screen-orientation', () => ({ ScreenOrientation: { lock: native.lock, unlock: native.unlock } }))
afterEach(() => vi.clearAllMocks())

it('rotates native fullscreen, hides system bars, and restores them on Android Back', async () => {
  const { result } = renderHook(() => usePlayerFullscreen({ current: null }, { current: null }))
  await act(async () => { await result.current.toggleFullscreen() })
  expect(result.current.fullscreen).toBe(true)
  expect(native.lock).toHaveBeenCalledWith({ orientation: 'landscape' })
  expect(native.hide).toHaveBeenCalledOnce()
  const back = new Event('niho:exit-fullscreen', { cancelable: true })
  await act(async () => { window.dispatchEvent(back) })
  expect(back.defaultPrevented).toBe(true)
  expect(result.current.fullscreen).toBe(false)
  expect(native.unlock).toHaveBeenCalledOnce()
  expect(native.show).toHaveBeenCalledOnce()
})

it('restores orientation and bars when navigating away during native fullscreen', async () => {
  const { result, unmount } = renderHook(() => usePlayerFullscreen({ current: null }, { current: null }))
  await act(async () => { await result.current.toggleFullscreen() })
  await act(async () => { unmount() })
  expect(native.unlock).toHaveBeenCalledOnce()
  expect(native.show).toHaveBeenCalledOnce()
})
