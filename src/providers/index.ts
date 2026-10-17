import { getArchiveTitle } from './archive'
import { getOpenMovie } from './openMovies'
import type { Provider, TitleDetail, TitleSummary } from './types'

export * from './types'

export async function getTitle(provider: Provider, id: string, signal?: AbortSignal): Promise<TitleDetail | null> {
  if (provider === 'open') return getOpenMovie(id)
  return getArchiveTitle(id, signal)
}

export function isProvider(v: string | undefined): v is Provider {
  return v === 'archive' || v === 'open'
}

/** Strips a detail down to what lists and local storage need. */
export function toSummary(t: TitleSummary): TitleSummary {
  const { key, provider, id, name, kind, year, synopsis, tags, poster, backdrop, license } = t
  return { key, provider, id, name, kind, year, synopsis, tags, poster, backdrop, license }
}
