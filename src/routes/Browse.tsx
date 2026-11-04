import { useParams } from 'react-router-dom'
import { useBrowse } from '../catalog/queries'
import { getRow } from '../catalog/rows'
import { mergePages } from '../providers/tmdb'
import { Gallery } from '../ui/Gallery'
import { BackButton } from '../ui/layout'
import { ErrorMessage, Message, Spinner } from '../ui/States'

export default function Browse() {
  const row = getRow(useParams().rowId)
  if (!row) return <Message title="Nothing here" />
  return <BrowseRow key={row.id} row={row} />
}

function BrowseRow({ row }: { row: NonNullable<ReturnType<typeof getRow>> }) {
  const q = useBrowse(row)
  const items = mergePages(q.data?.pages)
  const total = q.data?.pages[0]?.total
  return (
    <div className="page">
      <header className="page__head">
        <BackButton />
        <div>
          <h1 className="page__title">{row.title}</h1>
          {total !== undefined && <p className="page__sub">{total.toLocaleString()} titles</p>}
        </div>
      </header>
      {q.isPending ? (
        <Spinner />
      ) : q.error ? (
        <ErrorMessage error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Gallery items={items} hasMore={q.hasNextPage} loading={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />
      )}
    </div>
  )
}
