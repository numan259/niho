import { defineConfig, devices } from '@playwright/test'

// Smoke tests against the real Internet Archive and stream hosts, so they need network access.
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    ...devices['Pixel 7'],
    // Use the locally installed Chrome (proprietary codecs, no browser download needed).
    channel: 'chrome',
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
