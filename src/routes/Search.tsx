import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRow, useSearch } from '../catalog/queries'
import { getRow, KIDS_COLLECTIONS, SEARCH_COLLECTIONS } from '../catalog/rows'
import { useActiveProfile } from '../state/profiles'
import { Artwork } from '../ui/Artwork'
import { titlePath, watchPath } from '../ui/paths'
import { Gallery } from '../ui/Gallery'
import { Icon } from '../ui/Icon'
import { ErrorMessage, Message, Spinner } from '../ui/States'

const RECENT_KEY = 'niho.recentSearches'

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export default function Search() {
  const profile = useActiveProfile()!
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(text)
  const [recent, setRecent] = useState(readRecent)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(text)
      setParams(text.trim() ? { q: text } : {}, { replace: true })
    }, 350)
    return () => window.clearTimeout(id)
  }, [text, setParams])

  const collections = profile.kids ? KIDS_COLLECTIONS : SEARCH_COLLECTIONS
  const q = useSearch(debounced, collections)
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const active = debounced.trim().length >= 2

  /** Remember a search once the user acts on it (submits or opens a result). */
  function remember() {
    const term = debounced.trim()
    if (term.length < 2 || items.length === 0) return
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 6)
    setRecent(next)
    writeRecent(next)
  }

  return (
    <div className="page page--search">
      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          remember()
        }}
      >
        <Icon name="search" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={profile.kids ? 'Search cartoons' : 'Search films, series, genres…'}
          aria-label="Search"
          autoFocus
          enterKeyHint="search"
        />
        {text && (
          <button type="button" className="icon-btn" onClick={() => setText('')} aria-label="Clear search">
            <Icon name="close" size={18} />
          </button>
        )}
      </form>

      {!active ? (
        <>
          {recent.length > 0 && (
            <section className="recent">
              <h2 className="section-title">Recent searches</h2>
              <div className="chips chips--wrap">
                {recent.map((r) => (
                  <button key={r} className="chip" onClick={() => setText(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <Recommended kids={profile.kids} />
        </>
      ) : q.isPending ? (
        <Spinner />
      ) : q.error ? (
        <ErrorMessage error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <Message title="Nothing found">
          Try another title, genre or year — e.g. “noir”, “western”, “1950”.
        </Message>
      ) : (
        <div onClickCapture={remember}>
          <h2 className="section-title">Films &amp; Series</h2>
          <Gallery items={items} hasMore={q.hasNextPage} loading={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />
        </div>
      )}
    </div>
  )
}

/** Empty-state list: popular titles with a direct play button. */
function Recommended({ kids }: { kids: boolean }) {
  const { data, isPending } = useRow(getRow(kids ? 'cartoons' : 'films')!)
  if (isPending) return <Spinner />
  return (
    <section>
      <h2 className="section-title">Recommended</h2>
      <ul className="list">
        {(data?.items ?? []).slice(0, 10).map((t) => (
          <li key={t.key} className="list__item">
            <Link to={titlePath(t)} className="list__link">
              <Artwork src={t.poster} title={t.name} className="list__art" />
              <span className="list__name">{t.name}</span>
            </Link>
            <Link to={watchPath(t)} className="icon-btn list__play" aria-label={`Play ${t.name}`}>
              <Icon name="play" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
