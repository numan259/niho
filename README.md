# niho.

A mobile‑first streaming app with the familiar “rows of titles” experience — profiles, a featured billboard,
carousels, title pages with episodes, search, a vertical clips feed, My List, Continue Watching and an adaptive
video player.

**Everything Niho streams is legally free to watch:** public‑domain and Creative Commons films and TV from the
[Internet Archive](https://archive.org), plus the Blender Foundation’s open movies. No piracy sources, no keys,
no backend required.

## Features

- **Profiles** (incl. a Kids profile that only sees animation), each with its own My List, likes and watch history
- **Home** built from a server‑driven‑style page model: `Page → Section[] → Title[]`, each section rendered by `variant`
- **Continue Watching** with progress bars, “N min left”, and automatic *next episode* for series
- **Title pages** with episodes, *More Like This*, licence + source attribution on every title
- **Player**: hls.js (loaded on demand) for adaptive streams, native MP4 otherwise, automatic fail‑over between
  sources, quality menu, ±10 s, keyboard shortcuts, Media Session (lock‑screen controls), resume where you left off
- **Search** across the licensed catalogue with recent searches and infinite scroll
- **Clips**: vertical feed of muted previews
- **PWA**: installable on your phone, offline app shell
- Accessible labels throughout (e.g. “Play His Girl Friday, 22 min left”), reduced‑motion support

## Legal content sources

| Source | Used for | Notes |
| --- | --- | --- |
| Internet Archive Advanced Search + Metadata APIs | Catalogue, files, artwork | No key; every query is filtered to `licenseurl:(*publicdomain* OR *creativecommons.org*)` |
| Blender open movies (CC BY) | “Niho Open Originals” row | Credited on the About page |
| Mux / Unified Streaming public HLS test streams | Adaptive‑bitrate demo | *Big Buck Bunny*, *Tears of Steel* |

Collection names alone are **not** trusted — e.g. the Archive’s `classic_tv` collection also contains copyrighted
uploads — so titles without a recognised PD/CC licence are dropped in code (`src/providers/license.ts`) and every
title links to its licence and source page.

## Architecture

```
src/
  providers/   Content sources behind one interface (Archive, open movies) + licence filtering
  catalog/     Row definitions, page builder (sections + variants), TanStack Query hooks
  state/       Zustand stores persisted per profile (profiles, My List, likes, progress)
  ui/          Cards, rows, billboard, gallery, player, layout
  routes/      Profiles, Home, Title, Watch, Search, Browse, Clips, My, About
e2e/           Playwright smoke tests against the live sources
```

Key decisions:

- **Pure, tested mapping layer.** Archive responses are mapped by pure functions (licence classification,
  episode grouping, quality variants, name cleanup), unit‑tested against recorded fixtures.
- **Episodes from files.** An Archive item with several videos becomes a series; alternate encodings
  (`1080p`/`720p`, `stereo`/`surround`, `_512kb`) are merged into quality options instead of fake episodes.
- **Progress rules as a reducer.** `applyProgress()` decides resume / next‑episode / finished, so the UI stays dumb.
- **Code‑splitting.** Routes are lazy; hls.js (~575 kB) only downloads when an HLS stream actually plays.

Design references came from observing the Netflix Android app’s *visible* UI and accessibility tree on my own
device (screens, navigation, section structure). No code, assets, APIs or branding were copied — see `plan.md`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run test:e2e     # Playwright smoke tests in your local Chrome (needs internet)
npm run build        # production build in dist/
```

The app uses client‑side routing, so when deploying configure your host to serve `index.html` for unknown paths
(SPA fallback).

## Tech

React 19 · TypeScript · Vite · React Router · TanStack Query · Zustand · hls.js · Vitest + Testing Library ·
Playwright · Oxlint

---

Niho is a non‑commercial portfolio project and is not affiliated with any streaming service.
