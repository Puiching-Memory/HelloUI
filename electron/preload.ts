import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
console.log('[Preload] Starting IPC renderer initialization...')
try {
  contextBridge.exposeInMainWorld('ipcRenderer', {
    on(channel: string, listener: (...args: any[]) => void) {
      ipcRenderer.on(channel, listener)
    },
    off(channel: string, listener: (...args: any[]) => void) {
      ipcRenderer.off(channel, listener)
    },
    removeAllListeners(channel: string) {
      ipcRenderer.removeAllListeners(channel)
    },
    send(channel: string, ...args: any[]) {
      ipcRenderer.send(channel, ...args)
    },
    invoke(channel: string, ...args: any[]) {
      return ipcRenderer.invoke(channel, ...args)
    },
  })
  console.log('[Preload] IPC renderer successfully exposed to window.ipcRenderer')
} catch (error) {
  console.error('[Preload] Failed to expose IPC renderer:', error)
}


