import { describe, expect, it } from 'vitest'
import { isHlsSource, isLocalStream, usesNativePlayer } from './routing'

describe('player routing', () => {
  it('sends TMDB YouTube trailers to the YouTube stage', () => {
    expect(usesNativePlayer({ url: 'dQw4w9WgXcQ', type: 'youtube' })).toBe(false)
  })

  it('always plays local media server URLs natively, even if mislabelled', () => {
    expect(usesNativePlayer({ url: 'http://localhost:8096/videos/1/master.m3u8', type: 'youtube' })).toBe(true)
    expect(usesNativePlayer({ url: 'http://127.0.0.1:8080/movie.mp4', type: 'mp4' })).toBe(true)
  })

  it('plays any direct stream natively', () => {
    expect(usesNativePlayer({ url: 'https://cdn.example.com/a.mp4', type: 'mp4' })).toBe(true)
    expect(usesNativePlayer(undefined)).toBe(true)
  })

  it('recognises local hosts precisely', () => {
    expect(isLocalStream('http://localhost')).toBe(true)
    expect(isLocalStream('http://localhost:3000/x')).toBe(true)
    expect(isLocalStream('http://localhost.evil.com/x')).toBe(false)
    expect(isLocalStream('https://example.com/?u=http://localhost')).toBe(false)
  })

  it('detects HLS by type or .m3u8 path', () => {
    expect(isHlsSource({ url: 'http://localhost:8096/a/master.m3u8?token=1', type: 'mp4' })).toBe(true)
    expect(isHlsSource({ url: 'https://x/y', type: 'hls' })).toBe(true)
    expect(isHlsSource({ url: 'https://x/y.mp4', type: 'mp4' })).toBe(false)
  })
})
