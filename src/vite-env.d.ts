/// <reference types="vite/client" />

import type {
  IpcEventChannel,
  IpcInvokeArgs,
  IpcInvokeChannel,
  IpcInvokeResponse,
  IPCEventMap,
} from '../shared/ipc'

interface ImportMetaEnv {
  readonly VITE_DEV_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    ipcRenderer: {
      on<C extends IpcEventChannel>(channel: C, listener: (event: any, payload: IPCEventMap[C]) => void): void
      off(channel: string, ...args: any[]): void
      removeAllListeners(channel: string): void
      send<C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgs<C>): void
      invoke<C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgs<C>): Promise<IpcInvokeResponse<C>>
    }
  }
}

export {}

