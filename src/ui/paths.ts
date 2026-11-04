import type { TitleSummary } from '../providers'

type Ref = Pick<TitleSummary, 'mediaType' | 'id'>

/** /title/movie/27205 or /title/tv/1396 */
export const titlePath = (t: Ref) => `/title/${t.mediaType}/${t.id}`

/**
 * /watch/movie/27205 plays the film's trailer;
 * /watch/tv/1396 plays the show trailer, /watch/tv/1396?s=1&e=3 an episode's clip.
 */
export const watchPath = (t: Ref, ep?: { season: number; episode: number }) =>
  `/watch/${t.mediaType}/${t.id}${t.mediaType === 'tv' && ep ? `?s=${ep.season}&e=${ep.episode}` : ''}`
