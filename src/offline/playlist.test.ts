import { expect, it } from 'vitest'
import { attributes, selectMaster, validateMedia } from './playlist'

const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="English, Stereo",LANGUAGE="en",DEFAULT=YES,URI="en/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Turkish",LANGUAGE="tr",URI="tr/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="s",NAME="English",LANGUAGE="en",URI="subs/index.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=640x360,AUDIO="a",SUBTITLES="s"
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000,RESOLUTION=1280x720,AUDIO="a",SUBTITLES="s"
medium.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4000,RESOLUTION=1920x1080,AUDIO="a",SUBTITLES="s"
high.m3u8`

it('selects up to 720p with matching audio and subtitles, preserving commas in names', () => {
  const result = selectMaster(master, 'tur', 'en-US')
  expect(result.quality).toBe('720p')
  expect(result.audio).toBe('Turkish')
  expect(result.text).toContain('medium.m3u8')
  expect(result.text).toContain('subs/index.m3u8')
  expect(result.text).not.toContain('en/index.m3u8')
  expect(result.text).not.toContain('high.m3u8')
  expect(attributes('#EXT-X-MEDIA:NAME="English, Stereo",LANGUAGE="en"').NAME).toBe('English, Stereo')
})
it('falls back to default audio and removes unavailable subtitle groups', () => {
  const result = selectMaster(master, 'ja', 'off')
  expect(result.audio).toBe('English, Stereo')
  expect(result.text).not.toContain('SUBTITLES')
})
it('accepts completed VOD with byte ranges, initialization maps, and AES keys', () => {
  expect(() => validateMedia('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2,\n#EXT-X-BYTERANGE:10@0\nmovie.mp4\n#EXT-X-ENDLIST')).not.toThrow()
})
it('rejects live, incomplete, unsupported and DRM playlists', () => {
  expect(() => validateMedia('#EXTM3U\n#EXTINF:2,\na.ts')).toThrow(/still being prepared/)
  expect(() => validateMedia('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\n#EXT-X-ENDLIST')).toThrow(/protected/)
  expect(() => selectMaster('<html>Error</html>', '', 'off')).toThrow(/playlist/)
  expect(() => selectMaster('#EXTM3U\n#EXT-X-DEFINE:NAME="a",VALUE="b"', '', 'off')).toThrow(/format/)
})
