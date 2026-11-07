import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCineProSources, useSeason, useTitle } from '../catalog/queries'
import { isMediaType, parseTmdbId } from '../providers'
import { useLibrary } from '../state/library'
import { titlePath, watchPath } from '../ui/paths'
import { VideoPlayer } from '../ui/player/VideoPlayer'
import { ErrorMessage, Message, Spinner } from '../ui/States'
import { useGoBack } from '../ui/useGoBack'
import { nextEpisode } from '../ui/player/episodes'

/**
 * /watch/movie/:id            → Streams movie via standalone embedded player
 * /watch/tv/:id               → Streams series via standalone embedded player
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
  const seasonEpisodes = useSeason(tmdbId ?? 0, isEpisode ? season : undefined)
  const streams = useCineProSources(mediaType, tmdbId, season, episode)

  if (!mediaType || !tmdbId) return <Message title="Title not found" />
  if (mediaType === 'tv' && !isEpisode) return <Message title="Select an episode to watch" />
  if (title.isPending || streams.isPending) {
    return (
      <div className="player player--loading">
        <Spinner />
      </div>
    )
  }
  if (title.error) return <ErrorMessage error={title.error} onRetry={() => title.refetch()} />
  if (streams.error) return <ErrorMessage error={streams.error} onRetry={() => streams.refetch()} />
  const t = title.data
  if (!t) return <Message title="Title not found" />

  const epIndex = isEpisode ? episode - 1 : 0
  const epCount = isEpisode ? (t.seasons.find((s) => s.number === season)?.episodeCount ?? episode) : 1
  const epInfo = seasonEpisodes.data?.find((e) => e.number === episode)
  const subtitle = isEpisode ? `S${season}:E${episode}${epInfo ? ` · ${epInfo.name}` : ''}` : t.year ? String(t.year) : undefined

  const entry = lib.progress[t.key]
  const startAt = entry && !entry.upNext && entry.season === season && entry.episodeIndex === epIndex ? entry.position : 0
  const nextEp = isEpisode ? nextEpisode(t.seasons, season, episode) : undefined

  return (
    <VideoPlayer
      key={`${t.key}#${season ?? 0}-${episode ?? 0}`}
      sources={streams.data ?? []}
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
          nextEpisode: nextEp,
        })
      }
      onEnded={() => {
        navigate(titlePath(t), { replace: true })
      }}
      next={nextEp ? { label: `Next: S${nextEp.season}:E${nextEp.episode}`, onSelect: () => navigate(watchPath(t, nextEp), { replace: true }) } : undefined}
      episodes={isEpisode ? {
        tvId: tmdbId, seasons: t.seasons, season, episode,
        onSelect: (selectedSeason, selectedEpisode) => navigate(watchPath(t, { season: selectedSeason, episode: selectedEpisode }), { replace: true }),
      } : undefined}
    />
  )
}
