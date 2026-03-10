import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface AppState {
  themeMode: ThemeMode
  sidebarCollapsed: boolean
  setThemeMode: (mode: ThemeMode) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
}

function getPreferredThemeMode(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

function normalizeThemeMode(value: unknown): ThemeMode {
  if (value === 'dark') {
    return 'dark'
  }

  if (value === 'system') {
    return getPreferredThemeMode()
  }

  return 'light'
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      themeMode: getPreferredThemeMode(),
      sidebarCollapsed: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'app-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<{
          themeMode: unknown
          sidebarCollapsed: unknown
        }>

        return {
          themeMode: normalizeThemeMode(state.themeMode),
          sidebarCollapsed: typeof state.sidebarCollapsed === 'boolean' ? state.sidebarCollapsed : false,
        }
      },
      partialize: (state) => ({
        themeMode: state.themeMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
