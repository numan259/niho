import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ROWS, type Category } from '../catalog/rows'
import { useActiveProfile, type Profile } from '../state/profiles'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { useGoBack } from './useGoBack'

export function Avatar({ profile, size = 32 }: { profile: Pick<Profile, 'name' | 'color' | 'kids'>; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: profile.color, fontSize: size * 0.45 }} aria-hidden="true">
      {profile.kids ? '★' : profile.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** Redirects to the profile picker until someone is "watching". */
export function RequireProfile() {
  const profile = useActiveProfile()
  const location = useLocation()
  if (!profile) return <Navigate to="/profiles" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/clips', label: 'Clips', icon: 'clips' },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/downloads', label: 'Downloads', icon: 'download' },
]

export function AppLayout() {
  const profile = useActiveProfile()
  return (
    <div className="app">
      <main className="app__main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className="tabbar__item">
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <NavLink to="/my" className="tabbar__item">
          {profile ? <Avatar profile={profile} size={24} /> : <Icon name="user" />}
          <span>My Niho</span>
        </NavLink>
      </nav>
    </div>
  )
}

/** Sticky header that gains a backdrop once the page scrolls. */
export function TopBar({ title, children }: { title?: string; children?: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const profile = useActiveProfile()
  return (
    <header className={`topbar ${scrolled ? 'topbar--solid' : ''}`}>
      <div className="topbar__row">
        <Link to="/" className="topbar__logo" aria-label="Niho home">
          <Logo size={26} />
        </Link>
        {title && <span className="topbar__title">{title}</span>}
        <span className="topbar__spacer" />
        <Link to="/search" className="icon-btn" aria-label="Search">
          <Icon name="search" />
        </Link>
        {profile && (
          <Link to="/profiles" className="topbar__profile" aria-label={`Switch profile (current: ${profile.name})`}>
            <Avatar profile={profile} size={30} />
          </Link>
        )}
      </div>
      {children}
    </header>
  )
}

export function ChipBar({ category, onCategory, kids }: { category: Category; onCategory: (c: Category) => void; kids: boolean }) {
  const toggle = (c: Category) => onCategory(category === c ? 'all' : c)
  return (
    <div className="chips" role="toolbar" aria-label="Browse by category">
      {category !== 'all' && (
        <button className="chip chip--icon" onClick={() => onCategory('all')} aria-label="Clear category">
          <Icon name="close" size={16} />
        </button>
      )}
      {!kids && (
        <>
          <button className="chip" aria-pressed={category === 'series'} onClick={() => toggle('series')}>
            Series
          </button>
          <button className="chip" aria-pressed={category === 'movies'} onClick={() => toggle('movies')}>
            Films
          </button>
        </>
      )}
      {category === 'all' &&
        ROWS.filter((r) => r.chip && (!kids || r.kids)).map((r) => (
          <Link key={r.id} className="chip" to={`/browse/${r.id}`}>
            {r.chip}
          </Link>
        ))}
    </div>
  )
}

export function BackButton({ label = 'Back' }: { label?: string }) {
  const goBack = useGoBack()
  return (
    <button className="icon-btn icon-btn--lg" onClick={goBack} aria-label={label}>
      <Icon name="back" size={26} />
    </button>
  )
}
