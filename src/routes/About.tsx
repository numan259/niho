import { ROWS } from '../catalog/rows'
import { OPEN_MOVIES } from '../providers/openMovies'
import { BackButton } from '../ui/layout'
import { Logo } from '../ui/Logo'

export default function About() {
  return (
    <div className="page page--about">
      <header className="page__head">
        <BackButton />
        <h1 className="page__title">Sources &amp; credits</h1>
      </header>

      <div className="prose">
        <Logo size={30} />
        <p>
          Niho is a personal, non‑commercial portfolio project. It only streams videos that are in the <strong>public domain</strong> or
          released under a <strong>Creative Commons</strong> license. Niho hosts no video itself — everything streams directly from the
          source below.
        </p>

        <h2>Internet Archive</h2>
        <p>
          Films and TV come from the <a href="https://archive.org/details/movies">Internet Archive</a> collections{' '}
          {ROWS.filter((r) => r.collections.length)
            .flatMap((r) => r.collections)
            .map((c, i, all) => (
              <span key={c}>
                <code>{c}</code>
                {i < all.length - 1 ? ', ' : ''}
              </span>
            ))}
          . Every query is filtered to items whose license field is public domain or Creative Commons; anything else is never shown.
          Licenses are declared by uploaders, so each title links to its source page and license for verification.
        </p>

        <h2>Blender open movies</h2>
        <ul>
          {OPEN_MOVIES.map((m) => (
            <li key={m.key}>
              <strong>{m.name}</strong> ({m.year}) — {m.credit}, <a href={m.license.url}>{m.license.label}</a>,{' '}
              <a href={m.sourcePage}>source</a>
            </li>
          ))}
        </ul>
        <p>
          Adaptive (HLS) streams of <em>Big Buck Bunny</em> and <em>Tears of Steel</em> are public test streams provided by{' '}
          <a href="https://test-streams.mux.dev">Mux</a> and <a href="https://demo.unified-streaming.com">Unified Streaming</a>.
        </p>

        <h2>Not affiliated</h2>
        <p>
          Niho is not affiliated with any streaming service. Found a title that shouldn’t be here? Report it to the source site and it
          will disappear from Niho once its license changes.
        </p>
      </div>
    </div>
  )
}
