# Installation

## Web

Requirements:

- Node.js 24
- npm
- A TMDB account and credential
- Optional CinePro Core instance for direct playback

For full movie and episode playback, install and run the companion
[CinePro project](https://github.com/numan259/cinepro) first. Niho can run as a
discovery and trailer app without CinePro, but it cannot serve full media
streams itself.

```bash
git clone <repository-url>
cd netflix
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_TMDB_API_KEY` in `.env.local` before opening
`http://localhost:5173`. On Windows PowerShell, use
`Copy-Item .env.example .env.local`.

## Production web build

```bash
npm run build
npm run preview
```

For a real deployment, serve the contents of `dist/` and configure the host
to fall back to `index.html` for client-side routes.

## Android

Install Android Studio or the Android SDK, a compatible JDK, and `adb`.
Connect a device with USB debugging enabled or start an emulator.

```bash
npm ci
npm run android:apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The APK bundles the web app. The device must be able to reach TMDB and the
configured CinePro host. For a server running on the development computer
over USB:

```bash
adb reverse tcp:3000 tcp:3000
```

## No database

There are no migrations or database credentials. Profiles, My List, likes,
and playback progress are stored locally on each device.
