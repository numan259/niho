import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubtitleOverlay } from './SubtitleOverlay'

function fixture() {
  const cue = { id: '1', startTime: 0, getCueAsHTML: () => {
    const fragment = document.createDocumentFragment()
    const italic = document.createElement('i')
    italic.textContent = 'coffee'
    fragment.append('Your ', italic, '.')
    return fragment
  } }
  const english = Object.assign(new EventTarget(), { kind: 'subtitles', mode: 'showing', activeCues: [cue] })
  const turkish = Object.assign(new EventTarget(), { kind: 'subtitles', mode: 'disabled', activeCues: [{ ...cue, getCueAsHTML: () => {
    const fragment = document.createDocumentFragment()
    fragment.append('Kahveniz.')
    return fragment
  } }] })
  const tracks = Object.assign(new EventTarget(), { [Symbol.iterator]: function* () { yield english; yield turkish } })
  const video = document.createElement('video')
  Object.defineProperty(video, 'textTracks', { value: tracks })
  const view = render(<SubtitleOverlay video={{ current: video }} controlsVisible={false} hidden={false} />)
  return { ...view, english, turkish, tracks, video }
}

describe('subtitle presentation', () => {
  it('renders active cues with formatting and suppresses duplicate browser captions', () => {
    const { container, english } = fixture()
    expect(container).toHaveTextContent('Your coffee.')
    expect(container.querySelector('i')).toHaveTextContent('coffee')
    expect(english.mode).toBe('hidden')
  })

  it('updates immediately when changing language, disabling subtitles, and ending a cue', () => {
    const { container, english, turkish, tracks } = fixture()
    act(() => {
      english.mode = 'disabled'
      turkish.mode = 'showing'
      tracks.dispatchEvent(new Event('change'))
    })
    expect(container).toHaveTextContent('Kahveniz.')
    expect(container).not.toHaveTextContent('coffee')
    act(() => {
      turkish.activeCues = []
      turkish.dispatchEvent(new Event('cuechange'))
    })
    expect(container.querySelector('.player__subtitle-frame')).not.toBeVisible()
    act(() => {
      english.mode = 'showing'
      tracks.dispatchEvent(new Event('change'))
    })
    expect(container).toHaveTextContent('Your coffee.')
    act(() => {
      english.mode = 'disabled'
      turkish.mode = 'disabled'
      tracks.dispatchEvent(new Event('change'))
    })
    expect(container.querySelector('.player__subtitle-frame')).not.toBeVisible()
  })

  it('hands captions back to the browser during native video fullscreen', () => {
    const { container, english, video } = fixture()
    act(() => { video.dispatchEvent(new Event('webkitbeginfullscreen')) })
    expect(english.mode).toBe('showing')
    expect(container.querySelector('.player__subtitle-frame')).not.toBeVisible()
    act(() => { video.dispatchEvent(new Event('webkitendfullscreen')) })
    expect(english.mode).toBe('hidden')
    expect(container.querySelector('.player__subtitle-frame')).toBeVisible()
  })
})
