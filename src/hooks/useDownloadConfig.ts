import { create } from 'zustand';
import { ipcInvoke } from '../lib/tauriIpc';
import type { DownloadConfig } from '@shared/types';

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
      const config = await ipcInvoke('models:get-download-config');
      set({ config, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  setConfig: async (newConfig: Partial<DownloadConfig>) => {
    set({ isLoading: true, error: null });
    try {
      const config = await ipcInvoke('models:set-download-config', newConfig);
      set({ config, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },
}));
