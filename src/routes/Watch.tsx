import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTitle } from '../catalog/queries'
import { isProvider } from '../providers'
import { useLibrary } from '../state/library'
import { titlePath, watchPath } from '../ui/paths'
import { useGoBack } from '../ui/useGoBack'
import { VideoPlayer } from '../ui/player/VideoPlayer'
import { ErrorMessage, Message, Spinner } from '../ui/States'

export default function Watch() {
  const { provider, id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const lib = useLibrary()
  const valid = isProvider(provider)
  const { data: t, error, isPending, refetch } = useTitle(valid ? provider : undefined, id)

  if (!valid) return <Message title="Title not found" />
  if (isPending) return <div className="player player--loading"><Spinner /></div>
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />
  if (!t || t.episodes.length === 0) return <Message title="Nothing to play" />

  const entry = lib.progress[t.key]
  const requested = Number(params.get('ep'))
  const epIndex = Number.isInteger(requested) && requested >= 0 && requested < t.episodes.length ? requested : 0
  const episode = t.episodes[epIndex]
  const startAt = entry && entry.episodeIndex === epIndex && !entry.upNext ? entry.position : 0
  const nextEp = t.episodes[epIndex + 1]
  const subtitle = t.kind === 'series' ? `E${epIndex + 1} · ${episode.name}` : t.year ? String(t.year) : undefined

  return (
    <VideoPlayer
      key={`${t.key}#${epIndex}`}
      sources={episode.sources}
      title={t.name}
      subtitle={subtitle}
      poster={t.backdrop ?? t.poster}
      startAt={startAt}
      sourcePage={t.sourcePage}
      onBack={goBack}
      onProgress={(position, duration) =>
        lib.saveProgress({
          title: t,
          episodeIndex: epIndex,
          episodeCount: t.episodes.length,
          episodeLabel: t.kind === 'series' ? episode.name : undefined,
          position,
          duration,
        })
      }
      onEnded={() => {
        if (nextEp) navigate(watchPath(t, epIndex + 1), { replace: true })
        else navigate(titlePath(t), { replace: true })
      }}
      next={nextEp ? { label: `Next episode: ${nextEp.name}`, onSelect: () => navigate(watchPath(t, epIndex + 1), { replace: true }) } : undefined}
    />
  )
}
