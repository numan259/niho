import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useRecommendations, useSeason, useTitle } from '../catalog/queries'
import { isNative } from '../native'
import { isMediaType, parseTmdbId, type TitleDetail, type WatchAvailability, type WatchProvider } from '../providers'
import { useLibrary } from '../state/library'
import { Artwork } from '../ui/Artwork'
import { TitleCard } from '../ui/cards'
import { Icon } from '../ui/Icon'
import { BackButton } from '../ui/layout'
import { watchPath } from '../ui/paths'
import { formatClock, formatRuntime } from '../ui/player/time'
import { Row } from '../ui/sections/Row'
import { ErrorMessage, Message, RowSkeleton, Spinner } from '../ui/States'

export default function Title() {
  const params = useParams()
  const mediaType = isMediaType(params.mediaType) ? params.mediaType : undefined
  const id = parseTmdbId(params.id)
  const { data, error, isPending, refetch } = useTitle(mediaType, id)

  if (!mediaType || !id) return <Message title="Title not found" />
  if (isPending) return <Spinner />
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />
  if (!data) {
    return <Message title="Title not found" action={<Link className="btn btn--secondary" to="/">Back to Home</Link>} />
  }
  return <TitleView key={data.key} title={data} />
}

type Tab = 'episodes' | 'cast' | 'more'

function TitleView({ title: t }: { title: TitleDetail }) {
  const lib = useLibrary()
  const navigate = useNavigate()
  const isSeries = t.mediaType === 'tv'
  const [tab, setTab] = useState<Tab>(isSeries && t.seasons.length ? 'episodes' : 'more')
  const [expanded, setExpanded] = useState(false)
  const [shared, setShared] = useState(false)

  const entry = lib.progress[t.key]
  const inList = lib.inMyList(t.key)
  const liked = lib.isLiked(t.key)
  const hasTrailer = t.videos.length > 0
  const resumeEp = entry?.season !== undefined ? { season: entry.season, episode: entry.episodeIndex + 1 } : undefined
  const play = () => navigate(watchPath(t, resumeEp))

  const runtime = isSeries
    ? t.seasons.length
      ? `${t.seasons.length} season${t.seasons.length > 1 ? 's' : ''}`
      : undefined
    : formatRuntime(t.runtimeMin ? t.runtimeMin * 60 : undefined)

  async function share() {
    // In the Android app the page URL is local to the device, so share the public TMDB page.
    const url = isNative ? t.sourcePage : window.location.href
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
        {hasTrailer && (
          <button className="title-page__hero-play" onClick={play} aria-label={`Play trailer for ${t.name}`}>
            <Icon name="play" size={34} />
          </button>
        )}
      </div>

      <div className="title-page__body">
        <h1 className="title-page__name">{t.name}</h1>
        {t.tagline && <p className="title-page__tagline">{t.tagline}</p>}
        <p className="title-page__meta">
          {t.year && <span>{t.year}</span>}
          {runtime && <span>{runtime}</span>}
          {t.certification && <span className="badge">{t.certification}</span>}
          {t.rating && (
            <span className="rating" aria-label={`TMDB user score ${t.rating} out of 10`}>
              <span aria-hidden="true">★</span> {t.rating}
            </span>
          )}
        </p>

        {hasTrailer ? (
          <div className="title-page__primary">
            <button className="btn btn--primary btn--block" onClick={play}>
              <Icon name="play" size={22} />
              {entry && !entry.upNext ? 'Resume trailer' : 'Play trailer'}
            </button>
            {entry && !entry.upNext && entry.duration > 0 && (
              <div className="title-page__resume">
                <span className="progress">
                  <span style={{ width: `${(entry.position / entry.duration) * 100}%` }} />
                </span>
                <span>
                  {resumeEp ? `S${resumeEp.season}:E${resumeEp.episode} · ` : ''}
                  {formatClock(entry.position)} of {formatClock(entry.duration)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="title-page__note">No trailer is listed for this title yet.</p>
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
        {t.makers.length > 0 && (
          <p className="title-page__credits">
            <span>{isSeries ? 'Created by' : 'Directed by'}</span> {t.makers.join(', ')}
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
            <span>TMDB</span>
          </a>
        </div>

        <WhereToWatch watch={t.watch} />

        <div className="tabs" role="tablist">
          {isSeries && t.seasons.length > 0 && (
            <button role="tab" aria-selected={tab === 'episodes'} className="tabs__tab" onClick={() => setTab('episodes')}>
              Episodes
            </button>
          )}
          {t.cast.length > 0 && (
            <button role="tab" aria-selected={tab === 'cast'} className="tabs__tab" onClick={() => setTab('cast')}>
              Cast
            </button>
          )}
          <button role="tab" aria-selected={tab === 'more'} className="tabs__tab" onClick={() => setTab('more')}>
            More Like This
          </button>
        </div>

        {tab === 'episodes' && isSeries ? <Episodes title={t} /> : tab === 'cast' ? <Cast title={t} /> : <MoreLikeThis title={t} />}

        <p className="attribution">
          Metadata and images from{' '}
          <a href={t.sourcePage} target="_blank" rel="noreferrer">
            TMDB
          </a>
          . Trailers play from YouTube.
        </p>
      </div>
    </div>
  )
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

function WhereToWatch({ watch }: { watch?: WatchAvailability }) {
  const groups: [string, WatchProvider[]][] = watch
    ? ([
        ['Stream', watch.stream],
        ['Free', watch.free],
        ['Rent', watch.rent],
        ['Buy', watch.buy],
      ] as [string, WatchProvider[]][]).filter(([, list]) => list.length > 0)
    : []
  const region = watch ? (regionNames?.of(watch.region) ?? watch.region) : 'your country'

  return (
    <section className="where" aria-labelledby="where-title">
      <h2 id="where-title" className="where__title">
        Where to watch
      </h2>
      {groups.length === 0 ? (
        <p className="where__empty">Not available to stream, rent or buy in {region} right now.</p>
      ) : (
        groups.map(([label, providers]) => (
          <div key={label} className="where__group">
            <span className="where__label">{label}</span>
            <ul className="where__providers">
              {providers.map((p) => (
                <li key={p.id}>
                  <a className="provider" href={watch?.link} target="_blank" rel="noreferrer" title={p.name} aria-label={`${label} on ${p.name}`}>
                    {p.logo ? <img src={p.logo} alt="" loading="lazy" /> : <span>{p.name.charAt(0)}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="where__source">
        Availability in {region}. Data by{' '}
        <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
          JustWatch
        </a>
        .
      </p>
    </section>
  )
}

function Episodes({ title: t }: { title: TitleDetail }) {
  const lib = useLibrary()
  const entry = lib.progress[t.key]
  const [season, setSeason] = useState(entry?.season ?? t.seasons[0]?.number)
  const { data, isPending, error, refetch } = useSeason(t.id, season)

  return (
    <div className="episodes-panel">
      {t.seasons.length > 1 && (
        <label className="select">
          <span className="visually-hidden">Season</span>
          <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
            {t.seasons.map((s) => (
              <option key={s.number} value={s.number}>
                {s.name} ({s.episodeCount} episodes)
              </option>
            ))}
          </select>
        </label>
      )}
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : (
        <ol className="episodes">
          {data.map((ep) => {
            const current = entry?.season === ep.season && entry.episodeIndex === ep.number - 1 && !entry.upNext && entry.duration > 0
            return (
              <li key={ep.number}>
                <Link className="episode" to={watchPath(t, { season: ep.season, episode: ep.number })} aria-label={`Play preview for episode ${ep.number}: ${ep.name}`}>
                  <Artwork src={ep.still} title={`E${ep.number}`} className="episode__still" />
                  <span className="episode__text">
                    <span className="episode__name">
                      {ep.number}. {ep.name}
                    </span>
                    <span className="episode__sub">
                      S{ep.season}:E{ep.number}
                      {ep.runtimeMin ? ` · ${ep.runtimeMin} min` : ''}
                    </span>
                    {ep.overview && <span className="episode__overview">{ep.overview}</span>}
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
      )}
    </div>
  )
}

function Cast({ title: t }: { title: TitleDetail }) {
  return (
    <ul className="cast">
      {t.cast.map((c) => (
        <li key={c.id} className="cast__item">
          <Artwork src={c.photo} title={c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} className="cast__photo" />
          <span className="cast__name">{c.name}</span>
          {c.character && <span className="cast__role">{c.character}</span>}
        </li>
      ))}
    </ul>
  )
}

function MoreLikeThis({ title }: { title: TitleDetail }) {
  const { data, isPending } = useRecommendations(title.mediaType, title.id)
  if (!isPending && !data?.length) return <p className="title-page__note">No recommendations yet.</p>
  return (
    <Row title="More Like This">
      {isPending ? <RowSkeleton /> : data!.map((t) => <TitleCard key={t.key} title={t} />)}
    </Row>
  )
}
