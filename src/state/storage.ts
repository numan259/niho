import { createJSONStorage, type StateStorage } from 'zustand/middleware'

/** localStorage that never throws (private mode, blocked storage, quota). */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* storage unavailable: state stays in memory for this session */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

export const persistStorage = createJSONStorage(() => safeLocalStorage)
