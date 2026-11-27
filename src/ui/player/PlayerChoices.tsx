import { useState } from 'react'
import type { Source } from '../../providers'
import { sourceLanguages } from '../../providers/languages'
import { Icon } from '../Icon'

function groupServers(sources: Source[]) {
  const groups = new Map<string, { name: string; sources: Source[] }>()
  sources.forEach(source => {
    const name = source.provider?.trim() || 'Other sources'
    const key = name.toLocaleLowerCase()
    const group = groups.get(key) ?? { name, sources: [] }
    group.sources.push(source)
    groups.set(key, group)
  })
  return [...groups.values()]
}

export function ServerChoices({ sources, active, onSelect }: { sources: Source[]; active?: Source; onSelect: (source: Source) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return <div className="player__servers" role="group" aria-label="Available providers">
    {groupServers(sources).map(group => {
      const selected = group.sources.find(item => item.url === active?.url)
      const open = expanded === group.name
      return <section className="player__server-group" key={group.name}>
        <button className="player__server-heading" aria-expanded={open} onClick={() => setExpanded(open ? null : group.name)}>
          <span><strong>{group.name}</strong><small>{group.sources.length} {group.sources.length === 1 ? 'server' : 'servers'}{selected ? ` · Playing server ${group.sources.indexOf(selected) + 1}` : ''}</small></span>
          {selected && <Icon name="check" size={18} />}<Icon name="chevron" size={18} />
        </button>
        {open && <div className="player__server-options">
          {group.sources.map((item, index) => <button key={`${item.url}-${index}`} aria-pressed={item.url === active?.url} onClick={() => onSelect(item)}>
            <span className="player__choice-check">{item.url === active?.url && <Icon name="check" size={18} />}</span>
            <span><strong>Server {index + 1}</strong><small>{[item.quality, item.type.toUpperCase()].filter(Boolean).join(' · ')}</small><small>{sourceLanguages(item)}</small></span>
          </button>)}
        </div>}
      </section>
    })}
  </div>
}

export interface MenuTrack { id: number; label: string; language?: string }
export function LanguageChoices({ audio, subtitles, audioId, subtitleId, onAudio, onSubtitle, error }: {
  audio: MenuTrack[]; subtitles: MenuTrack[]; audioId: number; subtitleId: number;
  onAudio: (track: MenuTrack) => void; onSubtitle: (track: MenuTrack | null) => void; error: string | null;
}) {
  return <div className="player__language-columns">
    <section aria-label="Audio tracks"><h3>Audio</h3><div className="player__track-list">
      {audio.map(track => <button key={track.id} aria-pressed={track.id === audioId} onClick={() => onAudio(track)}><span className="player__choice-check">{track.id === audioId && <Icon name="check" size={19} />}</span><span>{track.label}</span></button>)}
      {!audio.length && <p className="player__panel-note">This stream does not expose selectable audio tracks. Try another server for more languages.</p>}
    </div></section>
    <section aria-label="Subtitle tracks"><h3>Subtitles</h3><div className="player__track-list">
      <button aria-pressed={subtitleId === -1} onClick={() => onSubtitle(null)}><span className="player__choice-check">{subtitleId === -1 && <Icon name="check" size={19} />}</span><span>Off</span></button>
      {subtitles.map(track => <button key={track.id} aria-pressed={track.id === subtitleId} onClick={() => onSubtitle(track)}><span className="player__choice-check">{track.id === subtitleId && <Icon name="check" size={19} />}</span><span>{track.label}</span></button>)}
      {!subtitles.length && <p className="player__panel-note">No subtitles available on this stream.</p>}
      {error && <p className="player__panel-note" role="status">{error}</p>}
    </div></section>
  </div>
}
