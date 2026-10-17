# Plan: Niho — a legal, Netflix-style streaming app (portfolio project)

**Complexity**: Large (≈ 6 phases, each shippable on its own)
**Status** (2026‑10‑17): Phases 0–5 built and tested; Phase 6 done except deployment + Lighthouse audit.

| Phase | State |
|---|---|
| 0 Setup | ✅ Vite + React 19 + TS, Oxlint, Vitest, Playwright, git |
| 1 Content layer | ✅ Archive + open movies providers, licence filter, episode/quality grouping — unit‑tested on fixtures |
| 2 Shell & Home | ✅ Section model + renderer, billboard, carousels, chips, tab bar |
| 3 Details & Player | ✅ Title page, episodes, HLS (on‑demand hls.js) + MP4, quality menu, fail‑over, resume |
| 4 Profiles & lists | ✅ Profiles (incl. Kids), My List, Likes, Continue Watching, next‑episode |
| 5 Search, Clips, My | ✅ Search + recent, vertical Clips feed, My Niho page |
| 6 Polish & ship | ✅ PWA manifest/icons/service worker, About/credits, README, CI workflow · ⏳ deploy (needs your hosting account), Lighthouse pass |
| Stretch | ⏳ backend, Capacitor APK, TMDB enrichment (needs a free API key) |

## 1. Summary

Niho is a mobile-first streaming app with the familiar "rows of titles" experience:
profile picker, billboard hero, horizontal carousels, title details with episodes,
search, My List, Continue Watching, and an adaptive video player.

It streams **only content that is legally free to redistribute**: public-domain and
Creative-Commons films/TV from the Internet Archive, plus the Blender Foundation open
movies. No piracy "embed" sites, no Netflix content, assets, code or APIs.

The CV story: *server-driven UI sections, a pluggable content-provider layer with
license filtering, HLS/MP4 adaptive playback, persisted watch progress, PWA, tests and CI.*

## 2. Legal guardrails (non-negotiable)

| Rule | Why |
|---|---|
| Only titles whose `licenseurl` is public-domain or Creative Commons are shown | The Archive's `classic_tv` collection also holds copyrighted uploads (e.g. *Get Smart*, *Shōgun*, *Ken Burns' Civil War*) — collection membership alone is **not** proof of a license |
| Every title shows its license + a link to its source page | Licenses are uploader-declared; users can verify, and CC-BY requires attribution |
| Exclude `-nd`/`-nc` licenses from anything public-facing that monetizes | Keep the project strictly non-commercial anyway |
| Never use "free movie" embed APIs (vidsrc, 2embed, superembed, etc.) | They stream pirated content — the exact thing to avoid |
| No Netflix name, logo, red "N", artwork, fonts, or copied code/strings | Inspiration from a UX pattern is fine; copying trade dress or code is not |
| TMDB (optional) used for metadata only, with the required attribution | TMDB's terms allow free non-commercial use with credit; it hosts no video |

## 3. Free, legal content sources

| Source | What it gives | Access | Verified (2026-10-16) |
|---|---|---|---|
| **Internet Archive – Advanced Search** `archive.org/advancedsearch.php` | Catalog search, sorting by popularity, collections | No key, CORS `*` | ✅ 200, CORS ok |
| **Internet Archive – Metadata** `archive.org/metadata/{id}` | Files per item (`.mp4` h.264, `_512kb.mp4`, `.ogv`), runtime, license | No key | ✅ |
| Internet Archive – thumbnails `archive.org/services/img/{id}` | Poster/thumbnail image | No key | ✅ |
| Internet Archive – files `archive.org/download/{id}/{file}` | Direct MP4 streaming (range requests) | No key | ✅ |
| **Blender open movies** (CC-BY) — Archive items `BigBuckBunny_124`, `ElephantsDream`, `Sintel`, `Tears-of-Steel` | High-quality "Originals" row | No key | ✅ items exist with MP4s |
| **HLS test streams** — `test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` (Big Buck Bunny), `demo.unified-streaming.com/.../tears-of-steel.ism/.m3u8` | Real adaptive-bitrate (HLS) playback demo | No key | ✅ (Sintel bitdash URL returns 403 — don't use) |
| TMDB API (optional) | Ratings, cast, backdrops for famous public-domain films | Free key | — |
| Wikimedia Commons / Pexels / Pixabay video APIs (optional) | Extra CC/royalty-free clips for a "Clips" feed | Free key (Pexels/Pixabay) | — |

License-filtered catalogue sizes found while testing (`licenseurl:(*publicdomain* OR *creativecommons.org*)`):
feature_films **9,125** · classic_tv **2,520** · Comedy_Films 616 · SciFi_Horror 383 · Film_Noir 309 · classic_cartoons 46.

## 4. What the REA investigation observed (Netflix Android app)

Scope was deliberately limited to **what's visible on screen + accessibility tree + package metadata**
on the user's own phone. No decompilation, asset extraction, DRM, or network/API interception.

**Target**: `com.netflix.mediaclient` 9.87.1 (versionCode 74701) on Galaxy S23 Ultra (SM-S918B)
— evidence `ev_2a793d83…`. Launcher activity `.ui.launch.UIWebViewActivity` — `ev_e1b5d8b7…`.

### Observations
| Screen | Structure seen (accessibility tags / text) |
|---|---|
| Profile picker | Hero promo background, "Choose Your Profile", avatar tiles, a Kids profile, *Add* and *Edit* tiles (`ev_472425bc…`) |
| Home | Top bar: title + Downloads badge + Notifications badge. Category chips row (`content_bar_chip_Shows/Movies/Games/Halloween/New & Hot`). `billboard` card with `BackgroundImage`, `LogoImage`, `OneLineTags` ("Show • Quirky • Fantasy…"), `PlayButton`, `MyListButton`. Then vertically scrolling rows: *Continue Watching for {profile}* (with "22 minutes remaining"), *Today's Top Picks*, *My List* + "See All", *Boredom Busters*, *Downloads For You*… |
| Home internals | Jetpack **Compose** UI. Page root `LolomoSuccess` → `lolomo_scrollable_column` → sections tagged `…CarouselSection:…SectionTreatment` containing entities tagged `…UIEntity:…BoxshotEntityTreatment:{Show\|Movie}:Video:{id}` |
| Title details | Back button, auto-playing muted preview with captions + mute toggle, title, year, maturity badge, format ("Limited Series"), CC icon, Top-10 rank, **Play**, **Download S1:E1**, synopsis, Starring/Creators, action row (*Set Reminders, My List, Rate, Share*), tabs (*Episodes, Collection, Trailers & More, More Like This*) |
| Search | Search field + voice; empty-state "Recommended TV Shows & Movies" list (horizontal artwork + inline play); results as a poster **gallery**; no-results state "Oh darn. We don't have that." |
| Clips | Full-screen vertical video feed: maturity notice, title, tags, synopsis, Mute / Add to My List / Share / More details, timestamp |
| My Netflix | Profile header, Downloads, Continue Watching, "TV Shows & Movies You've Liked", Share |
| Navigation | Floating bottom tab bar: Home · Clips · Search · My Netflix |

### Inferences (design takeaways — not copied)
1. **Server-driven UI**: every screen is a *page → sections → entities* tree where each node has a
   "treatment" (layout variant). A single generic renderer draws Home, Search and My Netflix.
   → Niho will use its own `Page/Section/Item` JSON schema with `variant` fields. This is the
   strongest architecture talking point for the CV.
2. Rows are **personalised and ordered** per profile (Continue Watching first, then picks).
3. Accessibility labels are rich ("Play The Mentalist, 22 minutes remaining") → we do the same.
4. Details page favours **one primary action** (Play) and pushes everything else into an icon row.

### Unknowns (out of scope by choice)
Network/API shapes, recommendation logic, player/DRM internals, offline download implementation.

## 5. Architecture

**Stack**: React 18 + TypeScript + Vite, React Router, hls.js, TanStack Query, Zustand,
Vitest + Testing Library, Playwright (smoke), PWA (vite-plugin-pwa). Mobile-first, responsive to desktop.
*(Optional later: wrap with Capacitor for an installable Android APK.)*

```
src/
  providers/            # content sources behind one interface
    types.ts            # Title, Episode, Source, License, ContentProvider
    archive.ts          # Internet Archive search + metadata → Title
    openMovies.ts       # curated Blender/HLS titles
    license.ts          # allow-list + label/attribution helpers
  catalog/
    pages.ts            # builds Page{sections[]} for home/search/my (server-driven-style)
    sections.ts         # row definitions (genre collections, continue watching, my list)
  ui/
    sections/           # Billboard, Carousel, Gallery, ListSection — chosen by `variant`
    items/              # PosterCard, WideCard, ContinueCard (progress bar)
    player/             # VideoPlayer (hls.js / native MP4), controls, episode switcher
    layout/             # TopBar, ChipBar, BottomTabBar
  routes/               # Profiles, Home, Title/:id, Watch/:id, Search, Clips, My
  state/                # profiles, myList, progress (Zustand + localStorage, per profile)
  test/                 # fixtures (recorded Archive JSON) + unit tests
```

**Key types**

```ts
type License = { url: string; kind: 'public-domain' | 'cc-by' | 'cc-by-sa' | 'cc-other'; label: string };
type Source  = { url: string; type: 'mp4' | 'hls'; quality?: string };
type Title   = { id: string; provider: 'archive' | 'open'; kind: 'movie' | 'series';
                 name: string; year?: number; synopsis?: string; tags: string[];
                 poster: string; backdrop?: string; runtimeSec?: number;
                 license: License; sourcePage: string; episodes?: Episode[]; sources?: Source[] };
type Section = { id: string; title: string; variant: 'billboard' | 'carousel' | 'gallery' | 'list' | 'continue';
                 items: Title[]; seeAll?: string };
type Page    = { id: 'home' | 'search' | 'my'; sections: Section[] };
```

Series: an Archive item with several video files becomes a `series`, one episode per file
(ordered by filename), e.g. *The Lone Ranger*, *Bonanza public domain episodes*, *Sherlock Holmes (1954)*.

## 6. Phases & tasks

### Phase 0 — Project setup (S)
- Scaffold Vite React-TS, add ESLint/Prettier, Vitest, path aliases, `git init`.
- Design tokens (CSS variables): dark theme, **own accent colour** (not Netflix red), own logo/wordmark.
- **Validate**: `npm run build && npm test` pass on an empty shell.

### Phase 1 — Content layer (M) — *test-first*
- `providers/types.ts`, `license.ts` (classify `licenseurl`, reject anything else).
- `archive.ts`: `search({collection, page, rows})` with the license filter baked into the query;
  `getTitle(id)` via `/metadata` → pick best MP4 (prefer `h.264`, fall back to `512Kb MPEG4`);
  multi-file items → episodes.
- `openMovies.ts`: curated list (Big Buck Bunny HLS, Tears of Steel HLS, Sintel/Elephants Dream MP4).
- Record real API responses as fixtures; unit-test mapping, license rejection, episode grouping.
- **Validate**: `npm test` — incl. a test that an item with an unrecognised license is dropped.

### Phase 2 — App shell & Home (M)
- Routes, `BottomTabBar` (Home · Clips · Search · My), `TopBar`, `ChipBar` (All / Movies / Series / Noir / Sci-Fi & Horror / Comedy / Cartoons).
- `catalog/pages.ts` builds the Home `Page`; a generic `SectionRenderer` picks a component by `variant`.
- Billboard (random featured title, tags line, Play + My List), lazy-loaded carousels, skeleton loaders,
  error/empty states with retry.
- **Validate**: component tests for `SectionRenderer`; manual check at 390 px and 1440 px widths.

### Phase 3 — Title details & Player (L)
- Details page: backdrop, title, year, runtime, **license badge + "Source" link**, Play / Resume,
  synopsis, action row (My List, Share via Web Share API), tabs: *Episodes* (series) / *More Like This*.
- `VideoPlayer`: hls.js for `.m3u8` (quality selector from levels), native `<video>` for MP4;
  custom controls (play/pause, ±10 s, scrubber, fullscreen, next episode, captions if present);
  keyboard + media-session support.
- Save progress every 5 s and on pause/exit.
- **Validate**: play one HLS title and one Archive MP4 end-to-end; unit-test progress maths.

### Phase 4 — Profiles, My List, Continue Watching (M)
- Profile picker (create / edit / delete, avatar colours, optional "Kids" profile restricted to the cartoons collection).
- Per-profile Zustand stores persisted to `localStorage` (wrapped in try/catch).
- Continue Watching row (progress bar, "N min remaining" a11y label), My List row + "See All".
- **Validate**: store unit tests; reload the page → state survives; switching profile isolates state.

### Phase 5 — Search, Clips, My page (M)
- Search: debounced Archive full-text query (still license-filtered), gallery results,
  recommended list when empty, friendly no-results state, recent searches.
- Clips: vertical swipe feed of short open-licensed clips (trailers/cartoons, muted autoplay, IntersectionObserver).
- My page: profile header, My List, Continue Watching, "Liked" (thumbs-up rating).
- **Validate**: Playwright smoke: profile → home → search "noir" → open → play 5 s → back → row shows progress.

### Phase 6 — Polish & ship (M)
- PWA (installable on your phone, offline app shell), lighthouse ≥ 90 perf/a11y,
  image lazy-loading, route code-splitting, prefers-reduced-motion.
- About/Credits page listing every source, license and TMDB attribution (if used).
- GitHub Actions: lint + test + build; deploy to Vercel/Netlify/GitHub Pages.
- README with screenshots, architecture diagram, and the "legal sources" section.
- **Validate**: CI green; live URL opens on your phone.

### Stretch (pick 1–2 for extra CV weight)
- Small backend (Node + Hono/Express + SQLite/Postgres) with real accounts, synced progress, and a
  cached/curated catalogue API — turns it into a full-stack project.
- Capacitor build → real Android APK.
- Upload pipeline for your own videos: ffmpeg → multi-bitrate HLS → object storage.
- TMDB enrichment for famous public-domain films (cast, ratings, backdrops).

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Uploader-declared licenses can be wrong | Medium | Show license + source link; keep a local deny-list; prefer curated collections; README disclaimer |
| Archive API slow / rate-limited | Medium | TanStack Query caching, small page sizes, fixtures for tests, optional backend cache |
| Some Archive items have no browser-playable MP4 | Medium | Filter on metadata; hide title when no `h.264`/`MPEG4` file |
| Third-party HLS test streams disappear | Low–Med | Fall back to Archive MP4 copies of the same Blender films |
| Low-res posters / missing artwork | High | Archive thumbnail + generated gradient poster with title text; optional TMDB images |
| Looking too much like Netflix (trade dress) | Low | Own name, logo, colour, copy; never use Netflix assets |

## 8. Acceptance

- [ ] Only PD/CC titles appear; each shows license + source link
- [ ] Home, Details, Player, Search, Clips, My page, Profiles all work on a phone
- [ ] HLS adaptive and MP4 playback both work; progress resumes
- [ ] Tests + build pass in CI; deployed live URL
- [ ] README documents architecture, sources, and the legal approach

---
**WAITING FOR CONFIRMATION**: proceed with Phase 0 + Phase 1? (yes / modify: … / different stack: …)
