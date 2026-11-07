import type { SeasonSummary } from '../../providers'

export function nextEpisode(seasons: SeasonSummary[], season: number, episode: number) {
  const current = seasons.find((item) => item.number === season)
  if (current && episode < current.episodeCount) return { season, episode: episode + 1, episodeCount: current.episodeCount }
  const following = [...seasons].sort((a, b) => a.number - b.number).find((item) => item.number > season && item.episodeCount > 0)
  return following ? { season: following.number, episode: 1, episodeCount: following.episodeCount } : undefined
}
