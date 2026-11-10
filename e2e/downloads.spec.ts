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

test('groups saved episodes by show and opens only downloaded episodes offline', async ({ page, context }) => {
  await fixture(page)
  await page.goto('/title/tv/1396')
  // Download out of order to verify the saved episode list sorts numerically.
  await page.getByRole('button', { name: 'Download episode 2', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Downloaded', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Download episode 1', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Downloaded', exact: true })).toHaveCount(2)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Downloads' }).click()
  const show = page.getByRole('link', { name: 'View downloaded episodes: Breaking Bad', exact: true })
  await expect(show).toHaveCount(1)
  await expect(show).toContainText('2 downloaded episodes')
  await expect(page.getByRole('link', { name: 'Watch offline', exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/downloads-shows.png' })
  await show.click()
  await expect(page).toHaveURL(/\/downloads\/series\/1396$/)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Season 1', exact: true })).toBeVisible()
  await expect(page.locator('.download-card__title')).toHaveText(['S1:E1 · Pilot', 'S1:E2 · Second Episode'])
  await expect(page.getByText('S1:E3')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/downloads-show-episodes.png' })
  await page.getByRole('link', { name: 'Watch S1:E1 · Pilot offline', exact: true }).click()
  const video = page.locator('video')
  await expect.poll(() => video.evaluate((media: HTMLVideoElement) => media.currentTime)).toBeGreaterThan(0)
  await video.evaluate((media: HTMLVideoElement) => media.pause())
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/downloads\/series\/1396$/)
  await page.getByRole('button', { name: 'Delete download: Breaking Bad S1:E1', exact: true }).click()
  await expect(page.getByText('1 downloaded episode', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'All downloads' }).click()
  await expect(show).toContainText('1 downloaded episode')
  await show.click()
  await page.getByRole('button', { name: 'Delete download: Breaking Bad S1:E2', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No episodes saved' })).toBeVisible()
  await page.getByRole('link', { name: 'All downloads' }).click()
  await expect(show).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No downloads yet' })).toBeVisible()
})

test('queues episodes while another downloads and automatically starts the next with parallel segments', async ({ page }) => {
  let active = 0, peak = 0
  page.on('request', (request) => { if (/segment-\d+\.ts/.test(request.url())) peak = Math.max(peak, ++active) })
  page.on('requestfinished', (request) => { if (/segment-\d+\.ts/.test(request.url())) active-- })
  page.on('requestfailed', (request) => { if (/segment-\d+\.ts/.test(request.url())) active-- })
  await fixture(page, 'slow')
  await page.goto('/title/tv/1396')
  await page.getByRole('button', { name: 'Download episode 1', exact: true }).click()
  await page.getByRole('button', { name: 'Download episode 2', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Queued', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Queued', exact: true }).click()
  await expect(page.getByText('Queued · #1 — starts automatically')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Watch offline', exact: true })).toHaveCount(2)
  await expect(page.getByText('2 downloaded episodes', { exact: false })).toBeVisible()
  expect(peak).toBeGreaterThanOrEqual(2)
  expect(peak).toBeLessThanOrEqual(3)
})

test('queued entries can be cancelled without cancelling the active download', async ({ page }) => {
  await fixture(page, 'slow')
  await page.goto('/title/tv/1396')
  await page.getByRole('button', { name: 'Download episode 1', exact: true }).click()
  await page.getByRole('button', { name: 'Download episode 2', exact: true }).click()
  await page.getByRole('link', { name: 'Queued', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel queued download' }).click()
  await expect(page.getByRole('alert')).toContainText('cancelled')
  await expect(page.getByRole('link', { name: 'Watch offline', exact: true })).toHaveCount(1)
})

test('pending queue survives a reload and continues after an interrupted browser download', async ({ page }) => {
  await fixture(page, 'slow')
  await page.goto('/title/tv/1396')
  await page.getByRole('button', { name: 'Download episode 1', exact: true }).click()
  await page.getByRole('button', { name: 'Download episode 2', exact: true }).click()
  await page.getByRole('link', { name: 'Queued', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('interrupted')
  await expect(page.getByRole('link', { name: 'Watch S1:E2 · Second Episode offline', exact: true })).toBeVisible()
})
