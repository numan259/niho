import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTitle } from '../catalog/queries'
import { SEARCH_COLLECTIONS } from '../catalog/rows'
import { isProvider, type TitleDetail } from '../providers'
import { searchArchive } from '../providers/archive'
import { needsAttribution } from '../providers/license'
import { OPEN_MOVIES } from '../providers/openMovies'
import { useLibrary } from '../state/library'
import { Artwork } from '../ui/Artwork'
import { TitleCard } from '../ui/cards'
import { watchPath } from '../ui/paths'
import { Icon } from '../ui/Icon'
import { BackButton } from '../ui/layout'
import { formatClock, formatRuntime } from '../ui/player/time'
import { Row } from '../ui/sections/Row'
import { ErrorMessage, Message, RowSkeleton, Spinner } from '../ui/States'

export default function Title() {
  const { provider, id } = useParams()
  const valid = isProvider(provider)
  const { data, error, isPending, refetch } = useTitle(valid ? provider : undefined, id)

  if (!valid) return <Message title="Title not found" />
  if (isPending) return <Spinner />
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />
  if (!data) {
    return (
      <Message title="Not available on Niho" action={<Link className="btn btn--secondary" to="/">Back to Home</Link>}>
        This item isn’t marked public domain or Creative Commons, so Niho doesn’t show it.
      </Message>
    )
  }
  return <TitleView key={data.key} title={data} />
}

function TitleView({ title: t }: { title: TitleDetail }) {
  const lib = useLibrary()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'episodes' | 'more'>(t.kind === 'series' ? 'episodes' : 'more')
  const [expanded, setExpanded] = useState(false)
  const [shared, setShared] = useState(false)

  const entry = lib.progress[t.key]
  const resumeEp = entry ? t.episodes[entry.episodeIndex] : undefined
  const inList = lib.inMyList(t.key)
  const liked = lib.isLiked(t.key)
  const playable = t.episodes.length > 0
  const runtime = t.kind === 'movie' ? formatRuntime(t.episodes[0]?.durationSec) : `${t.episodes.length} episodes`

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: t.name, url })
      else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        window.setTimeout(() => setShared(false), 2000)
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="title-page">
      <div className="title-page__hero">
        <Artwork src={t.backdrop ?? t.poster} title={t.name} priority />
        <div className="title-page__back">
          <BackButton />
        </div>
        {playable && (
          <button className="title-page__hero-play" onClick={() => navigate(watchPath(t, entry?.episodeIndex ?? 0))} aria-label={`Play ${t.name}`}>
            <Icon name="play" size={34} />
          </button>
        )}
      </div>

      <div className="title-page__body">
        <h1 className="title-page__name">{t.name}</h1>
        <p className="title-page__meta">
          {t.year && <span>{t.year}</span>}
          {runtime && <span>{runtime}</span>}
          <a className="badge" href={t.license.url} target="_blank" rel="noreferrer" title="View license">
            {t.license.label}
          </a>
        </p>

        {playable ? (
          <div className="title-page__primary">
            <button className="btn btn--primary btn--block" onClick={() => navigate(watchPath(t, entry?.episodeIndex ?? 0))}>
              <Icon name="play" size={22} />
              {entry && !entry.upNext ? 'Resume' : entry?.upNext ? `Play episode ${entry.episodeIndex + 1}` : 'Play'}
            </button>
            {entry && !entry.upNext && entry.duration > 0 && (
              <div className="title-page__resume">
                <span className="progress">
                  <span style={{ width: `${(entry.position / entry.duration) * 100}%` }} />
                </span>
                <span>
                  {t.kind === 'series' && resumeEp ? `E${entry.episodeIndex + 1} · ` : ''}
                  {formatClock(entry.position)} of {formatClock(entry.duration)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <Message title="No playable video">
            This item has no browser‑playable file. You can still watch it on the{' '}
            <a href={t.sourcePage} target="_blank" rel="noreferrer">
              source site
            </a>
            .
          </Message>
        )}

        {t.synopsis && (
          <p className={`title-page__synopsis ${expanded ? 'is-expanded' : ''}`}>
            {t.synopsis}
            {t.synopsis.length > 220 && (
              <button className="link-btn" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'less' : 'more'}
              </button>
            )}
          </p>
        )}
        {t.tags.length > 0 && <p className="title-page__tags">{t.tags.join('  •  ')}</p>}

        <div className="actions">
          <button className="action" onClick={() => lib.toggleMyList(t)} aria-pressed={inList}>
            <Icon name={inList ? 'check' : 'plus'} size={26} />
            <span>My List</span>
          </button>
          <button className="action" onClick={() => lib.toggleLiked(t)} aria-pressed={liked}>
            <Icon name="thumb" size={26} filled={liked} />
            <span>{liked ? 'Liked' : 'Like'}</span>
          </button>
          <button className="action" onClick={share}>
            <Icon name="share" size={26} />
            <span>{shared ? 'Link copied' : 'Share'}</span>
          </button>
          <a className="action" href={t.sourcePage} target="_blank" rel="noreferrer">
            <Icon name="external" size={26} />
            <span>Source</span>
          </a>
        </div>

        <div className="tabs" role="tablist">
          {t.kind === 'series' && (
            <button role="tab" aria-selected={tab === 'episodes'} className="tabs__tab" onClick={() => setTab('episodes')}>
              Episodes
            </button>
          )}
          <button role="tab" aria-selected={tab === 'more'} className="tabs__tab" onClick={() => setTab('more')}>
            More Like This
          </button>
        </div>

        {tab === 'episodes' && t.kind === 'series' ? (
          <ol className="episodes">
            {t.episodes.map((ep) => {
              const current = entry?.episodeIndex === ep.index && !entry.upNext && entry.duration > 0
              return (
                <li key={ep.index}>
                  <Link className="episode" to={watchPath(t, ep.index)} aria-label={`Play episode ${ep.index + 1}: ${ep.name}`}>
                    <span className="episode__num">{ep.index + 1}</span>
                    <span className="episode__text">
                      <span className="episode__name">{ep.name}</span>
                      <span className="episode__sub">
                        {ep.season && ep.number ? `S${ep.season}:E${ep.number} · ` : ''}
                        {formatRuntime(ep.durationSec) ?? ''}
                      </span>
                      {current && (
                        <span className="progress">
                          <span style={{ width: `${(entry.position / entry.duration) * 100}%` }} />
                        </span>
                      )}
                    </span>
                    <Icon name="play" size={20} />
                  </Link>
                </li>
              )
            })}
          </ol>
        ) : (
          <MoreLikeThis title={t} />
        )}

        <section className="about-title">
          <h2>About this title</h2>
          <p>
            <strong>License:</strong>{' '}
            <a href={t.license.url} target="_blank" rel="noreferrer">
              {t.license.label}
            </a>
            {needsAttribution(t.license) && t.credit && <> — {t.credit}</>}
          </p>
          <p>
            <strong>Source:</strong>{' '}
            <a href={t.sourcePage} target="_blank" rel="noreferrer">
              {new URL(t.sourcePage).hostname}
            </a>
          </p>
          <p className="about-title__note">License information is provided by the uploader on the source site.</p>
        </section>
      </div>
    </div>
  )
}

function MoreLikeThis({ title }: { title: TitleDetail }) {
  const tag = title.tags[0]
  const q = useQuery({
    queryKey: ['similar', title.key, tag],
    queryFn: ({ signal }) =>
      title.provider === 'open'
        ? Promise.resolve(OPEN_MOVIES.filter((m) => m.key !== title.key))
        : searchArchive({ collections: SEARCH_COLLECTIONS, text: tag ?? title.name.split(' ')[0], rows: 16 }, signal).then((p) =>
            p.items.filter((i) => i.key !== title.key),
          ),
  })
  return (
    <Row title="More Like This">
      {q.isPending ? <RowSkeleton /> : (q.data ?? []).map((t) => <TitleCard key={t.key} title={t} />)}
    </Row>
  )
}
