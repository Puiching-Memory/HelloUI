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
  
  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setIsUploading: (isUploading: boolean) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setSystemIsDark: (isDark: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      colorScheme: 'default',
      isUploading: false,
      isGenerating: false,
      systemIsDark: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setIsUploading: (isUploading) => set({ isUploading }),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setSystemIsDark: (systemIsDark) => set({ systemIsDark }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        themeMode: state.themeMode,
        colorScheme: state.colorScheme,
      }),
    }
  )
);
