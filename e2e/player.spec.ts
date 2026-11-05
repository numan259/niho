import { expect, test } from '@playwright/test'

test('touch reveals controls; side double taps seek; only the center button pauses', async ({ page }) => {
  await page.goto('/e2e/player.html')
  const player = page.getByRole('region')
  const video = page.locator('video')
  await expect(player).not.toHaveClass(/player--controls/)
  const bounds = (await video.boundingBox())!
  await page.touchscreen.tap(bounds.width / 2, bounds.height / 2)
  await expect(player).toHaveClass(/player--controls/)
  await expect(video).toHaveJSProperty('paused', false)
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(1)
  await page.touchscreen.tap(bounds.width * 0.8, bounds.height / 2)
  await page.touchscreen.tap(bounds.width * 0.8, bounds.height / 2)
  await expect(video).toHaveJSProperty('currentTime', 130)
  await page.touchscreen.tap(bounds.width * 0.2, bounds.height / 2)
  await page.touchscreen.tap(bounds.width * 0.2, bounds.height / 2)
  await expect(video).toHaveJSProperty('currentTime', 120)
  await page.getByRole('button', { name: 'Pause', exact: true }).tap()
  await expect(video).toHaveJSProperty('paused', true)
})

test('landscape controls fit and mouse double-click seeks without toggling playback', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 })
  await page.goto('/e2e/player.html')
  await page.locator('video').dblclick({ position: { x: 750, y: 200 } })
  await expect(page.locator('video')).toHaveJSProperty('currentTime', 130)
  await expect(page.locator('video')).toHaveJSProperty('paused', false)
  const fullscreen = page.getByRole('button', { name: 'Full screen', exact: true })
  await expect(fullscreen).toBeInViewport()
  await fullscreen.click()
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
  await page.screenshot({ path: 'test-results/player-landscape.png' })
  await page.getByRole('button', { name: 'Exit full screen' }).click()
  await expect(fullscreen).toBeVisible()
})

test('subtitles follow the picture, clear the controls, and disappear when disabled', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 })
  await page.goto('/e2e/player.html?captions')
  const captions = page.locator('.player__captions')
  await expect(captions).toBeVisible()
  await expect(captions).toContainText('-Your coffee.')
  await expect(captions.locator('i')).toHaveText('coffee')
  const controlsTop = (await page.locator('.player__scrub').boundingBox())!.y
  const raised = (await captions.boundingBox())!
  expect(raised.y + raised.height).toBeLessThan(controlsTop - 8)
  await page.screenshot({ path: 'test-results/subtitles-controls.png' })
  await expect(page.getByRole('region')).not.toHaveClass(/player--controls/)
  const resting = (await captions.boundingBox())!
  expect(resting.y).toBeGreaterThan(raised.y)
  expect(resting.y + resting.height).toBeLessThan(412 - 20)
  await page.screenshot({ path: 'test-results/subtitles-hidden-controls.png' })
  await page.setViewportSize({ width: 393, height: 851 })
  await expect.poll(async () => (await captions.boundingBox())!.y).toBeGreaterThan(300)
  const portrait = (await captions.boundingBox())!
  const pictureBottom = (851 + 393 * 9 / 16) / 2
  expect(portrait.y + portrait.height).toBeLessThan(pictureBottom - 10)
  await page.screenshot({ path: 'test-results/subtitles-portrait.png' })
  await page.locator('video').evaluate((video: HTMLVideoElement) => { video.textTracks[0].mode = 'disabled' })
  await expect(captions).not.toBeVisible()
})
