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
  const listenerRef = useRef<((_event: unknown, data: T) => void) | null>(null);

  // 更新 handler 引用，确保使用最新的 handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // 检查 ipcRenderer 是否可用
    if (!window.ipcRenderer) {
      console.error(`[useIpcListener] window.ipcRenderer is not available for channel: ${channel}`);
      return;
    }

    // 如果监听器已存在，先移除它（防止重复注册）
    if (listenerRef.current) {
      window.ipcRenderer.off(channel, listenerRef.current);
      listenerRef.current = null;
    }

    // 先移除所有该事件的监听器，确保没有重复注册（针对 React Strict Mode）
    window.ipcRenderer.removeAllListeners(channel);

    // 创建监听器，使用 ref 中的最新 handler
    const listener = (_event: unknown, data: T) => {
      handlerRef.current(data);
    };

    // 保存监听器引用
    listenerRef.current = listener;

    // 注册监听器
    window.ipcRenderer.on(channel, listener);

    // 清理函数
    return () => {
      if (window.ipcRenderer && listenerRef.current) {
        window.ipcRenderer.off(channel, listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [channel, ...(deps || [])]);
}

