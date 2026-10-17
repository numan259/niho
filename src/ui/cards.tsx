import { Link } from 'react-router-dom'
import type { TitleSummary } from '../providers'
import { remainingLabel, type ProgressEntry } from '../state/library'
import { Artwork } from './Artwork'
import { Icon } from './Icon'
import { titlePath, watchPath } from './paths'

export function TitleCard({ title, priority }: { title: TitleSummary; priority?: boolean }) {
  return (
    <Link to={titlePath(title)} className="card" aria-label={title.year ? `${title.name} (${title.year})` : title.name}>
      <Artwork src={title.poster} title={title.name} className="card__art" priority={priority} />
    </Link>
  )
}

export function ContinueCard({ entry, onRemove }: { entry: ProgressEntry; onRemove: () => void }) {
  const { title } = entry
  const pct = entry.duration ? Math.min(100, (entry.position / entry.duration) * 100) : 0
  const remaining = remainingLabel(entry)
  const episode = entry.episodeCount > 1 ? `Episode ${entry.episodeIndex + 1}` : null
  return (
    <div className="card card--wide">
      <Link to={watchPath(title, entry.episodeIndex)} className="card__play" aria-label={`Play ${title.name}, ${remaining}`}>
        <Artwork src={title.backdrop ?? title.poster} title={title.name} className="card__art" />
        <span className="card__play-icon" aria-hidden="true">
          <Icon name="play" size={22} />
        </span>
        <span className="card__progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </Link>
      <div className="card__meta">
        <div className="card__meta-text">
          <span className="card__name">{title.name}</span>
          <span className="card__sub">{episode ? `${episode} · ${remaining}` : remaining}</span>
        </div>
        <Link to={titlePath(title)} className="icon-btn" aria-label={`Show details for ${title.name}`}>
          <Icon name="info" size={20} />
        </Link>
        <button className="icon-btn" onClick={onRemove} aria-label={`Remove ${title.name} from Continue Watching`}>
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  )
}
