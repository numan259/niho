# Contributing to Niho

## Before you start

1. Fork or clone the repository.
2. Install Node.js 24 and npm.
3. Run `npm ci`.
4. Copy `.env.example` to `.env.local` and add a TMDB credential.
5. Run the checks below before submitting a change.

## Development commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The Playwright suite mocks TMDB, image CDN, and YouTube requests. CinePro
playback is not required for the deterministic test suite.

## Change guidelines

- Keep changes focused and preserve existing behavior.
- Do not commit credentials, generated builds, local APKs, or personal URLs.
- Keep provider mapping pure and covered by tests where practical.
- Preserve accessible labels and keyboard behavior in UI changes.
- Keep movie and TV stream paths aligned with the CinePro contract.
- Update relevant documentation when commands or configuration change.

## Pull requests

Include:

- A short description of the change
- Testing commands and results
- Screenshots or recordings for visible UI changes
- Any required configuration or migration notes

## Bug reports

Include the operating system, browser or Android version, reproduction steps,
the relevant route, and sanitized console/network errors. Never attach API
keys, `.env` files, or private CinePro credentials.

