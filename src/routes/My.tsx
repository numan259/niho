import { Link, useNavigate } from 'react-router-dom'
import { continueWatching, useLibrary } from '../state/library'
import { useActiveProfile, useProfiles } from '../state/profiles'
import { ContinueCard, TitleCard } from '../ui/cards'
import { Gallery } from '../ui/Gallery'
import { Icon } from '../ui/Icon'
import { Avatar } from '../ui/layout'
import { Row } from '../ui/sections/Row'
import { Message } from '../ui/States'

export default function My() {
  const profile = useActiveProfile()!
  const select = useProfiles((s) => s.select)
  const lib = useLibrary()
  const navigate = useNavigate()
  const watching = continueWatching(lib.progress)
  const liked = Object.values(lib.liked)

  return (
    <div className="page page--my">
      <header className="my__head">
        <Avatar profile={profile} size={72} />
        <h1 className="my__name">{profile.name}</h1>
        <button
          className="btn btn--secondary"
          onClick={() => {
            select(null)
            navigate('/profiles')
          }}
        >
          Switch profile
        </button>
      </header>

      {watching.length > 0 && (
        <Row title="Continue Watching">
          {watching.map((e) => (
            <ContinueCard key={e.title.key} entry={e} onRemove={() => lib.removeProgress(e.title.key)} />
          ))}
        </Row>
      )}

      {liked.length > 0 && (
        <Row title="Titles you’ve liked">
          {liked.map((t) => (
            <TitleCard key={t.key} title={t} />
          ))}
        </Row>
      )}

      <section>
        <h2 className="section-title">My List</h2>
        {lib.myList.length ? (
          <Gallery items={lib.myList} />
        ) : (
          <Message title="Your list is empty">Tap “My List” on any title to save it here for later.</Message>
        )}
      </section>

      <nav className="my__links">
        <Link to="/profiles" state={{ from: '/my' }} className="my__link">
          <Icon name="edit" /> Manage profiles
        </Link>
        <Link to="/about" className="my__link">
          <Icon name="info" /> Sources, licenses &amp; credits
        </Link>
      </nav>
    </div>
  )
}
