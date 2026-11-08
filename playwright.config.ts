import { defineConfig, devices } from '@playwright/test'

// TMDB, its image CDN and YouTube are mocked inside the tests (e2e/mocks.ts),
// so the suite needs no API key or network and is deterministic in CI.
const PORT = 5174

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'downloads.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Pixel 7'],
    locale: 'en-US',
    // Use the locally installed Chrome (no browser download needed).
    channel: 'chrome',
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    // Placeholder key: every TMDB request is intercepted, nothing reaches the real API.
    env: { VITE_TMDB_API_KEY: 'e2e-placeholder-key' },
  },
})
