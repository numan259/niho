import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelDownload, formatBytes, removeDownload, startDownload, useDownloads } from '../offline/downloads'
import { useActiveProfile } from '../state/profiles'
import { Artwork } from '../ui/Artwork'
import { Icon } from '../ui/Icon'
import { TopBar } from '../ui/layout'
import { Spinner } from '../ui/States'

export default function Downloads() {
  const { items, loaded, error } = useDownloads()
  const profile = useActiveProfile()
  const [actionError, setActionError] = useState('')
  const own = items.filter((item) => item.profileId === profile?.id)
  const busy = items.some((item) => item.status === 'downloading')
  return <div className="page page--downloads">
    <TopBar title="Downloads" />
    <div className="downloads__body">
      <h1>Watch anywhere</h1>
      <p className="downloads__note">Save movies and episodes here to watch without internet. Downloads prefer 720p or lower, with your preferred audio and subtitles when available.</p>
      <p className="downloads__note">Keep Niho open until a download finishes. Videos are saved on this device; clearing app data removes them.</p>
      <p className="downloads__storage">{formatBytes(items.reduce((sum, item) => sum + item.bytes, 0))} saved on this device · {own.filter((item) => item.status === 'ready').length} ready in this profile</p>
      {(error || actionError) && <p role="alert">{error || actionError}</p>}
      {!loaded ? <Spinner /> : !own.length && !error ? <div className="downloads__empty"><Icon name="download" size={46} /><h2>No downloads yet</h2><p>Open a movie or episode and tap Download.</p><Link className="btn btn--primary" to="/">Find something to watch</Link></div> : null}
      <div className="downloads__list">
        {own.map((item) => <article key={item.id} className="download-card">
          <Artwork title={item.title.name} />
          <div className="download-card__body">
            <h2>{item.title.name}</h2>
            {item.episode !== undefined && <p>S{item.season}:E{item.episode}{item.label ? ` · ${item.label}` : ''}</p>}
            <p>{item.quality ?? 'Preparing'} · {formatBytes(item.bytes)}</p>
            {item.status === 'ready' && <><p className="downloads__note">Audio: {item.audio} · Subtitles: {item.subtitles}</p><Link className="btn btn--primary" to={`/downloads/watch/${item.id}`}><Icon name="play" size={18} />Watch offline</Link></>}
            {item.status === 'downloading' && <><progress aria-label={`Downloading ${item.title.name}`} max={item.total || 1} value={item.completed} /><p role="status">{item.total ? `${Math.floor(item.completed / item.total * 100)}% · ${item.completed} of ${item.total} files` : 'Preparing your video…'}</p><button className="btn btn--secondary" onClick={() => cancelDownload(item.id)}>Cancel download</button></>}
            {item.status === 'error' && <><p role="alert">{item.error}</p><button className="btn btn--secondary" disabled={busy} onClick={() => { void startDownload(item) }}>Retry download</button></>}
            {item.status !== 'downloading' && <button className="icon-btn" aria-label={`Delete download: ${item.title.name}${item.episode ? ` S${item.season}:E${item.episode}` : ''}`} onClick={() => {
              setActionError('')
              void removeDownload(item.id).catch(() => setActionError('Could not delete this download. Please try again.'))
            }}><Icon name="trash" /></button>}
          </div>
        </article>)}
      </div>
    </div>
  </div>
}
