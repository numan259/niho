# Language preferences and Cinepro

Backend handoff: [copy-ready Cinepro Codex prompt](cinepro-codex-prompt.md). Proposed discovery route: `GET /sources`. Configure its absolute URL after backend verification. The client validates URLs, deduplicates identical URLs, retains distinct provider variants, and disables background source refreshes to preserve manual choices.

Niho retains audioLanguage (English default) and subtitleLanguage (Off default), and adds languagePriority (audio default; subtitle and balanced supported). Settings are stored in niho.playback version 2 by local profile ID. Version 1 settings migrate to the active profile (first existing profile if none is selected). Other profiles start with defaults. Audio and Subtitles have dedicated player buttons listing actual stream tracks. Selections are remembered per profile. The player gear opens Providers for the current movie or episode; subtitle size and autoplay remain under My playback settings. Storage is device-local, not account sync.

The default integration remains /streams/movie/:id/master.m3u8 or /streams/tv/:id/:season/:episode/master.m3u8. No backend changes are required for existing playback. VITE_CINEPRO_LANGUAGE_PARAMS=true opts into query parameters preferredAudioLanguage, preferredSubtitleLanguage, languagePriority. Empty audio means default; subtitle off means disabled. Older servers remain supported with the flag disabled.

For provider-level ranking, Cinepro must expose an absolute JSON endpoint configured as VITE_CINEPRO_SOURCES_URL. This is a proposed optional contract, not an assertion that Cinepro implements it. Niho sends mediaType, tmdbId, optional season/episode, and the three preference parameters. It expects:

```json
{"sources":[{"url":"https://example.com/movie.m3u8","type":"hls","provider":"Example","quality":"1080p","audioLanguages":["tr","ja"],"subtitleLanguages":["en","tr"]}]}
```

Each source must have an HTTP(S) URL and hls or mp4 type. Language arrays describe explicitly available tracks, not selected tracks. Use ISO language codes, optionally with region tags; omit unknown metadata. Empty subtitle arrays mean known no subtitles. Do not infer languages from provider names. The endpoint must permit the Niho origin via CORS. Invalid/unavailable/empty responses fall back to the existing HLS URL; cancellation is preserved. Configure only a trusted endpoint.

Matching both preferences ranks first; audio/subtitle priority breaks single-match ties; balanced gives them equal weight. Unknown metadata precedes known mismatches. Stable sorting preserves backend order on ties, including quality ordering. No sources are filtered by language. Actual HLS track selection uses saved preferences, with default audio and subtitles off when unavailable.

Source requests capture preferences when fetched. In-player changes update track selection and source menu/fallback ranking without replacing an active or manually selected stream. Failed URLs are excluded from automatic fallback for that player session; explicit Retry can retry the current source. HLS quality selection remains separate from provider selection. Available subtitle metadata is labelled separately from checked subtitle tracks. Downloads use the owning profile's preferences even if the active profile changes.

Limitations: the default HLS-only API exposes no provider list, so Niho cannot rank providers until the optional metadata endpoint exists. Native-browser audio selection remains browser-controlled where hls.js is unsupported. Existing HLS recovery and quality adaptation remain in place. No Cinepro repository changes are included.



External subtitles (2026-11-26): discovery sources may include `subtitles: [{url, format: "vtt", label, language?}]`. Cinepro provides protected URLs and converts supported SRT files to VTT. The player lists these alongside embedded tracks, fetches only the selected track, renders cues through the existing overlay, and removes tracks and blob URLs on Off/source changes. Failed subtitle requests leave video playback running and show a subtitle-menu message. External tracks are for online playback; offline subtitle packaging has not been extended by this change.
