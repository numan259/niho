import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getTitle } from '../providers'
import type { Provider, SearchPage } from '../providers'
import { searchArchive } from '../providers/archive'
import { OPEN_MOVIES } from '../providers/openMovies'
import type { RowDef } from './rows'

const ROW_SIZE = 20
const PAGE_SIZE = 36

function loadRow(row: RowDef, page: number, rows: number, signal?: AbortSignal): Promise<SearchPage> {
  if (row.collections.length === 0) {
    return Promise.resolve({ items: OPEN_MOVIES, total: OPEN_MOVIES.length, page: 1, hasMore: false })
  }
  return searchArchive({ collections: row.collections, kind: row.kind, page, rows }, signal)
}

export function useRow(row: RowDef) {
  return useQuery({
    queryKey: ['row', row.id],
    queryFn: ({ signal }) => loadRow(row, 1, ROW_SIZE, signal),
  })
}

export function useBrowse(row: RowDef) {
  return useInfiniteQuery({
    queryKey: ['browse', row.id],
    queryFn: ({ pageParam, signal }) => loadRow(row, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}

export function useTitle(provider: Provider | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ['title', provider, id],
    queryFn: ({ signal }) => getTitle(provider!, id!, signal),
    enabled: Boolean(provider && id),
    staleTime: 60 * 60 * 1000,
  })
}

export function useSearch(text: string, collections: string[]) {
  const q = text.trim()
  return useInfiniteQuery({
    queryKey: ['search', q, collections],
    queryFn: ({ pageParam, signal }) => searchArchive({ collections, text: q, page: pageParam, rows: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  })
}
