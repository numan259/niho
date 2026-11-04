import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEpisodeVideos, useSeason, useTitle } from '../catalog/queries'
import { isMediaType, parseTmdbId, videoSources } from '../providers'
import { useLibrary } from '../state/library'
import { titlePath, watchPath } from '../ui/paths'
import { VideoPlayer } from '../ui/player/VideoPlayer'
import { ErrorMessage, Message, Spinner } from '../ui/States'
import { useGoBack } from '../ui/useGoBack'

/**
 * /watch/movie/:id            → the film's best trailer
 * /watch/tv/:id               → the series trailer
 * /watch/tv/:id?s=1&e=3       → that episode's clip (season clip, then series trailer as fallbacks)
 */
export default function Watch() {
  const params = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const lib = useLibrary()

  const mediaType = isMediaType(params.mediaType) ? params.mediaType : undefined
  const tmdbId = parseTmdbId(params.id)
  const season = mediaType === 'tv' ? parseTmdbId(search.get('s') ?? undefined) : undefined
  const episode = season !== undefined ? parseTmdbId(search.get('e') ?? undefined) : undefined
  const isEpisode = season !== undefined && episode !== undefined

  const title = useTitle(mediaType, tmdbId)
  const clips = useEpisodeVideos(isEpisode ? tmdbId : undefined, season, episode)
  const seasonEpisodes = useSeason(tmdbId ?? 0, isEpisode ? season : undefined)

  if (!mediaType || !tmdbId) return <Message title="Title not found" />
  if (title.isPending || (isEpisode && clips.isPending)) {
    return (
      <div className="player player--loading">
        <Spinner />
      </div>
    )
  }
  if (title.error) return <ErrorMessage error={title.error} onRetry={() => title.refetch()} />
  const t = title.data
  if (!t) return <Message title="Title not found" />

  // Episode clips are rare on TMDB, so fall back to the show's own trailers.
  const videos = clips.data?.length ? clips.data : t.videos
  if (videos.length === 0) {
    return (
      <Message title="No trailer available" action={<Link className="btn btn--secondary" to={titlePath(t)}>Back to {t.name}</Link>}>
        TMDB doesn’t list a playable trailer for this title yet.
      </Message>
    )
  }

  const epIndex = isEpisode ? episode - 1 : 0
  const epCount = isEpisode ? (t.seasons.find((s) => s.number === season)?.episodeCount ?? episode) : 1
  const epInfo = seasonEpisodes.data?.find((e) => e.number === episode)
  const subtitle = isEpisode ? `S${season}:E${episode}${epInfo ? ` · ${epInfo.name}` : ''}` : t.year ? String(t.year) : undefined

  const entry = lib.progress[t.key]
  const startAt = entry && !entry.upNext && entry.season === season && entry.episodeIndex === epIndex ? entry.position : 0
  const nextEp = isEpisode && episode < epCount ? { season, episode: episode + 1 } : undefined

  return (
    <VideoPlayer
      key={`${t.key}#${season ?? 0}-${episode ?? 0}`}
      sources={videoSources(videos)}
      title={t.name}
      subtitle={subtitle}
      poster={t.backdrop ?? t.poster}
      startAt={startAt}
      sourcePage={t.sourcePage}
      onBack={goBack}
      onProgress={(position, duration) =>
        lib.saveProgress({
          title: t,
          season,
          episodeIndex: epIndex,
          episodeCount: epCount,
          episodeLabel: isEpisode ? subtitle : undefined,
          position,
          duration,
        })
      }
      onEnded={() => {
        if (nextEp) navigate(watchPath(t, nextEp), { replace: true })
        else navigate(titlePath(t), { replace: true })
      }}
      next={nextEp ? { label: `Next: S${nextEp.season}:E${nextEp.episode}`, onSelect: () => navigate(watchPath(t, nextEp), { replace: true }) } : undefined}
    />
  )
}
