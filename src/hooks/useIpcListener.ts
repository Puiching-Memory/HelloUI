import { useEffect, useRef } from 'react';

/**
 * 标准化的 IPC 监听器管理 Hook
 * 自动处理监听器的注册、清理和 React Strict Mode 下的重复注册问题
 * 
 * @param channel IPC 通道名称
 * @param handler 事件处理函数
 * @param deps 依赖数组（可选），当依赖变化时会重新注册监听器
 * 
 * @example
 * ```tsx
 * useIpcListener<{ previewImage: string }>(
 *   'generate:preview-update',
 *   (data) => {
 *     if (data.previewImage) {
 *       setPreviewImage(data.previewImage);
 *     }
 *   }
 * );
 * ```
 */
export function useIpcListener<T = any>(
  channel: string,
  handler: (data: T) => void,
  deps?: React.DependencyList
): void {
  const handlerRef = useRef(handler);

  // 更新 handler 引用，确保使用最新的 handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!window.ipcRenderer) {
      return;
    }

    const listener = (_event: unknown, data: T) => {
      handlerRef.current(data);
    };

    window.ipcRenderer.on(channel, listener);

    return () => {
      window.ipcRenderer.off(channel, listener);
    };
  }, [channel, ...(deps || [])]);
}

