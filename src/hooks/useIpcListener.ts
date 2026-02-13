import { useEffect, useRef } from 'react'
import type { IpcEventChannel, IPCEventMap } from '../../shared/ipc'
import { ipcListen } from '../lib/tauriIpc'

/**
 * IPC 事件监听 Hook
 * 自动处理监听器的注册、清理和 React Strict Mode 下的重复注册问题
 *
 * @param channel IPC 通道名称
 * @param handler 事件处理函数
 * @param deps 依赖数组（可选），当依赖变化时会重新注册监听器
 *
 * @example
 * ```tsx
 * useIpcListener('generate:preview-update', (data) => {
 *   if (data.previewImage) {
 *     setPreviewImage(data.previewImage)
 *   }
 * })
 * ```
 */
export function useIpcListener<C extends IpcEventChannel>(
  channel: C,
  handler: (data: IPCEventMap[C]) => void,
  deps?: React.DependencyList,
): void {
  const handlerRef = useRef(handler)

  // 更新 handler 引用，确保使用最新的 handler
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    let unlisten: (() => void) | null = null

    ipcListen(channel, (data) => {
      handlerRef.current(data)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, ...(deps || [])])
}

