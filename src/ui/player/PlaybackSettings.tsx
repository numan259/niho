import { usePlaybackPreferences } from '../../state/playback'
import { PlayerPanel } from './PlayerPanel'

const LANGUAGES = [['en', 'English'], ['tr', 'Turkish'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['ar', 'Arabic'], ['ja', 'Japanese'], ['ko', 'Korean'], ['hi', 'Hindi'], ['pt', 'Portuguese'], ['zh', 'Chinese']]

export function PlaybackSettings({ onClose }: { onClose: () => void }) {
  const prefs = usePlaybackPreferences()
  return <PlayerPanel title="Playback settings" onClose={onClose}>
    <p className="player__panel-note">Saved on this device for your next movie or episode.</p>
    <label className="player__setting">Preferred audio
      <select value={prefs.audioLanguage} onChange={(e) => prefs.update({ audioLanguage: e.target.value })}>
        <option value="">Original / default</option>
        {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        {prefs.audioLanguage && !LANGUAGES.some(([code]) => code === prefs.audioLanguage) && <option value={prefs.audioLanguage}>{prefs.audioLanguage}</option>}
      </select>
    </label>
    <label className="player__setting">Preferred subtitles
      <select value={prefs.subtitleLanguage} onChange={(e) => prefs.update({ subtitleLanguage: e.target.value })}>
        <option value="off">Off</option>
        {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        {prefs.subtitleLanguage !== 'off' && !LANGUAGES.some(([code]) => code === prefs.subtitleLanguage) && <option value={prefs.subtitleLanguage}>{prefs.subtitleLanguage}</option>}
      </select>
    </label>
    <p className="player__panel-note">Languages depend on the stream. If unavailable, audio uses its default and subtitles stay off.</p>
    <fieldset className="player__setting"><legend>Subtitle size</legend><div className="player__segments">
      {(['small', 'medium', 'large'] as const).map((size) => <button key={size} aria-pressed={prefs.subtitleSize === size} onClick={() => prefs.update({ subtitleSize: size })}>{size}</button>)}
    </div></fieldset>
    <p className={`player__caption-preview player__caption-preview--${prefs.subtitleSize}`}>This is how your subtitles will look.</p>
    <label className="player__setting player__setting--toggle"><span>Autoplay next episode<small>Start the next episode after a 10-second countdown.</small></span>
      <input type="checkbox" checked={prefs.autoplay} onChange={(e) => prefs.update({ autoplay: e.target.checked })} />
    </label>
  </PlayerPanel>
}
