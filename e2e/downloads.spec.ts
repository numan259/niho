import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { asProfile, mockServices } from './mocks'

const folder = 'e2e/fixtures/offline/'
async function fixture(page: Page, mode: 'normal' | 'failed' | 'slow' = 'normal') {
  await mockServices(page)
  await asProfile(page)
  await page.addInitScript(() => localStorage.setItem('niho.playback', JSON.stringify({ state: { audioLanguage: 'en', subtitleLanguage: 'en', subtitleSize: 'medium', autoplay: false }, version: 1 })))
  await page.route('**/streams/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!
    if (name === 'master.m3u8') return route.fulfill({ contentType: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="s",NAME="English",LANGUAGE="en",URI="subtitles.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=160x90,SUBTITLES="s"\nvideo.m3u8\n' })
    if (name === 'subtitles.m3u8') return route.fulfill({ contentType: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXT-X-TARGETDURATION:12\n#EXTINF:12,\nsubtitles.vtt\n#EXT-X-ENDLIST\n' })
    if (name === 'subtitles.vtt') return route.fulfill({ contentType: 'text/vtt', body: 'WEBVTT\n\n00:00.000 --> 00:12.000\nOffline subtitles work.\n' })
    if (name.startsWith('segment-') && mode === 'failed') return route.fulfill({ status: 503, body: 'Unavailable' })
    if (name.startsWith('segment-') && mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 2000))
    if (/^(video\.m3u8|segment-\d+\.ts)$/.test(name)) return route.fulfill({ contentType: name.endsWith('.ts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl', body: readFileSync(folder + name.replace(/\.ts$/, '.bin')) })
    return route.abort()
  })
  await page.goto('/title/movie/550')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}

test('downloads video and subtitles, cold-loads offline, seeks and deletes saved files', async ({ page, context }) => {
  await fixture(page)
  await page.getByRole('button', { name: 'Download movie', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Downloads' }).click()
  await expect(page.getByRole('link', { name: 'Watch offline' })).toBeVisible()
  await page.screenshot({ path: 'test-results/downloads-ready.png' })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Watch offline' })).toBeVisible()
  const external: string[] = []
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5175') && !request.url().startsWith('blob:')) external.push(request.url()) })
  await page.getByRole('link', { name: 'Watch offline' }).click()
  const video = page.locator('video')
  await expect.poll(() => video.evaluate((media: HTMLVideoElement) => media.currentTime)).toBeGreaterThan(0)
  await video.evaluate((media: HTMLVideoElement) => media.pause())
  await expect(page.locator('.player__captions')).toContainText('Offline subtitles work.')
  await video.evaluate((media: HTMLVideoElement) => { media.pause(); media.currentTime = 7 })
  await expect.poll(() => video.evaluate((media: HTMLVideoElement) => media.readyState)).toBeGreaterThanOrEqual(2)
  await expect(video).toHaveJSProperty('currentTime', 7)
  await page.screenshot({ path: 'test-results/downloads-offline-player.png' })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  expect(external).toEqual([])
  await page.getByRole('button', { name: /^Delete download:/ }).click()
  await expect(page.getByText('No downloads yet')).toBeVisible()
  const count = await page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('niho-downloads', 1)
    request.onsuccess = () => { const query = request.result.transaction('files').objectStore('files').count(); query.onsuccess = () => { resolve(query.result); request.result.close() } }
  }))
  expect(count).toBe(0)
})

test('failed downloads are not offered for offline playback and can be retried', async ({ page }) => {
  await fixture(page, 'failed')
  await page.getByRole('button', { name: 'Download movie', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Downloads' }).click()
  await expect(page.getByRole('alert')).toContainText('503')
  await expect(page.getByRole('link', { name: 'Watch offline' })).toHaveCount(0)
  await fixture(page)
  await page.goto('/downloads')
  await page.getByRole('button', { name: 'Retry download' }).click()
  await expect(page.getByRole('link', { name: 'Watch offline' })).toBeVisible()
})

test('cancelling a download cleans incomplete data and survives a restart', async ({ page }) => {
  await fixture(page, 'slow')
  await page.getByRole('button', { name: 'Download movie', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Downloads' }).click()
  await page.getByRole('button', { name: 'Cancel download' }).click()
  await expect(page.getByRole('alert')).toContainText('cancelled')
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('cancelled')
  await expect(page.getByRole('link', { name: 'Watch offline' })).toHaveCount(0)
})

test('reopening during a download marks it interrupted rather than ready', async ({ page }) => {
  await fixture(page, 'slow')
  await page.getByRole('button', { name: 'Download movie', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Downloads' }).click()
  await expect(page.getByRole('status')).toContainText('of 7 files')
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('interrupted')
  await expect(page.getByRole('link', { name: 'Watch offline' })).toHaveCount(0)
})

test('storage quota failures offer a useful error without a partial playable download', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'files') throw new DOMException('Storage full', 'QuotaExceededError')
      return put.apply(this, args)
    }
  })
  await fixture(page)
  await page.getByRole('button', { name: 'Download movie', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Downloads' }).click()
  await expect(page.getByRole('alert')).toContainText('Not enough storage')
  await expect(page.getByRole('link', { name: 'Watch offline' })).toHaveCount(0)
})
