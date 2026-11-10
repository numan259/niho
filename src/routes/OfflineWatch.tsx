import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDownloads } from '../offline/downloads'
import { offlineUrl, type Download } from '../offline/storage'
import { useActiveProfile } from '../state/profiles'
import { useLibrary } from '../state/library'
import { Message, Spinner } from '../ui/States'
import { VideoPlayer } from '../ui/player/VideoPlayer'

export default function OfflineWatch() {
  const { downloadId } = useParams()
  const { items, loaded } = useDownloads()
  const profile = useActiveProfile()
  const item = items.find((entry) => entry.id === downloadId && entry.profileId === profile?.id && entry.status === 'ready')
  if (!loaded) return <Spinner />
  if (!item) return <Message title="Download unavailable" action={<Link className="btn btn--primary" to="/downloads">Back to Downloads</Link>}>This video has not finished downloading or was removed.</Message>
  return <OfflineVideo key={item.id} item={item} />
}

export function OfflineVideo({ item }: { item: Download }) {
  const navigate = useNavigate()
  const library = useLibrary()
  const items = useDownloads((state) => state.items)
  const entry = library.progress[item.title.key]
  const episodeIndex = item.episode ? item.episode - 1 : 0
  const downloadsPath = item.title.mediaType === 'tv' ? `/downloads/series/${item.title.id}` : '/downloads'
  const startAt = entry && !entry.upNext && entry.season === item.season && entry.episodeIndex === episodeIndex ? entry.position : 0
  const sources = useMemo(() => [{ url: offlineUrl(item.id), type: 'hls' as const, quality: item.quality }], [item.id, item.quality])
  const next = item.episode === undefined ? undefined : items.find((other) => other.profileId === item.profileId && other.title.key === item.title.key && other.status === 'ready' &&
    (other.season === item.season && other.episode === item.episode! + 1 || item.episode === item.episodeCount && other.season === item.season! + 1 && other.episode === 1))
  return <VideoPlayer sources={sources} title={item.title.name} subtitle={`${item.episode ? `S${item.season}:E${item.episode} · ` : ''}Offline`}
    startAt={startAt} onBack={() => navigate(downloadsPath)} onEnded={() => navigate(downloadsPath, { replace: true })}
    next={next ? { label: `Next: S${next.season}:E${next.episode}`, onSelect: () => navigate(`/downloads/watch/${next.id}`, { replace: true }) } : undefined}
    onProgress={(position, duration) => library.saveProgress({ title: item.title, season: item.season, episodeIndex, episodeCount: item.episodeCount ?? 1, episodeLabel: item.label, position, duration })} />
}
