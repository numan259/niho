import type { TitleSummary } from '../providers'
import { nativeDownloads, readNativeFile } from './nativeDownloads'

export interface Download {
  id: string
  profileId: string
  title: TitleSummary
  season?: number
  episode?: number
  episodeCount?: number
  label?: string
  status: 'queued' | 'downloading' | 'ready' | 'error'
  backend?: 'native'
  queuedAt?: number
  bytes: number
  completed: number
  total: number
  quality?: string
  audio?: string
  subtitles?: string
  error?: string
  createdAt: number
}

let database: Promise<IDBDatabase> | undefined
function db() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('niho-downloads', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('downloads', { keyPath: 'id' })
      request.result.createObjectStore('files')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = undefined; reject(request.error) }
  })
}

async function run<T>(store: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const connection = await db()
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(store, mode)
    const request = operation(transaction.objectStore(store))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('Could not save the download.'))
    transaction.onerror = () => reject(transaction.error ?? request.error)
  })
}

export const listDownloads = () => run<Download[]>('downloads', 'readonly', (store) => store.getAll())
export const saveDownload = (item: Download) => run('downloads', 'readwrite', (store) => store.put(item))
export const saveFile = (key: string, blob: Blob) => run('files', 'readwrite', (store) => store.put(blob, key))
export async function readFile(key: string): Promise<Blob | undefined> {
  const saved = await run<Blob | undefined>('files', 'readonly', (store) => store.get(key))
  return saved ?? (nativeDownloads ? readNativeFile(key) : undefined)
}
export const clearFiles = (id: string) => run('files', 'readwrite', (store) => store.delete(IDBKeyRange.bound(`${id}/`, `${id}/\uffff`)))
export async function deleteDownload(id: string) {
  const connection = await db()
  await new Promise<void>((resolve, reject) => {
    const transaction = connection.transaction(['files', 'downloads'], 'readwrite')
    transaction.objectStore('files').delete(IDBKeyRange.bound(`${id}/`, `${id}/\uffff`))
    transaction.objectStore('downloads').delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onabort = transaction.onerror = () => reject(transaction.error)
  })
}

export const OFFLINE_BASE = 'https://offline.niho.invalid/'
export const offlineUrl = (id: string, file = 'master.m3u8') => `${OFFLINE_BASE}${id}/${file}`
export function offlineKey(url: string) {
  if (!url.startsWith(OFFLINE_BASE)) throw new Error('Offline playback cannot request network resources.')
  return url.slice(OFFLINE_BASE.length)
}
