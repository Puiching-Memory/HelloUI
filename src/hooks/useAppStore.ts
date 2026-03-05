import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'catppuccin' | 'latte' | 'default';

interface AppState {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  isUploading: boolean;
  isGenerating: boolean;
  systemIsDark: boolean;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  
  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setIsUploading: (isUploading: boolean) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setSystemIsDark: (isDark: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      colorScheme: 'default',
      isUploading: false,
      isGenerating: false,
      systemIsDark: false,
      sidebarWidth: 256,
      sidebarCollapsed: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setIsUploading: (isUploading) => set({ isUploading }),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setSystemIsDark: (systemIsDark) => set({ systemIsDark }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        themeMode: state.themeMode,
        colorScheme: state.colorScheme,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
