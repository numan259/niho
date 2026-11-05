# Configuration

## Environment variables

| Variable | Required | Description | Example |
|---|---:|---|---|
| `VITE_TMDB_API_KEY` | Yes | TMDB v3 API key or v4 read access token used by the browser client | `your_tmdb_api_key_here` |

Create `.env.local` from `.env.example`. Both `.env` and `.env.local` are
ignored by Git. Restart Vite after changing either file.

Vite embeds `VITE_*` values into the built application. Do not treat this
credential as a server-only secret.

## CinePro

The companion [CinePro project](https://github.com/numan259/cinepro) is the
backend responsible for resolving and serving HLS media. The current CinePro
base URL is a constant in `src/providers/cinepro.ts`.
It must point to a reachable CinePro Core deployment:

```text
http://<host>:3000/streams/movie/{tmdbId}/master.m3u8
http://<host>:3000/streams/tv/{tmdbId}/{season}/{episode}/master.m3u8
```

The frontend does not accept provider URLs directly. hls.js loads the Core
HLS URL and its rewritten nested playlists and segments.

## Local state

No environment variables configure profiles or library data. Those values are
stored in browser or Android local storage and are device-specific.
