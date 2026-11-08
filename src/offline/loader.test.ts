/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, expect, it, vi } from 'vitest'
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js'
import { OfflineLoader } from './loader'
import { readFile } from './storage'

vi.mock('./storage', () => ({ offlineKey: (url: string) => { if (!url.startsWith('https://offline.niho.invalid/')) throw new Error('Network denied'); return url.slice(29) }, readFile: vi.fn() }))
beforeEach(() => { vi.mocked(readFile).mockResolvedValue(new NodeBlob([new Uint8Array([1, 2, 3, 4])]) as unknown as Blob) })

function load(url: string, rangeEnd = 0, rangeStart = 0) {
  const loader = new OfflineLoader()
  return new Promise<{ data?: string | ArrayBuffer | object; error?: number }>((resolve) => {
    const callbacks = { onSuccess: (response) => resolve({ data: response.data }), onError: (error) => resolve({ error: error.code }), onTimeout: () => {} } satisfies LoaderCallbacks<LoaderContext>
    loader.load({ url, rangeStart, rangeEnd, responseType: 'arraybuffer' } as LoaderContext, {} as LoaderConfiguration, callbacks)
  })
}
it('reads the entire saved segment when hls.js passes a zero range end', async () => {
  const result = await load('https://offline.niho.invalid/test/asset-0')
  expect(Array.from(new Uint8Array(result.data as ArrayBuffer))).toEqual([1, 2, 3, 4])
})
it('slices saved resources for byte-range playlists', async () => {
  const result = await load('https://offline.niho.invalid/test/asset-0', 3, 1)
  expect(Array.from(new Uint8Array(result.data as ArrayBuffer))).toEqual([2, 3])
})
it('fails closed for missing data and network URLs', async () => {
  vi.mocked(readFile).mockResolvedValue(undefined)
  expect((await load('https://offline.niho.invalid/test/missing')).error).toBe(404)
  expect((await load('https://example.com/segment.ts')).error).toBe(404)
})
