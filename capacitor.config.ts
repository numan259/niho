import type { CapacitorConfig } from '@capacitor/cli'

// Native Android shell: the built web app (dist/) is bundled inside the APK,
// so only the films themselves stream from the internet.
const config: CapacitorConfig = {
  appId: 'com.numan259.niho',
  appName: 'Niho',
  webDir: 'dist',
  backgroundColor: '#0d0d0f',
  android: {
    backgroundColor: '#0d0d0f',
  },
  plugins: {
    // Light status/navigation bar icons on Niho's dark background.
    SystemBars: { style: 'DARK' },
  },
}

export default config
