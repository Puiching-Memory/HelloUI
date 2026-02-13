/**
 * Tauri IPC 通信层
 *
 * 提供类型安全的 invoke / listen 封装，直接使用 Tauri 原生 API
 */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { IpcInvokeChannel, IpcEventChannel, IPCEventMap, IpcInvokeArgs, IpcInvokeResponse } from '../../shared/ipc'

/**
 * Channel 名称转换为 Tauri command 名称
 * Tauri command 不支持冒号(:)和连字符(-)，转换为下划线格式
 */
function channelToCommand(channel: string): string {
  return channel.replace(/[:\-]/g, '_')
}

/**
 * 调用 Tauri 后端命令
 */
export async function ipcInvoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeArgs<C>
): Promise<IpcInvokeResponse<C>> {
  const command = channelToCommand(channel)

  // 将参数打包为 Tauri command 期望的格式
  let payload: Record<string, unknown> = {}

  if (args.length === 1) {
    const arg = args[0]
    if (arg !== null && arg !== undefined && typeof arg === 'object' && !Array.isArray(arg)) {
      payload = {
        ...(arg as Record<string, unknown>),
        value: arg,
      }
    } else {
      payload = { value: arg }
    }
  } else if (args.length > 1) {
    payload = { value: args as unknown }

    // 为已知的多参数 channel 提供命名参数
    if (channel === 'sdcpp:list-files') {
      payload = { folder: args[0], deviceType: args[1] } as Record<string, unknown>
    } else if (channel === 'generated-images:batch-download') {
      payload = { value: args[0] } as Record<string, unknown>
    }
  }

  return invoke(command, payload) as Promise<IpcInvokeResponse<C>>
}

/**
 * 监听 Tauri 后端事件
 * @returns 取消监听函数
 */
export async function ipcListen<C extends IpcEventChannel>(
  channel: C,
  handler: (payload: IPCEventMap[C]) => void,
): Promise<UnlistenFn> {
  return listen<IPCEventMap[C]>(channel, (event) => {
    handler(event.payload)
  })
}
