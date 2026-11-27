import { usePlaybackPreferences } from '../../state/playback'
import { PlayerPanel } from './PlayerPanel'

export function PlaybackSettings({ onClose }: { onClose: () => void }) {
  const prefs = usePlaybackPreferences()
  return <PlayerPanel title="Playback settings" onClose={onClose}>
    <p className="player__panel-note">Saved on this device for this profile.</p>
    <fieldset className="player__setting"><legend>Subtitle size</legend><div className="player__segments">
      {(['small', 'medium', 'large'] as const).map((size) => <button key={size} aria-pressed={prefs.subtitleSize === size} onClick={() => prefs.update({ subtitleSize: size })}>{size}</button>)}
    </div></fieldset>
    <p className={`player__caption-preview player__caption-preview--${prefs.subtitleSize}`}>This is how your subtitles will look.</p>
    <label className="player__setting player__setting--toggle"><span>Autoplay next episode<small>Start the next episode after a 10-second countdown.</small></span>
      <input type="checkbox" checked={prefs.autoplay} onChange={(e) => prefs.update({ autoplay: e.target.checked })} />
    </label>
  </PlayerPanel>
}
