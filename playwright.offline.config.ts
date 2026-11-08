import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: 'downloads.spec.ts', timeout: 60_000,
  expect: { timeout: 15_000 }, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5175', ...devices['Pixel 7'], channel: 'chrome', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175', reuseExistingServer: false,
    env: { VITE_TMDB_API_KEY: 'e2e-placeholder-key' },
  },
})
