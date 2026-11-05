import { Link, useNavigate } from 'react-router-dom'
import type { Section } from '../../catalog/pages'
import { useRow, useTitle } from '../../catalog/queries'
import type { RowDef } from '../../catalog/rows'
import { continueWatching, useLibrary } from '../../state/library'
import { Artwork } from '../Artwork'
import { ContinueCard, TitleCard } from '../cards'
import { titlePath, watchPath } from '../paths'
import { Icon } from '../Icon'
import { ErrorMessage, RowSkeleton } from '../States'
import { Row } from './Row'

export function SectionRenderer({ section }: { section: Section }) {
  switch (section.variant) {
    case 'billboard':
      return <Billboard row={section.row} />
    case 'continue':
      return <ContinueRow title={section.title} />
    case 'my-list':
      return <MyListRow title={section.title} />
    case 'carousel':
      return <Carousel row={section.row} />
  }
}

export function Carousel({ row }: { row: RowDef }) {
  const { data, error, isPending, refetch } = useRow(row)
  if (error) {
    return (
      <Row title={row.title}>
        <ErrorMessage error={error} onRetry={() => refetch()} />
      </Row>
    )
  }
  return (
    <Row title={row.title} seeAll={`/browse/${row.id}`}>
      {isPending ? <RowSkeleton /> : data.items.map((t) => <TitleCard key={t.key} title={t} />)}
    </Row>
  )
}

function ContinueRow({ title }: { title: string }) {
  const lib = useLibrary()
  const entries = continueWatching(lib.progress)
  if (entries.length === 0) return null
  return (
    <Row title={title}>
      {entries.map((e) => (
        <ContinueCard key={e.title.key} entry={e} onRemove={() => lib.removeProgress(e.title.key)} />
      ))}
    </Row>
  )
}

function MyListRow({ title }: { title: string }) {
  const { myList } = useLibrary()
  if (myList.length === 0) return null
  return (
    <Row title={title} seeAll="/my">
      {myList.map((t) => (
        <TitleCard key={t.key} title={t} />
      ))}
    </Row>
  )
}

/** Picks a stable "title of the day" from the first items of a row. */
function dailyPick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined
  const day = Math.floor(Date.now() / 86_400_000)
  return items[day % Math.min(items.length, 8)]
}

function Billboard({ row }: { row: RowDef }) {
  const { data } = useRow(row)
  const pick = data ? dailyPick(data.items) : undefined
  const { data: detail } = useTitle(pick?.mediaType, pick?.id)
  const lib = useLibrary()
  const navigate = useNavigate()

  if (!pick) return <div className="billboard billboard--loading" aria-hidden="true" />
  const t = detail ?? pick
  const inList = lib.inMyList(t.key)

  return (
    <section className="billboard" aria-label={`Featured: ${t.name}`}>
      <Link to={titlePath(t)} className="billboard__art" aria-label={`Show details for ${t.name}`}>
        {/* Portrait card on phones uses the poster; the wide desktop banner uses the backdrop. */}
        <Artwork src={t.poster} title={t.name} className="billboard__img billboard__img--portrait" priority />
        <Artwork src={t.backdrop ?? t.poster} title={t.name} className="billboard__img billboard__img--wide" />
      </Link>
      <div className="billboard__content">
        <h1 className="billboard__title">{t.name}</h1>
        <p className="billboard__tags">
          {[t.mediaType === 'tv' ? 'Series' : 'Film', t.year, t.rating && `★ ${t.rating}`, ...t.tags.slice(0, 2)].filter(Boolean).join('  •  ')}
        </p>
        <div className="billboard__ctas">
          <button
            className="btn btn--primary"
            onClick={() => (t.mediaType === 'movie' ? navigate(watchPath(t)) : navigate(titlePath(t)))}
          >
            <Icon name="play" size={20} /> {t.mediaType === 'movie' ? 'Play movie' : 'View episodes'}
          </button>
          <button className="btn btn--secondary" onClick={() => lib.toggleMyList(t)} aria-pressed={inList}>
            <Icon name={inList ? 'check' : 'plus'} size={20} /> My List
          </button>
        </div>
      </div>
    </section>
  )
}
