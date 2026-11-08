import { create } from 'zustand'
import { getCineProSources } from '../providers/cinepro'
import { usePlaybackPreferences } from '../state/playback'
import { attributes, selectMaster, validateMedia } from './playlist'
import { clearFiles, deleteDownload, listDownloads, offlineUrl, saveDownload, saveFile, type Download } from './storage'

export const useDownloads = create<{ items: Download[]; loaded: boolean; error?: string }>(() => ({ items: [], loaded: false }))
let initialized: Promise<void> | undefined
const tasks = new Map<string, AbortController>()
export const downloadId = (profile: string, key: string, season?: number, episode?: number) => `${encodeURIComponent(profile)}-${key.replace('/', '-')}-${season ?? 0}-${episode ?? 0}`
function update(item: Download) {
  useDownloads.setState(({ items }) => ({ items: [item, ...items.filter((entry) => entry.id !== item.id)].sort((a, b) => b.createdAt - a.createdAt) }))
}

export function initializeDownloads() {
  return initialized ??= (async () => {
    try {
      const items = await listDownloads()
      for (const item of items) {
        if (item.status === 'downloading') {
          await clearFiles(item.id)
          item.status = 'error'; item.bytes = 0; item.error = 'Download interrupted. Tap Retry to start again.'
          await saveDownload(item)
        }
      }
      useDownloads.setState({ items: items.sort((a, b) => b.createdAt - a.createdAt), loaded: true })
    } catch {
      useDownloads.setState({ loaded: true, error: 'Downloads need local storage. Storage is unavailable on this device.' })
    }
  })()
}

async function fetchBlob(url: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    const timer = window.setTimeout(abort, 90000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`The video server returned ${response.status}. Try again later.`)
      const limit = 128 * 1024 * 1024
      if (Number(response.headers.get('Content-Length')) > limit) throw new Error('A video segment is too large to download on this device.')
      if (!response.body) throw new Error('The video server returned no data.')
      const reader = response.body.getReader()
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let bytes = 0
      while (true) {
        const part = await reader.read()
        if (part.done) break
        bytes += part.value.byteLength
        if (bytes > limit) { await reader.cancel(); throw new Error('A video segment is too large to download on this device.') }
        chunks.push(part.value)
      }
      if (!bytes) throw new Error('The video server returned an empty file.')
      return { blob: new Blob(chunks, { type: response.headers.get('Content-Type') ?? 'application/octet-stream' }), url: response.url || url }
    } catch (error) {
      signal.throwIfAborted()
      if (attempt >= 2) throw error
    } finally {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      controller.abort()
    }
  }
}

export async function startDownload(input: Pick<Download, 'id' | 'profileId' | 'title' | 'season' | 'episode' | 'episodeCount' | 'label'>) {
  await initializeDownloads()
  if (tasks.size || useDownloads.getState().error || useDownloads.getState().items.some((item) => item.id === input.id && item.status === 'ready')) return
  const controller = new AbortController()
  tasks.set(input.id, controller)
  const signal = controller.signal
  let item: Download = { ...input, status: 'downloading', bytes: 0, completed: 0, total: 0, createdAt: Date.now() }
  update(item)
  try {
    const { default: Hls } = await import('hls.js')
    if (!Hls.isSupported()) throw new Error('Offline video is supported in the Android app and browsers with Media Source playback.')
    await navigator.storage?.persist?.().catch(() => false)
    await clearFiles(item.id)
    await saveDownload(item)
    const [source] = await getCineProSources(item.title.mediaType, item.title.id, item.season, item.episode)
    const preferences = usePlaybackPreferences.getState()
    const resources = new Map<string, string>()
    const playlists = new Map<string, string>()
    const visiting = new Set<string>()
    const absolute = (uri: string, base: string) => {
      const url = new URL(uri, base)
      if (!['http:', 'https:'].includes(url.protocol) || uri.includes('{$')) throw new Error('This stream uses a resource that cannot be downloaded.')
      return url.href
    }
    const asset = (url: string) => {
      let file = resources.get(url)
      if (!file) { file = `asset-${resources.size}`; resources.set(url, file) }
      return offlineUrl(item.id, file)
    }
    const playlist = async (url: string, file: string, depth: number): Promise<string> => {
      if (depth > 4 || visiting.has(url)) throw new Error('The stream has an invalid playlist structure.')
      visiting.add(url)
      const response = await fetchBlob(url, signal)
      const selection = selectMaster(await response.blob.text(), preferences.audioLanguage, preferences.subtitleLanguage)
      if (depth === 0) { item = { ...item, quality: selection.quality, audio: selection.audio, subtitles: selection.subtitles }; update(item) }
      const isMaster = selection.text.includes('#EXT-X-STREAM-INF:')
      if (!isMaster) validateMedia(selection.text)
      const output: string[] = []
      for (const raw of selection.text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line) continue
        if (!line.startsWith('#')) {
          const resource = absolute(line, response.url)
          output.push(isMaster ? await playlist(resource, `playlist-${playlists.size}-${depth}-${output.length}.m3u8`, depth + 1) : asset(resource))
        } else if (/\bURI="/.test(line)) {
          const uri = attributes(line).URI
          if (!uri) throw new Error('The playlist contains an invalid resource.')
          const resource = absolute(uri, response.url)
          const replacement = line.startsWith('#EXT-X-MEDIA:')
            ? await playlist(resource, `playlist-${playlists.size}-${depth}-${output.length}.m3u8`, depth + 1)
            : asset(resource)
          output.push(line.replace(/URI="[^"]*"/, `URI="${replacement}"`))
        } else output.push(line)
      }
      playlists.set(file, output.join('\n') + '\n')
      visiting.delete(url)
      return offlineUrl(item.id, file)
    }
    await playlist(source.url, 'master.m3u8', 0)
    if (!resources.size) throw new Error('The video has no downloadable segments.')
    item = { ...item, total: resources.size }; update(item)
    for (const [url, file] of resources) {
      signal.throwIfAborted()
      const { blob } = await fetchBlob(url, signal)
      signal.throwIfAborted()
      await saveFile(`${item.id}/${file}`, blob)
      item = { ...item, bytes: item.bytes + blob.size, completed: item.completed + 1 }
      update(item)
    }
    for (const [file, text] of playlists) {
      signal.throwIfAborted()
      const blob = new Blob([text], { type: 'application/vnd.apple.mpegurl' })
      await saveFile(`${item.id}/${file}`, blob)
      item = { ...item, bytes: item.bytes + blob.size }
    }
    signal.throwIfAborted()
    item = { ...item, status: 'ready' }
    await saveDownload(item)
    update(item)
  } catch (error) {
    await clearFiles(item.id).catch(() => undefined)
    const message = signal.aborted ? 'Download cancelled. Tap Retry to start again.'
      : error instanceof DOMException && error.name === 'QuotaExceededError' ? 'Not enough storage. Remove a download or free device space and retry.'
      : error instanceof Error ? error.message : 'Download failed. Check your connection and retry.'
    item = { ...item, status: 'error', bytes: 0, completed: 0, error: message }
    await saveDownload(item).catch(() => undefined)
    update(item)
  } finally { tasks.delete(input.id) }
}

export function cancelDownload(id: string) { tasks.get(id)?.abort() }
export async function removeDownload(id: string) {
  if (tasks.has(id)) { cancelDownload(id); return }
  await deleteDownload(id)
  useDownloads.setState(({ items }) => ({ items: items.filter((item) => item.id !== id) }))
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
