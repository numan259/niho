import type { TitleSummary } from '../providers'

export const titlePath = (t: Pick<TitleSummary, 'provider' | 'id'>) => `/title/${t.provider}/${encodeURIComponent(t.id)}`

export const watchPath = (t: Pick<TitleSummary, 'provider' | 'id'>, episode = 0) =>
  `/watch/${t.provider}/${encodeURIComponent(t.id)}${episode ? `?ep=${episode}` : ''}`
