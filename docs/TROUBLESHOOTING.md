# Troubleshooting

## Missing TMDB key

If Niho reports that a TMDB key is missing:

1. Confirm `.env.local` exists beside `package.json`.
2. Set `VITE_TMDB_API_KEY` to a valid TMDB v3 key or v4 read token.
3. Restart `npm run dev`.

Do not include the key in an issue or support request.

## TMDB errors

- `401`: the credential is missing, invalid, or rejected.
- `404`: the title is not available from TMDB.
- `429`: TMDB rate limiting; retry later.

Check browser DevTools for the request URL and status without sharing the
credential.

## CinePro connection failures

Confirm CinePro is running and reachable from the same browser or phone.
Movie and TV URLs must use the Core paths:

```text
/streams/movie/{id}/master.m3u8
/streams/tv/{id}/{season}/{episode}/master.m3u8
```

For an Android device connected by USB to a computer running CinePro:

```bash
adb reverse tcp:3000 tcp:3000
```

For a phone using a private VPN, configure the frontend's CinePro host to a
reachable VPN address and rebuild the app.

## CORS and mixed content

The browser must be allowed to request TMDB and CinePro from the Niho origin.
Inspect DevTools for CORS errors. Do not work around CORS by exposing private
services publicly. Use a correctly configured private deployment or HTTPS.

The Android project currently enables cleartext traffic for the development
HTTP CinePro endpoint. Production deployments should use HTTPS and narrow that
permission.

## HLS playback

The player uses hls.js in Chrome, Edge, Opera, and other browsers without
native HLS. Safari may use native HLS when hls.js is unavailable. Check the
console for:

- `FINAL_STREAM_URL`
- `MANIFEST_LOADING`
- `MANIFEST_PARSED`
- `LEVEL_LOADED`
- `FRAG_LOADED`
- HLS `ERROR` details

Codec errors may indicate that the browser or Android WebView cannot decode
the stream even when the manifest is reachable. Network errors may indicate
that a nested playlist or segment URL is unavailable.

## Android build and device

- Run `adb devices` and confirm the device is authorized.
- Enable USB debugging.
- Run `npm run android:apk` after web-source changes.
- Reinstall the generated debug APK.
- Confirm the phone can reach the configured CinePro host.

## Development server

Port 5173 is used by Vite development mode. Port 5174 is used by Playwright.
If a port is busy, stop the existing process or choose an explicit port for
the command and update the URL you open.

