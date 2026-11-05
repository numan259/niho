# Security Policy

## Scope

Niho is a client-side web application and Android shell. It does not provide
authentication, authorization, a server-side database, or a backend security
boundary.

## Protect credentials

- Keep `.env` and `.env.local` untracked.
- Use `.env.example` only as a placeholder template.
- Never paste TMDB credentials into issues, pull requests, screenshots, or
  logs.
- Remember that `VITE_*` values are embedded into web and Android builds and
  can be inspected by users.

## Network exposure

CinePro and Vite development servers should remain on a private network or
VPN during development. Do not expose them publicly without appropriate
authentication, authorization, rate limiting, monitoring, and HTTPS.

The Android build permits cleartext HTTP because the current CinePro
development endpoint uses HTTP. Production deployments should use HTTPS and
remove or narrow cleartext access.

## Reporting a vulnerability

Do not disclose exploitable details in a public issue. Contact the repository
maintainer privately with a description, affected component, reproduction
steps, and impact. Do not include credentials or personal data.

