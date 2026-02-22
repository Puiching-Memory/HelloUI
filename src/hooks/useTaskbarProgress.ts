import { useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow, ProgressBarStatus } from '@tauri-apps/api/window';

export type TaskbarProgressState = {
  progress: number;
  status: ProgressBarStatus;
};

export function useTaskbarProgress() {
  const currentProgressRef = useRef<TaskbarProgressState | null>(null);

  const setProgress = useCallback(async (progress: number | null, status?: ProgressBarStatus) => {
    try {
      const window = getCurrentWindow();
      
      if (progress === null) {
        await window.setProgressBar({ status: ProgressBarStatus.None });
        currentProgressRef.current = null;
        return;
      }

      const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
      const progressStatus = status ?? ProgressBarStatus.Normal;
      
      await window.setProgressBar({
        status: progressStatus,
        progress: clampedProgress,
      });
      
      currentProgressRef.current = {
        progress: clampedProgress,
        status: progressStatus,
      };
    } catch (error) {
      console.error('Failed to set taskbar progress:', error);
    }
  }, []);

  const setIndeterminate = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      await window.setProgressBar({ status: ProgressBarStatus.Indeterminate });
      currentProgressRef.current = { progress: 0, status: ProgressBarStatus.Indeterminate };
    } catch (error) {
      console.error('Failed to set taskbar progress to indeterminate:', error);
    }
  }, []);

  const clearProgress = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      await window.setProgressBar({ status: ProgressBarStatus.None });
      currentProgressRef.current = null;
    } catch (error) {
      console.error('Failed to clear taskbar progress:', error);
    }
  }, []);

  const setError = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      await window.setProgressBar({ status: ProgressBarStatus.Error });
      currentProgressRef.current = { progress: 0, status: ProgressBarStatus.Error };
    } catch (error) {
      console.error('Failed to set taskbar progress to error:', error);
    }
  }, []);

  const setPaused = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      await window.setProgressBar({ status: ProgressBarStatus.Paused });
      currentProgressRef.current = { progress: 0, status: ProgressBarStatus.Paused };
    } catch (error) {
      console.error('Failed to set taskbar progress to paused:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      clearProgress();
    };
  }, [clearProgress]);

  return {
    setProgress,
    setIndeterminate,
    clearProgress,
    setError,
    setPaused,
    getCurrentProgress: () => currentProgressRef.current,
  };
}
