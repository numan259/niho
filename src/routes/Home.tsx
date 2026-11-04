import { Link, useSearchParams } from 'react-router-dom'
import { buildHomePage } from '../catalog/pages'
import type { Category } from '../catalog/rows'
import { hasTmdbKey } from '../providers/tmdb'
import { useActiveProfile } from '../state/profiles'
import { KeyMissing } from '../ui/States'
import { ChipBar, TopBar } from '../ui/layout'
import { SectionRenderer } from '../ui/sections/Sections'

const CATEGORIES: Category[] = ['all', 'movies', 'series']

export default function Home() {
  const profile = useActiveProfile()!
  const [params, setParams] = useSearchParams()
  const raw = params.get('c') as Category | null
  const category: Category = raw && CATEGORIES.includes(raw) && !profile.kids ? raw : 'all'
  const sections = buildHomePage({ profileName: profile.name, kids: profile.kids, category })

  return (
    <div className="page page--home">
      <TopBar title={category === 'series' ? 'Series' : category === 'movies' ? 'Films' : undefined}>
        <ChipBar
          kids={profile.kids}
          category={category}
          onCategory={(c) => setParams(c === 'all' ? {} : { c }, { replace: true })}
        />
      </TopBar>
      {hasTmdbKey ? sections.map((s) => <SectionRenderer key={`${category}-${s.id}`} section={s} />) : <KeyMissing />}
      <footer className="home__footer">
        <img src="/tmdb-logo.svg" alt="TMDB" width="90" height="12" /> Film data from TMDB · availability from JustWatch ·
        trailers via YouTube. <Link to="/about">About &amp; credits</Link>
      </footer>
    </div>
  )
}
