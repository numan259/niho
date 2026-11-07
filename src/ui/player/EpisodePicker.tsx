import { useState } from 'react'
import { useSeason } from '../../catalog/queries'
import type { SeasonSummary } from '../../providers'
import { Artwork } from '../Artwork'
import { PlayerPanel } from './PlayerPanel'

export interface EpisodePickerProps {
  tvId: number
  seasons: SeasonSummary[]
  season: number
  episode: number
  onSelect: (season: number, episode: number) => void
}

export function EpisodePicker({ tvId, seasons, season, episode, onSelect, onClose }: EpisodePickerProps & { onClose: () => void }) {
  const [selectedSeason, setSelectedSeason] = useState(season)
  const query = useSeason(tvId, selectedSeason)
  return <PlayerPanel title="Episodes" onClose={onClose}>
    <label className="player__setting">Season<select value={selectedSeason} onChange={(e) => setSelectedSeason(Number(e.target.value))}>
      {seasons.map((item) => <option key={item.number} value={item.number}>{item.name}</option>)}
    </select></label>
    {query.isPending && <div className="player__episode-skeleton" role="status" aria-label="Loading episodes"><div /><div /><div /></div>}
    {query.error && <div role="alert"><p>Couldn't load these episodes.</p><button className="btn btn--secondary" onClick={() => query.refetch()}>Try again</button></div>}
    {query.data?.length === 0 && <p>No episodes listed for this season.</p>}
    <div className="player__episodes">
      {query.data?.map((item) => <button key={item.number} className="player__episode" aria-current={selectedSeason === season && item.number === episode ? 'true' : undefined}
        aria-label={`Play S${selectedSeason}:E${item.number}: ${item.name}`} onClick={() => onSelect(selectedSeason, item.number)}>
        <Artwork src={item.still} title={item.name} />
        <span><strong>{item.number}. {item.name}</strong><small>{selectedSeason === season && item.number === episode ? 'Now playing' : item.runtimeMin ? `${item.runtimeMin} min` : ''}</small><span>{item.overview}</span></span>
      </button>)}
    </div>
  </PlayerPanel>
}
