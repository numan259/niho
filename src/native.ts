import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/** True inside the Android app (Capacitor), false in a normal browser. */
export const isNative = Capacitor.isNativePlatform()

/** Native-only wiring: Android back button behaves like in-app navigation. */
export function setupNative() {
  if (!isNative) return
  App.addListener('backButton', ({ canGoBack }) => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
    } else if (canGoBack) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })
}
