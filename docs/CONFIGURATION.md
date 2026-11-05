# Configuration

## Environment variables

| Variable | Required | Description | Example |
|---|---:|---|---|
| `VITE_TMDB_API_KEY` | Yes | TMDB v3 API key or v4 read access token used by the browser client | `your_tmdb_api_key_here` |
| `VITE_CINEPRO_URL` | For playback | CinePro Core base URL; defaults to `http://localhost:3000` | `http://localhost:3000` |

Create `.env.local` from `.env.example`. Both `.env` and `.env.local` are
ignored by Git. Restart Vite after changing either file.

Vite embeds `VITE_*` values into the built application. Do not treat this
credential as a server-only secret.

## CinePro

The companion [CinePro project](https://github.com/numan259/cinepro) is the
backend responsible for resolving and serving HLS media. Set `VITE_CINEPRO_URL`
in `.env.local` to a reachable CinePro Core deployment. The provider appends:

```text
http://<host>:3000/streams/movie/{tmdbId}/master.m3u8
http://<host>:3000/streams/tv/{tmdbId}/{season}/{episode}/master.m3u8
```

The frontend does not accept provider URLs directly. hls.js loads the Core
HLS URL and its rewritten nested playlists and segments.

On Android, `localhost` refers to the phone. Use a reachable LAN/VPN address or
`adb reverse tcp:3000 tcp:3000` for a USB-connected development server.
Restart Vite after configuration changes; rebuild and reinstall the APK to update
the Android app's bundled configuration.

## Local state

No environment variables configure profiles or library data. Those values are
stored in browser or Android local storage and are device-specific.
