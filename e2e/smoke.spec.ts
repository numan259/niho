import { expect, test, type Page } from '@playwright/test'

const PROFILE_STATE = JSON.stringify({
  state: { profiles: [{ id: 'me', name: 'Me', color: '#f2b64c', kids: false }], activeId: 'me' },
  version: 1,
})

async function asProfile(page: Page) {
  await page.addInitScript((state) => {
    if (!localStorage.getItem('niho.profiles')) localStorage.setItem('niho.profiles', state)
  }, PROFILE_STATE)
}

const videoTime = (page: Page) => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)

test('pick a profile and browse home', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/profiles$/)
  await page.getByRole('button', { name: 'Watch as Me' }).click()

  await expect(page.getByRole('region', { name: /^Featured:/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Niho Open Originals' }).getByRole('link').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Popular Classic Films' }).getByRole('link').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/home.png' })
})

test('plays an Internet Archive MP4 and resumes from Continue Watching', async ({ page }) => {
  await asProfile(page)
  await page.goto('/title/archive/his_girl_friday')
  await expect(page.getByRole('heading', { name: 'His Girl Friday' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Public domain', description: 'View license' })).toBeVisible()

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => videoTime(page), { timeout: 60_000 }).toBeGreaterThan(2)

  // Jump ahead, then leave the player: progress is saved on exit.
  await page.locator('video').evaluate((v: HTMLVideoElement) => (v.currentTime = 600))
  await expect.poll(() => videoTime(page)).toBeGreaterThan(600)
  await page.getByRole('button', { name: 'Back', exact: true }).click({ force: true })

  await page.goto('/')
  const row = page.getByRole('region', { name: 'Continue Watching for Me' })
  await expect(row.getByRole('link', { name: /Play His Girl Friday, .* left/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/continue.png' })

  await row.getByRole('link', { name: /Play His Girl Friday/ }).click()
  await expect.poll(() => videoTime(page), { timeout: 60_000 }).toBeGreaterThan(590)
})

test('plays an adaptive HLS stream with a quality menu', async ({ page }) => {
  await asProfile(page)
  await page.goto('/watch/open/tears-of-steel')
  await expect.poll(() => videoTime(page), { timeout: 60_000 }).toBeGreaterThan(2)

  await page.locator('.player').hover()
  await page.getByRole('button', { name: 'Quality' }).click()
  const options = page.getByRole('menuitemradio')
  await expect(options.first()).toHaveText(/Auto/)
  expect(await options.count()).toBeGreaterThan(2)
  await page.screenshot({ path: 'test-results/player-hls.png' })
})

test('opens a series and lists its episodes', async ({ page }) => {
  await asProfile(page)
  await page.goto('/title/archive/Bonanza_pd')
  await expect(page.getByRole('tab', { name: 'Episodes' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('link', { name: /^Play episode 1: Episode 19$/ })).toBeVisible()
})

test('searches the licensed catalogue', async ({ page }) => {
  await asProfile(page)
  await page.goto('/search')
  await page.getByRole('searchbox', { name: 'Search' }).fill('noir')
  await expect(page.getByRole('heading', { name: 'Films & Series' })).toBeVisible()
  await expect(page.locator('.gallery a.card').first()).toBeVisible()
})
