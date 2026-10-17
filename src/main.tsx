import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled with the app (no third-party font requests).
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import App from './App.tsx'
import './index.css'
import { isNative, setupNative } from './native'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Profiles, My List and watch progress live on this device only. Ask the browser to keep
// that storage permanently instead of clearing it under storage pressure.
navigator.storage?.persist?.().catch(() => undefined)

setupNative()

// Offline app shell + installability for the web build. Skipped in dev (stale modules)
// and in the Android app, where the whole app is already bundled on the device.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
