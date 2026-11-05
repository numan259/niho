import { expect, test } from '@playwright/test'
import { asProfile, mockServices } from './mocks'

test.beforeEach(async ({ page }) => {
  await mockServices(page)
})

test('pick a profile and browse TMDB rows', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/profiles$/)
  await page.getByRole('button', { name: 'Watch as Me' }).click()

  await expect(page.getByRole('region', { name: /^Featured:/ })).toBeVisible()
  const trending = page.getByRole('region', { name: 'Trending This Week' })
  await expect(trending.getByRole('link', { name: 'Inception (2010)' })).toHaveAttribute('href', '/title/movie/27205')
  await expect(trending.getByRole('link', { name: 'Breaking Bad (2008)' })).toHaveAttribute('href', '/title/tv/1396')
  await page.screenshot({ path: 'test-results/home.png' })
})

test('title page shows details, where to watch and cast', async ({ page }) => {
  await asProfile(page)
  await page.goto('/title/movie/27205')
  await expect(page.getByRole('heading', { name: 'Inception', level: 1 })).toBeVisible()
  await expect(page.getByText('PG-13')).toBeVisible()
  await expect(page.getByText('Directed by')).toBeVisible()

  const where = page.getByRole('region', { name: 'Where to watch' })
  await expect(where.getByRole('link', { name: 'Stream on Stream Service A' })).toHaveAttribute('href', /themoviedb\.org\/movie\/27205/)
  await expect(where.getByRole('link', { name: 'Rent on Rental Store' })).toBeVisible()
  await expect(where.getByRole('link', { name: 'JustWatch' })).toBeVisible()

  await page.getByRole('tab', { name: 'Cast' }).click()
  await expect(page.getByText('Lead Actor')).toBeVisible()
  await page.screenshot({ path: 'test-results/title.png', fullPage: true })
})

test('opens the movie player and saves progress to Continue Watching', async ({ page }) => {
  await asProfile(page)
  await page.goto('/title/movie/27205')
  await page.getByRole('button', { name: 'Play movie', exact: true }).click()

  await expect(page).toHaveURL(/\/watch\/movie\/27205$/)
  const video = page.locator('video')
  await expect(video).toBeVisible()
  await expect(page.locator('.player__frame iframe')).toHaveCount(0)

  // Simulate pausing 90 seconds into a 150-second video, without live media.
  await video.evaluate((media: HTMLVideoElement) => {
    Object.defineProperty(media, 'duration', { configurable: true, value: 150 })
    Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 90 })
    media.dispatchEvent(new Event('loadedmetadata'))
    media.dispatchEvent(new Event('timeupdate'))
    media.dispatchEvent(new Event('pause'))
  })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('niho.library')!).state.libraries.me.progress['movie/27205']?.position)).toBe(90)
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.goto('/')
  const row = page.getByRole('region', { name: 'Continue Watching for Me' })
  await row.getByRole('link', { name: 'Play Inception, 1 min left' }).click()
  await expect(page).toHaveURL(/\/watch\/movie\/27205$/)
  await expect(video).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('niho.library')!).state.libraries.me.progress['movie/27205'].position)).toBe(90)
})

test('clips use the official YouTube trailer', async ({ page }) => {
  await asProfile(page)
  await page.goto('/clips')
  await expect(page.getByTitle('Inception trailer')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/official-trailer/)
})

test('series: season episodes open the direct player with S:E details', async ({ page }) => {
  await asProfile(page)
  await page.goto('/title/tv/1396')
  await expect(page.getByRole('tab', { name: 'Episodes' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('combobox')).toHaveValue('1')

  await page.getByRole('link', { name: 'Play preview for episode 1: Pilot' }).click()
  await expect(page).toHaveURL(/\/watch\/tv\/1396\?s=1&e=1$/)
  await expect(page.getByText('S1:E1 · Pilot')).toBeVisible()
  await expect(page.locator('video')).toBeVisible()
  await expect(page.locator('.player__frame iframe')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next: S1:E2' })).toBeVisible()
})

test('searches TMDB', async ({ page }) => {
  await asProfile(page)
  await page.goto('/search')
  await page.getByRole('searchbox', { name: 'Search' }).fill('incep')
  await expect(page.getByRole('heading', { name: 'Films & Series' })).toBeVisible()
  await expect(page.locator('.gallery').getByRole('link', { name: 'Inception (2010)' })).toBeVisible()
})
