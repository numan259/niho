import { detectRegion } from '../providers/tmdb'
import { BackButton } from '../ui/layout'
import { Logo } from '../ui/Logo'

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export default function About() {
  const region = detectRegion()
  return (
    <div className="page page--about">
      <header className="page__head">
        <BackButton />
        <h1 className="page__title">About &amp; credits</h1>
      </header>

      <div className="prose">
        <Logo size={30} />
        <p>
          Niho is a non‑commercial portfolio project for discovering films and series: browse what’s trending, watch official
          trailers, keep a list, and see where each title is legally available to stream, rent or buy.
        </p>

        <h2>Film &amp; TV data</h2>
        <a className="tmdb-credit" href="https://www.themoviedb.org" target="_blank" rel="noreferrer" aria-label="The Movie Database (TMDB)">
          <img src="/tmdb-logo.svg" alt="TMDB" width="180" height="24" />
        </a>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>

        <h2>Where to watch</h2>
        <p>
          Streaming, rental and purchase availability is provided by{' '}
          <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
            JustWatch
          </a>{' '}
          through TMDB, for your region ({regionNames?.of(region) ?? region}). Provider links open the title’s TMDB watch page.
        </p>

        <h2>Trailers</h2>
        <p>
          Trailers are the official videos listed on TMDB and play through YouTube’s embedded player (privacy‑enhanced mode). Niho
          does not host or stream any films or episodes.
        </p>

        <h2>Your data</h2>
        <p>
          Profiles, My List, likes and watch progress are stored only on this device. There are no accounts and nothing is sent to a
          Niho server.
        </p>

        <h2>Not affiliated</h2>
        <p>Niho is not affiliated with TMDB, JustWatch, YouTube or any streaming service.</p>
      </div>
    </div>
  )
}
