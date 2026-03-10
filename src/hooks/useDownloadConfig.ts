import { create } from 'zustand';
import type { DownloadConfig } from '@shared/types';
import { settingsService } from '@/features/settings/services/settingsService';

interface DownloadConfigState {
  config: DownloadConfig | null;
  isLoading: boolean;
  error: string | null;
  
  loadConfig: () => Promise<void>;
  setConfig: (config: Partial<DownloadConfig>) => Promise<void>;
}

export const useDownloadConfig = create<DownloadConfigState>((set) => ({
  config: null,
  isLoading: false,
  error: null,
  
  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await settingsService.getDownloadConfig();
      set({ config, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  setConfig: async (newConfig: Partial<DownloadConfig>) => {
    set({ isLoading: true, error: null });
    try {
      const config = await settingsService.updateDownloadConfig(newConfig);
      set({ config, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },
}));
