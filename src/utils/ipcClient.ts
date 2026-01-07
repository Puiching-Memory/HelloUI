import type {
  IpcEventChannel,
  IpcInvokeArgs,
  IpcInvokeChannel,
  IpcInvokeResponse,
  IPCEventMap,
} from '../../shared/ipc'

const getIpc = () => {
  if (!window.ipcRenderer) {
    throw new Error('IPC bridge is not available')
  }
  return window.ipcRenderer
}

export const ipcInvoke = async <C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeArgs<C>
): Promise<IpcInvokeResponse<C>> => {
  return getIpc().invoke(channel, ...(args as any))
}

export const ipcSend = <C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgs<C>): void => {
  getIpc().send(channel, ...(args as any))
}

export const ipcOn = <C extends IpcEventChannel>(
  channel: C,
  listener: (payload: IPCEventMap[C]) => void
): (() => void) => {
  const ipc = getIpc()
  const wrapped = (_event: unknown, payload: IPCEventMap[C]) => listener(payload)
  ipc.on(channel, wrapped as any)
  return () => ipc.off(channel, wrapped as any)
}

export const ipcOnce = <C extends IpcEventChannel>(
  channel: C,
  listener: (payload: IPCEventMap[C]) => void
): (() => void) => {
  const ipc = getIpc()
  const wrapped = (_event: unknown, payload: IPCEventMap[C]) => {
    ipc.off(channel, wrapped as any)
    listener(payload)
  }
  ipc.on(channel, wrapped as any)
  return () => ipc.off(channel, wrapped as any)
}

export const ipcAvailable = () => Boolean(window.ipcRenderer)
