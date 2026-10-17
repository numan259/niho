import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toSummary } from '../providers'
import type { TitleSummary } from '../providers'
import { useProfiles } from './profiles'
import { persistStorage } from './storage'

export interface ProgressEntry {
  title: TitleSummary
  episodeIndex: number
  episodeCount: number
  episodeLabel?: string
  /** seconds */
  position: number
  /** seconds */
  duration: number
  /** true when the previous episode finished and this one hasn't started */
  upNext?: boolean
  updatedAt: number
}

export interface ProfileLibrary {
  myList: TitleSummary[]
  liked: Record<string, TitleSummary>
  progress: Record<string, ProgressEntry>
}

export const EMPTY_LIBRARY: ProfileLibrary = { myList: [], liked: {}, progress: {} }

/** Below this many seconds, playback isn't worth resuming. */
export const MIN_RESUME_SEC = 30
/** At or beyond this fraction, an episode counts as watched. */
export const FINISHED_RATIO = 0.95

export interface ProgressUpdate {
  title: TitleSummary
  episodeIndex: number
  episodeCount: number
  episodeLabel?: string
  position: number
  duration: number
  now?: number
}

/** Pure reducer for watch progress — the rules behind "Continue Watching". */
export function applyProgress(progress: ProfileLibrary['progress'], u: ProgressUpdate): ProfileLibrary['progress'] {
  const now = u.now ?? Date.now()
  const next = { ...progress }
  const finished = u.duration > 0 && u.position / u.duration >= FINISHED_RATIO
  const title = toSummary(u.title)

  if (!finished) {
    next[title.key] = {
      title,
      episodeIndex: u.episodeIndex,
      episodeCount: u.episodeCount,
      episodeLabel: u.episodeLabel,
      position: Math.floor(u.position),
      duration: Math.floor(u.duration),
      updatedAt: now,
    }
  } else if (u.episodeIndex + 1 < u.episodeCount) {
    next[title.key] = {
      title,
      episodeIndex: u.episodeIndex + 1,
      episodeCount: u.episodeCount,
      position: 0,
      duration: 0,
      upNext: true,
      updatedAt: now,
    }
  } else {
    delete next[title.key]
  }
  return next
}

export function continueWatching(progress: ProfileLibrary['progress']): ProgressEntry[] {
  return Object.values(progress)
    .filter((e) => e.upNext || e.position >= MIN_RESUME_SEC)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function remainingLabel(e: ProgressEntry): string {
  if (e.upNext) return 'Next episode'
  const mins = Math.max(1, Math.round((e.duration - e.position) / 60))
  if (mins < 60) return `${mins} min left`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min left` : `${h} h left`
}

interface LibraryState {
  libraries: Record<string, ProfileLibrary>
  toggleMyList: (profileId: string, t: TitleSummary) => void
  toggleLiked: (profileId: string, t: TitleSummary) => void
  saveProgress: (profileId: string, u: ProgressUpdate) => void
  removeProgress: (profileId: string, key: string) => void
  clearProfile: (profileId: string) => void
}

const libOf = (s: LibraryState, id: string) => s.libraries[id] ?? EMPTY_LIBRARY

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => {
      const patch = (profileId: string, fn: (lib: ProfileLibrary) => Partial<ProfileLibrary>) =>
        set((s) => {
          const lib = libOf(s, profileId)
          return { libraries: { ...s.libraries, [profileId]: { ...lib, ...fn(lib) } } }
        })
      return {
        libraries: {},
        toggleMyList: (pid, t) =>
          patch(pid, (lib) => ({
            myList: lib.myList.some((x) => x.key === t.key)
              ? lib.myList.filter((x) => x.key !== t.key)
              : [toSummary(t), ...lib.myList],
          })),
        toggleLiked: (pid, t) =>
          patch(pid, (lib) => {
            const liked = { ...lib.liked }
            if (liked[t.key]) delete liked[t.key]
            else liked[t.key] = toSummary(t)
            return { liked }
          }),
        saveProgress: (pid, u) => patch(pid, (lib) => ({ progress: applyProgress(lib.progress, u) })),
        removeProgress: (pid, key) =>
          patch(pid, (lib) => {
            const progress = { ...lib.progress }
            delete progress[key]
            return { progress }
          }),
        clearProfile: (pid) =>
          set((s) => {
            const libraries = { ...s.libraries }
            delete libraries[pid]
            return { libraries }
          }),
      }
    },
    { name: 'niho.library', storage: persistStorage, version: 1 },
  ),
)

/** The active profile's library plus actions bound to that profile. */
export function useLibrary() {
  const profileId = useProfiles((s) => s.activeId) ?? 'guest'
  const lib = useLibraryStore((s) => s.libraries[profileId] ?? EMPTY_LIBRARY)
  const store = useLibraryStore.getState()
  return useMemo(
    () => ({
      ...lib,
      inMyList: (key: string) => lib.myList.some((t) => t.key === key),
      isLiked: (key: string) => key in lib.liked,
      toggleMyList: (t: TitleSummary) => store.toggleMyList(profileId, t),
      toggleLiked: (t: TitleSummary) => store.toggleLiked(profileId, t),
      saveProgress: (u: ProgressUpdate) => store.saveProgress(profileId, u),
      removeProgress: (key: string) => store.removeProgress(profileId, key),
    }),
    [lib, profileId, store],
  )
}
