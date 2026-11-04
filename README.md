# niho.

A mobile‑first film & TV discovery app with the familiar “rows of titles” experience — profiles, a featured
billboard, carousels, title pages with seasons and episodes, search, a vertical trailer feed, My List and
Continue Watching — plus **JustWatch‑style “Where to watch”** availability for your country.

Built on the [TMDB API](https://www.themoviedb.org/documentation/api). Niho plays official trailers and
shows where each title is legally available; it does not host or stream films. Ships as a web app (PWA) and a
native Android app (Capacitor).

## Features

- **Discovery rows** from TMDB: trending this week, popular and top‑rated movies & series, genre rows
- **Title pages**: backdrop, tagline, runtime / seasons, age rating for your region, TMDB score, director /
  creators, cast, *More Like This* recommendations
- **Where to watch**: stream / free / rent / buy providers for the viewer’s country (JustWatch data via TMDB)
- **Trailer player**: official trailers in YouTube’s embedded player inside Niho’s player chrome — back,
  title, trailer switcher, *Next episode*, resume where you left off
- **Series**: season picker, episode list with stills; episode clips fall back to season / series trailers
- **Continue Watching & My List** per profile, stored on the device (no accounts)
- **Profiles** including a **Kids** profile (animation / family / kids genres, PG‑capped films)
- **Clips**: vertical, swipeable feed of muted trailers
- **Search** across movies and series with recent searches and infinite scroll
- **PWA** + **Android app**, accessible labels throughout, reduced‑motion support

## Architecture

```
src/
  providers/   TMDB client + pure mappers (lists, details, trailers, providers, seasons)
  catalog/     Row definitions, page builder (sections + variants), TanStack Query hooks
  state/       Zustand stores persisted per profile (profiles, My List, likes, progress)
  ui/          Cards, rows, billboard, gallery, player (YouTube stage + hls.js/MP4 stream player)
  routes/      Profiles, Home, Title, Watch, Search, Browse, Clips, My, About
e2e/           Playwright tests with TMDB / YouTube mocked at the network layer
android/       Capacitor Android project
```

Key decisions:

- **Numeric TMDB ids everywhere.** Titles are keyed `movie/27205` / `tv/1396`; routes are
  `/title/:mediaType/:id` and `/watch/tv/:id?s=1&e=3`.
- **Pure, tested mapping layer.** Raw TMDB JSON → app types in pure functions (trailer ranking, provider
  grouping, certification by region, adult/person filtering, cross‑page de‑duplication), unit‑tested on
  fixtures.
- **Server‑driven‑style home page.** `Page → Section[]`, each section rendered by `variant`.
- **Compliant trailer playback.** TMDB videos are YouTube ids, so they play through YouTube’s official
  IFrame API (privacy‑enhanced host) rather than extracting streams; the API still reports position, so
  progress and Continue Watching work. Direct HLS/MP4 sources keep using the native `<video>` + hls.js player.
- **Progress rules as a reducer.** `applyProgress()` decides resume / next‑episode / finished.
- **Deterministic e2e tests.** Playwright intercepts TMDB, its image CDN and YouTube and serves fixtures, so
  CI needs no API key.

## Getting started

1. Get a free TMDB key: create an account at themoviedb.org → **Settings → API** → request a developer key.
2. Configure it (the file is git‑ignored):

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   VITE_TMDB_API_KEY=<your "API Read Access Token" (eyJ…) or v3 API key>
   ```

3. Run:

   ```bash
   npm install
   npm run dev          # http://localhost:5173
   npm test             # unit tests (Vitest)
   npm run test:e2e     # Playwright tests in local Chrome (mocked, no key needed)
   npm run build        # production build in dist/
   npm run android:apk  # debug APK in android/app/build/outputs/apk/debug/
   ```

> Vite embeds `VITE_*` values in the built app, so the key is readable by anyone with the web build or APK.
> TMDB keys are read‑only; for a public deployment put a small proxy in front of the API.

The web app uses client‑side routing, so configure your host to serve `index.html` for unknown paths.

## Credits

<img src="public/tmdb-logo.svg" alt="TMDB" width="160">

This product uses the TMDB API but is not endorsed or certified by TMDB. Where‑to‑watch data is provided by
JustWatch. Trailers are hosted by YouTube. Niho is a non‑commercial portfolio project and is not affiliated with
any streaming service.

## Tech

React 19 · TypeScript · Vite · React Router · TanStack Query · Zustand · hls.js · YouTube IFrame API ·
Capacitor · Vitest + Testing Library · Playwright · Oxlint
