import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelDownload, formatBytes, removeDownload, startDownload, useDownloads } from '../offline/downloads'
import type { Download } from '../offline/storage'
import { NativeDownloads, nativeDownloads } from '../offline/nativeDownloads'
import { useActiveProfile } from '../state/profiles'
import { Artwork } from '../ui/Artwork'
import { Icon } from '../ui/Icon'
import { TopBar } from '../ui/layout'
import { Spinner } from '../ui/States'

export default function Downloads() {
  const { items, loaded, error } = useDownloads()
  const profile = useActiveProfile()
  const [actionError, setActionError] = useState('')
  const { seriesId } = useParams()
  const own = items.filter((item) => item.profileId === profile?.id)
  const queue = items.filter((item) => item.status === 'queued').sort((a, b) => (a.queuedAt ?? a.createdAt) - (b.queuedAt ?? b.createdAt))
  const episodes = own.filter((item) => item.title.mediaType === 'tv' && String(item.title.id) === seriesId)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0))
  const seasons = [...new Set(episodes.map((item) => item.season))]
  const groups = new Map<string, Download[]>()
  for (const item of own) {
    const key = item.title.mediaType === 'tv' ? item.title.key : item.id
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const deleteItem = (id: string) => {
    setActionError('')
    void removeDownload(id).catch(() => setActionError('Could not delete this download. Please try again.'))
  }
  const cancelItem = (id: string) => {
    setActionError('')
    void cancelDownload(id).catch(() => setActionError('Could not cancel this download. Please try again.'))
  }
  return <div className="page page--downloads">
    <TopBar title="Downloads" />
    <div className="downloads__body">
      {seriesId ? <>
        <Link className="downloads__back" to="/downloads"><Icon name="back" size={20} />All downloads</Link>
        <h1>{episodes[0]?.title.name ?? 'Downloaded episodes'}</h1>
        <p className="downloads__note">Only episodes saved to this profile are listed here. Tap a ready episode to watch offline.</p>
        <p className="downloads__storage">{readyLabel(episodes)} · {formatBytes(episodes.reduce((sum, item) => sum + item.bytes, 0))}</p>
      </> : <>
      <h1>Watch anywhere</h1>
      <p className="downloads__note">Save movies and episodes here to watch without internet. Downloads prefer 720p or lower, with your preferred audio and subtitles when available.</p>
      <p className="downloads__note">Add as many videos as you like. Your queue downloads one video after another automatically. {nativeDownloads ? 'Downloads continue in the background with an Android notification.' : 'Keep this browser open while downloading.'}</p>
      {nativeDownloads && <div className="downloads__background"><button className="btn btn--secondary" onClick={() => {
        void NativeDownloads.permissions().then(({ notifications }) => setActionError(notifications ? '' : 'Notifications are disabled. Enable Niho notifications in Android settings to see background progress.')).catch(() => setActionError('Could not request notification permission.'))
      }}>Enable download notifications</button><button className="btn btn--secondary" onClick={() => { void NativeDownloads.batterySettings().catch(() => setActionError('Could not open Android battery settings.')) }}>Battery settings</button><p className="downloads__note">If your phone pauses downloads, allow Niho to run unrestricted in Android battery settings.</p></div>}
      <p className="downloads__storage">{formatBytes(items.reduce((sum, item) => sum + item.bytes, 0))} saved on this device · {own.filter((item) => item.status === 'ready').length} ready in this profile</p>
      </>}
      {(error || actionError) && <p role="alert">{error || actionError}</p>}
      {!loaded ? <Spinner /> : seriesId && !episodes.length && !error ? <div className="downloads__empty"><h2>No episodes saved</h2><p>Downloads for this show will appear here after you add them.</p><Link className="btn btn--secondary" to="/downloads">Back to Downloads</Link></div> : !own.length && !error ? <div className="downloads__empty"><Icon name="download" size={46} /><h2>No downloads yet</h2><p>Open a movie or episode and tap Download.</p><Link className="btn btn--primary" to="/">Find something to watch</Link></div> : null}
      <div className="downloads__list">
        {seriesId ? seasons.map((season) => <section key={season} className="downloads__season" aria-label={`Season ${season}`}>
          <h2>Season {season}</h2>
          <div className="downloads__list">{episodes.filter((item) => item.season === season).map((item) => <DownloadCard key={item.id} item={item} position={queue.findIndex((entry) => entry.id === item.id) + 1} onDelete={deleteItem} onCancel={cancelItem} />)}</div>
        </section>) : Array.from(groups, ([key, group]) => group[0].title.mediaType === 'tv'
          ? <ShowCard key={key} episodes={group} />
          : <DownloadCard key={key} item={group[0]} position={queue.findIndex((entry) => entry.id === group[0].id) + 1} onDelete={deleteItem} onCancel={cancelItem} />)}
      </div>
    </div>
  </div>
}

function readyLabel(items: Download[]) {
  const count = items.filter((item) => item.status === 'ready').length
  return `${count} downloaded episode${count === 1 ? '' : 's'}`
}

function ShowCard({ episodes }: { episodes: Download[] }) {
  const title = episodes[0].title
  const downloading = episodes.filter((item) => item.status === 'downloading').length
  const queued = episodes.filter((item) => item.status === 'queued').length
  const failed = episodes.filter((item) => item.status === 'error').length
  return <Link className="download-card download-card--show" to={`/downloads/series/${title.id}`} aria-label={`View downloaded episodes: ${title.name}`}>
    <Artwork title={title.name} />
    <div className="download-card__body"><h2>{title.name}</h2><p>{readyLabel(episodes)}</p>
      <p>{formatBytes(episodes.reduce((sum, item) => sum + item.bytes, 0))}</p>
      {downloading > 0 && <p role="status">{downloading} downloading</p>}
      {queued > 0 && <p>{queued} queued</p>}
      {failed > 0 && <p>{failed} need attention</p>}
      <span className="downloads__note">View episodes</span>
    </div><Icon name="chevron" size={22} />
  </Link>
}

function DownloadCard({ item, position, onDelete, onCancel }: { item: Download; position: number; onDelete: (id: string) => void; onCancel: (id: string) => void }) {
  const heading = item.episode !== undefined ? `S${item.season}:E${item.episode}${item.label ? ` · ${item.label}` : ''}` : item.title.name
  return <article className="download-card">
          <Artwork title={item.title.name} />
          <div className="download-card__body">
            <h3>{item.status === 'ready' ? <Link className="download-card__title" to={`/downloads/watch/${item.id}`} aria-label={`Watch ${heading} offline`}>{heading}</Link> : heading}</h3>
            <p>{item.quality ?? 'Preparing'} · {formatBytes(item.bytes)}</p>
            {item.status === 'ready' && <><p className="downloads__note">Audio: {item.audio} · Subtitles: {item.subtitles}</p><Link className="btn btn--primary" to={`/downloads/watch/${item.id}`}><Icon name="play" size={18} />Watch offline</Link></>}
            {item.status === 'downloading' && <><progress aria-label={`Downloading ${item.title.name}`} max={item.total || 1} value={item.completed} /><p role="status">{item.total ? `${Math.floor(item.completed / item.total * 100)}% · ${item.completed} of ${item.total} files` : 'Preparing your video…'}</p><button className="btn btn--secondary" onClick={() => onCancel(item.id)}>Cancel download</button></>}
            {item.status === 'queued' && <><p role="status">Queued · #{position} — starts automatically</p><button className="btn btn--secondary" onClick={() => onCancel(item.id)}>Cancel queued download</button></>}
            {item.status === 'error' && <><p role="alert">{item.error}</p><button className="btn btn--secondary" onClick={() => { void startDownload(item) }}>Retry download</button></>}
            {item.status !== 'downloading' && <button className="icon-btn" aria-label={`Delete download: ${item.title.name}${item.episode ? ` S${item.season}:E${item.episode}` : ''}`} onClick={() => onDelete(item.id)}><Icon name="trash" /></button>}
          </div>
        </article>
}
