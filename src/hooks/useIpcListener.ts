import { useEffect, useRef } from 'react';
import type { IpcEventChannel, IPCEventMap } from '../../shared/ipc';

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
export function useIpcListener<C extends IpcEventChannel>(
  channel: C,
  handler: (data: IPCEventMap[C]) => void,
  deps?: React.DependencyList
): void {
  const handlerRef = useRef(handler);
  const listenerRef = useRef<((_event: unknown, data: IPCEventMap[C]) => void) | null>(null);

  // 更新 handler 引用，确保使用最新的 handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!window.ipcRenderer) {
      return;
    }

    // 如果已经存在监听器，先移除它
    if (listenerRef.current) {
      window.ipcRenderer.off(channel, listenerRef.current);
      listenerRef.current = null;
    }

    // 创建新的监听器
    const listener = (_event: unknown, data: IPCEventMap[C]) => {
      handlerRef.current(data);
    };
    listenerRef.current = listener;

    window.ipcRenderer.on(channel, listener);

    return () => {
      if (listenerRef.current && window.ipcRenderer) {
        window.ipcRenderer.off(channel, listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [channel, ...(deps || [])]);
}

