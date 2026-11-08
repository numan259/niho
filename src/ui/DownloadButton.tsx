import { Link } from 'react-router-dom'
import type { TitleSummary } from '../providers'
import { downloadId, startDownload, useDownloads } from '../offline/downloads'
import { useActiveProfile } from '../state/profiles'
import { Icon } from './Icon'

export function DownloadButton({ title, season, episode, label, episodeCount }: { title: TitleSummary; season?: number; episode?: number; label?: string; episodeCount?: number }) {
  const profile = useActiveProfile()
  const { items, loaded, error } = useDownloads()
  if (!profile) return null
  const id = downloadId(profile.id, title.key, season, episode)
  const item = items.find((entry) => entry.id === id)
  if (item) return <Link className="btn btn--secondary download-button" to="/downloads"><Icon name="download" size={18} />{item.status === 'ready' ? 'Downloaded' : item.status === 'downloading' ? 'Downloading…' : 'Retry download'}</Link>
  return <button className="btn btn--secondary download-button" disabled={!loaded || Boolean(error) || items.some((entry) => entry.status === 'downloading')}
    onClick={() => { void startDownload({ id, profileId: profile.id, title, season, episode, label, episodeCount }) }}>
    <Icon name="download" size={18} />{items.some((entry) => entry.status === 'downloading') ? 'Download in progress' : episode ? `Download episode ${episode}` : 'Download movie'}
  </button>
}
