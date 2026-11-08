import { languageMatches } from '../state/playback'

export function attributes(line: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of line.slice(line.indexOf(':') + 1).matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    result[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  return result
}

/** Keep one video variant and its selected audio/subtitle renditions. */
export function selectMaster(text: string, audio: string, subtitles: string) {
  const lines = text.trim().split(/\r?\n/).map((line) => line.trim())
  if (lines[0] !== '#EXTM3U') throw new Error('The server did not return a video playlist.')
  if (lines.some((line) => /^#EXT-X-(SESSION-KEY|DEFINE|CONTENT-STEERING)/.test(line))) throw new Error('This stream format does not support downloads yet.')
  const variants = lines.flatMap((line, index) => line.startsWith('#EXT-X-STREAM-INF:')
    ? [{ line, uri: lines[index + 1], attrs: attributes(line), height: Number(attributes(line).RESOLUTION?.split('x')[1]) || 0 }] : [])
  if (!variants.length) return { text, quality: 'Original', audio: 'Included audio', subtitles: 'Embedded only' }
  const sorted = variants.sort((a, b) => (a.height - b.height) || (Number(a.attrs.BANDWIDTH) - Number(b.attrs.BANDWIDTH)))
  const selected = sorted.filter((variant) => variant.height <= 720).at(-1) ?? sorted[0]
  if (!selected.uri || selected.uri.startsWith('#')) throw new Error('The video playlist is incomplete.')
  const media = lines.filter((line) => line.startsWith('#EXT-X-MEDIA:')).map((line) => ({ line, attrs: attributes(line) }))
  const audios = media.filter(({ attrs }) => attrs.TYPE === 'AUDIO' && attrs['GROUP-ID'] === selected.attrs.AUDIO)
  const chosenAudio = audios.find(({ attrs }) => languageMatches(attrs.LANGUAGE, audio)) ?? audios.find(({ attrs }) => attrs.DEFAULT === 'YES') ?? audios[0]
  const chosenSubs = media.find(({ attrs }) => attrs.TYPE === 'SUBTITLES' && attrs['GROUP-ID'] === selected.attrs.SUBTITLES && languageMatches(attrs.LANGUAGE, subtitles))
  let variantLine = selected.line
  if (!chosenSubs) variantLine = variantLine.replace(/,SUBTITLES="[^"]*"/, '')
  const selectedMedia = [chosenAudio, chosenSubs].filter((item) => item !== undefined)
  // In-band closed captions have no separate URI and can be preserved unchanged.
  const captions = media.filter(({ attrs }) => attrs.TYPE === 'CLOSED-CAPTIONS' && attrs['GROUP-ID'] === selected.attrs['CLOSED-CAPTIONS'])
  return {
    text: ['#EXTM3U', '#EXT-X-VERSION:7', ...selectedMedia.map(({ line }) => line), ...captions.map(({ line }) => line), variantLine, selected.uri].join('\n'),
    quality: selected.height ? `${selected.height}p` : 'Original',
    audio: chosenAudio?.attrs.NAME ?? 'Included audio', subtitles: chosenSubs?.attrs.NAME ?? 'Embedded only',
  }
}

export function validateMedia(text: string) {
  if (!/^#EXTM3U\s/m.test(text)) throw new Error('The server did not return a video playlist.')
  if (!text.includes('#EXT-X-ENDLIST')) throw new Error('This stream is still being prepared or is live. Try downloading it later.')
  if (/#EXT-X-(DEFINE|PART:|PRELOAD-HINT|RENDITION-REPORT|GAP)/.test(text)) throw new Error('This stream format does not support downloads yet.')
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('#EXT-X-KEY:')) continue
    const attrs = attributes(line)
    if (attrs.METHOD !== 'NONE' && (attrs.METHOD !== 'AES-128' || (attrs.KEYFORMAT && attrs.KEYFORMAT !== 'identity'))) {
      throw new Error('This protected stream cannot be saved for offline playback.')
    }
  }
}
