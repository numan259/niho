import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getTitle } from '../providers'
import type { MediaType } from '../providers'
import { getCineProSources } from '../providers/cinepro'
import { fetchList, getEpisodeVideos, getRecommendations, getSeason, searchTitles } from '../providers/tmdb'
import type { RowDef } from './rows'

const HOUR = 60 * 60 * 1000

export function useRow(row: RowDef) {
  return useQuery({
    queryKey: ['row', row.id],
    queryFn: ({ signal }) => fetchList(row.source, 1, signal),
  })
}

export function useBrowse(row: RowDef) {
  return useInfiniteQuery({
    queryKey: ['browse', row.id],
    queryFn: ({ pageParam, signal }) => fetchList(row.source, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}

export function useTitle(mediaType: MediaType | undefined, id: number | undefined) {
  return useQuery({
    queryKey: ['title', mediaType, id],
    queryFn: ({ signal }) => getTitle(mediaType!, id!, signal),
    enabled: Boolean(mediaType && id),
    staleTime: HOUR,
  })
}

export function useSeason(tvId: number, season: number | undefined) {
  return useQuery({
    queryKey: ['season', tvId, season],
    queryFn: ({ signal }) => getSeason(tvId, season!, signal),
    enabled: season !== undefined,
    staleTime: HOUR,
  })
}

export function useCineProSources(
  mediaType: MediaType | undefined,
  tmdbId: number | undefined,
  season?: number,
  episode?: number,
) {
  return useQuery({
    queryKey: ['cinepro-sources', mediaType, tmdbId, season, episode],
    queryFn: ({ signal }) => getCineProSources(mediaType!, tmdbId!, season, episode, signal),
    enabled: Boolean(mediaType && tmdbId && (mediaType === 'movie' || (season !== undefined && episode !== undefined))),
  })
}

/** Episode / season clips for a series episode (empty when TMDB has none). */
export function useEpisodeVideos(tvId: number | undefined, season: number | undefined, episode: number | undefined) {
  return useQuery({
    queryKey: ['episode-videos', tvId, season, episode],
    queryFn: ({ signal }) => getEpisodeVideos(tvId!, season!, episode!, signal),
    enabled: Boolean(tvId && season !== undefined && episode !== undefined),
    staleTime: HOUR,
  })
}

export function useRecommendations(mediaType: MediaType, id: number) {
  return useQuery({
    queryKey: ['recommendations', mediaType, id],
    queryFn: ({ signal }) => getRecommendations(mediaType, id, signal),
    staleTime: HOUR,
  })
}

export function useSearch(text: string, kids: boolean) {
  const q = text.trim()
  return useInfiniteQuery({
    queryKey: ['search', q, kids],
    queryFn: ({ pageParam, signal }) => searchTitles(q, pageParam, { kids }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  })
}
