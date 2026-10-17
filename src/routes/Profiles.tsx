import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../state/library'
import { AVATAR_COLORS, useProfiles, type Profile } from '../state/profiles'
import { Icon } from '../ui/Icon'
import { Avatar } from '../ui/layout'
import { Logo } from '../ui/Logo'

type Draft = Omit<Profile, 'id'> & { id?: string }

export default function Profiles() {
  const { profiles, select, add, update, remove } = useProfiles()
  const clearLibrary = useLibraryStore((s) => s.clearProfile)
  const [managing, setManaging] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'

  function choose(p: Profile) {
    if (managing) return setDraft(p)
    select(p.id)
    navigate(from, { replace: true })
  }

  function save(d: Draft) {
    const name = d.name.trim() || 'Viewer'
    if (d.id) update(d.id, { name, color: d.color, kids: d.kids })
    else add({ name, color: d.color, kids: d.kids })
    setDraft(null)
  }

  function del(id: string) {
    remove(id)
    clearLibrary(id)
    setDraft(null)
  }

  return (
    <div className="profiles">
      <Logo size={34} />
      {draft ? (
        <ProfileForm draft={draft} canDelete={Boolean(draft.id) && profiles.length > 1} onSave={save} onCancel={() => setDraft(null)} onDelete={del} />
      ) : (
        <>
          <h1 className="profiles__title">{managing ? 'Manage profiles' : 'Who’s watching?'}</h1>
          <ul className="profiles__grid">
            {profiles.map((p) => (
              <li key={p.id}>
                <button className="profiles__item" onClick={() => choose(p)} aria-label={managing ? `Edit ${p.name}` : `Watch as ${p.name}`}>
                  <span className="profiles__avatar">
                    <Avatar profile={p} size={96} />
                    {managing && (
                      <span className="profiles__edit" aria-hidden="true">
                        <Icon name="edit" size={28} />
                      </span>
                    )}
                  </span>
                  <span className="profiles__name">{p.name}</span>
                </button>
              </li>
            ))}
            {profiles.length < 5 && (
              <li>
                <button
                  className="profiles__item"
                  onClick={() => setDraft({ name: '', color: AVATAR_COLORS[profiles.length % AVATAR_COLORS.length], kids: false })}
                >
                  <span className="profiles__avatar profiles__avatar--add">
                    <Icon name="plus" size={40} />
                  </span>
                  <span className="profiles__name">Add profile</span>
                </button>
              </li>
            )}
          </ul>
          <button className="btn btn--ghost" onClick={() => setManaging((m) => !m)}>
            {managing ? 'Done' : 'Manage profiles'}
          </button>
        </>
      )}
    </div>
  )
}

function ProfileForm({
  draft,
  canDelete,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft
  canDelete: boolean
  onSave: (d: Draft) => void
  onCancel: () => void
  onDelete: (id: string) => void
}) {
  const [d, setD] = useState(draft)
  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(d)
      }}
    >
      <h1 className="profiles__title">{draft.id ? 'Edit profile' : 'Add profile'}</h1>
      <Avatar profile={d} size={96} />
      <label className="field">
        <span>Name</span>
        <input value={d.name} maxLength={20} autoFocus onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Name" />
      </label>
      <fieldset className="field">
        <legend>Colour</legend>
        <div className="swatches">
          {AVATAR_COLORS.map((c) => (
            <label key={c} className="swatch" style={{ background: c }}>
              <input type="radio" name="color" value={c} checked={d.color === c} onChange={() => setD({ ...d, color: c })} />
              <span className="visually-hidden">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="toggle">
        <input type="checkbox" checked={d.kids} onChange={(e) => setD({ ...d, kids: e.target.checked })} />
        <span>
          Kids profile
          <small>Only animation and cartoons</small>
        </span>
      </label>
      <div className="profile-form__actions">
        <button type="submit" className="btn btn--primary">
          Save
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
        {canDelete && draft.id && (
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => onDelete(draft.id!)}>
            <Icon name="trash" size={18} /> Delete
          </button>
        )}
      </div>
    </form>
  )
}
