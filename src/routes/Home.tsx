import { Link, useSearchParams } from 'react-router-dom'
import { buildHomePage } from '../catalog/pages'
import type { Category } from '../catalog/rows'
import { useActiveProfile } from '../state/profiles'
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
      {sections.map((s) => (
        <SectionRenderer key={`${category}-${s.id}`} section={s} />
      ))}
      <footer className="home__footer">
        Every title on Niho is public domain or Creative Commons licensed. <Link to="/about">Sources &amp; credits</Link>
      </footer>
    </div>
  )
}
