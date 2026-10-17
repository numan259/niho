import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { persistStorage } from './storage'

export interface Profile {
  id: string
  name: string
  color: string
  /** Kids profiles only see animation / family rows */
  kids: boolean
}

export const AVATAR_COLORS = ['#f2b64c', '#4cc9a6', '#5b8def', '#e86f8a', '#a77bf3', '#f08a4b']

interface ProfilesState {
  profiles: Profile[]
  activeId: string | null
  add: (p: Omit<Profile, 'id'>) => Profile
  update: (id: string, patch: Partial<Omit<Profile, 'id'>>) => void
  remove: (id: string) => void
  select: (id: string | null) => void
}

const newId = () => Math.random().toString(36).slice(2, 10)

export const useProfiles = create<ProfilesState>()(
  persist(
    (set) => ({
      profiles: [
        { id: 'me', name: 'Me', color: AVATAR_COLORS[0], kids: false },
        { id: 'kids', name: 'Kids', color: AVATAR_COLORS[1], kids: true },
      ],
      activeId: null,
      add: (p) => {
        const profile = { ...p, id: newId() }
        set((s) => ({ profiles: [...s.profiles, profile] }))
        return profile
      },
      update: (id, patch) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      remove: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      select: (id) => set({ activeId: id }),
    }),
    { name: 'niho.profiles', storage: persistStorage, version: 1 },
  ),
)

export function useActiveProfile(): Profile | null {
  return useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? null)
}
