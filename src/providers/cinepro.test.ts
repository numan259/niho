import { afterEach, expect, it, vi } from 'vitest'
import { getCineProSources, parseCineProSources } from './cinepro'
import { DEFAULT_PLAYBACK } from '../state/playback'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('keeps the legacy URL unchanged by default', async () => {
  vi.stubEnv('VITE_CINEPRO_SOURCES_URL', '')
  vi.stubEnv('VITE_CINEPRO_LANGUAGE_PARAMS', 'false')
  expect((await getCineProSources('movie', 1))[0].url).toMatch(/\/streams\/movie\/1\/master.m3u8$/)
})
it('passes preferences and ranks a mocked provider response', async () => {
  vi.stubEnv('VITE_CINEPRO_SOURCES_URL', 'https://cinepro.example/sources')
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sources: [
    { url: 'https://example.com/en.m3u8', type: 'hls', audioLanguages: ['en'] },
    { url: 'https://example.com/tr.m3u8', type: 'hls', audioLanguages: ['tur'] },
  ] }) })
  vi.stubGlobal('fetch', fetcher)
  const result = await getCineProSources('tv', 1, 2, 3, undefined, { ...DEFAULT_PLAYBACK, audioLanguage: 'tr' })
  expect(result[0].url).toContain('/tr.m3u8')
  expect(String(fetcher.mock.calls[0][0])).toContain('preferredAudioLanguage=tr')
})
it('falls back when the optional endpoint is unavailable', async () => {
  vi.stubEnv('VITE_CINEPRO_SOURCES_URL', 'https://cinepro.example/sources')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  expect((await getCineProSources('movie', 1))[0].url).toContain('/streams/movie/1/master.m3u8')
})

it('preserves multiple providers and variants while rejecting invalid and duplicate URLs', () => {
  const one = { url: 'https://cinepro.example/play/a', type: 'hls', provider: 'Provider A', quality: 'Auto' }
  const two = { url: 'https://cinepro.example/play/b', type: 'mp4', provider: 'Provider B', quality: '720p' }
  const variant = { ...two, url: 'https://cinepro.example/play/b1080', quality: '1080p' }
  const sources = parseCineProSources({ sources: [one, two, variant, one, null, { url: 'https://', type: 'hls' }, { url: '/relative.m3u8', type: 'hls' }, { url: 'https://example.com/embed', type: 'iframe' }] })
  expect(sources.map(s => [s.provider, s.quality])).toEqual([['Provider A', 'Auto'], ['Provider B', '720p'], ['Provider B', '1080p']])
})

it('does not invent languages from labels or malformed metadata', () => {
  expect(parseCineProSources({ sources: [{ url: 'https://example.com/a', type: 'hls', provider: 'Turkish Provider', audioLanguages: 'tr', subtitleLanguages: [] }] })[0]).toMatchObject({ audioLanguages: undefined, subtitleLanguages: [] })
  expect(parseCineProSources({ sources: 'invalid' })).toEqual([])
})

it('propagates cancellation instead of starting a legacy stream', async () => {
  vi.stubEnv('VITE_CINEPRO_SOURCES_URL', 'https://cinepro.example/sources')
  const controller = new AbortController()
  controller.abort()
  await expect(getCineProSources('movie', 1, undefined, undefined, controller.signal)).rejects.toThrow()
})


it('retains valid external subtitle tracks and rejects duplicates and unsafe URLs', () => {
  const track = { url: 'https://cinepro.example/sub', format: 'vtt', label: 'English', language: 'en' }
  const [source] = parseCineProSources({ sources: [{ url: 'https://cinepro.example/play', type: 'hls', subtitles: [track, track, {...track, url: 'javascript:alert(1)'}, {...track, url: 'https://other.example/sub', format: 'ass'}] }] })
  expect(source.subtitles).toEqual([track])
})
