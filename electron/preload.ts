import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import {
  IPC_EVENT_PATTERNS,
  isAllowedEventChannel,
  isAllowedInvokeChannel,
  isAllowedSendChannel,
  type IpcEventChannel,
  type IpcInvokeArgs,
  type IpcInvokeChannel,
  type IpcInvokeResponse,
  type IPCEventMap,
} from '../shared/ipc.js'

const blockInvoke = (channel: string) => {
  const error = new Error(`[Preload] Blocked IPC invoke on channel "${channel}"`)
  console.error(error.message)
  return Promise.reject(error)
}

const blockSend = (channel: string) => {
  console.error(`[Preload] Blocked IPC send on channel "${channel}"`)
}

const blockSubscribe = (channel: string) => {
  console.error(`[Preload] Blocked IPC subscribe on channel "${channel}"`)
}

const isEventChannelAllowed = (channel: string): channel is IpcEventChannel =>
  isAllowedEventChannel(channel) || IPC_EVENT_PATTERNS.some((pattern) => pattern.test(channel))

contextBridge.exposeInMainWorld('ipcRenderer', {
  on<C extends IpcEventChannel>(channel: C, listener: (event: IpcRendererEvent, payload: IPCEventMap[C]) => void) {
    if (!isEventChannelAllowed(channel)) {
      blockSubscribe(channel)
      return
    }
    ipcRenderer.on(channel, listener as any)
  },

  off(channel: string, listener: (...args: any[]) => void) {
    ipcRenderer.off(channel as any, listener as any)
  },

  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel as any)
  },

  send<C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgs<C>) {
    if (!isAllowedSendChannel(channel)) {
      blockSend(channel)
      return
    }
    ipcRenderer.send(channel, ...(args as any))
  },

  invoke<C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgs<C>): Promise<IpcInvokeResponse<C>> {
    if (!isAllowedInvokeChannel(channel)) {
      return blockInvoke(channel) as Promise<IpcInvokeResponse<C>>
    }
    return ipcRenderer.invoke(channel, ...(args as any))
  },
})


