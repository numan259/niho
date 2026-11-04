import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import Home from './routes/Home'
import Profiles from './routes/Profiles'
import { AppLayout, RequireProfile } from './ui/layout'
import { ScrollToTop } from './ui/ScrollToTop'
import { Message, Spinner } from './ui/States'

const Title = lazy(() => import('./routes/Title'))
const Watch = lazy(() => import('./routes/Watch'))
const Search = lazy(() => import('./routes/Search'))
const Browse = lazy(() => import('./routes/Browse'))
const Clips = lazy(() => import('./routes/Clips'))
const My = lazy(() => import('./routes/My'))
const About = lazy(() => import('./routes/About'))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/profiles" element={<Profiles />} />
          <Route element={<RequireProfile />}>
            <Route path="/watch/:mediaType/:id" element={<Watch />} />
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="/title/:mediaType/:id" element={<Title />} />
              <Route path="/browse/:rowId" element={<Browse />} />
              <Route path="/search" element={<Search />} />
              <Route path="/clips" element={<Clips />} />
              <Route path="/my" element={<My />} />
              <Route path="/about" element={<About />} />
              <Route
                path="*"
                element={
                  <Message title="Page not found" action={<Link className="btn btn--secondary" to="/">Back to Home</Link>} />
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
