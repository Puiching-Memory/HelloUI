import { app, BrowserWindow, ipcMain, net } from 'electron'

interface SystemIpcDeps {
  getWindow: () => BrowserWindow | null
}

export function registerSystemIpc({ getWindow }: SystemIpcDeps): void {
  ipcMain.handle('devtools:toggle', async () => {
    const window = getWindow() || BrowserWindow.getFocusedWindow()
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      try {
        window.webContents.toggleDevTools()
        return { success: true, isOpen: window.webContents.isDevToolsOpened() }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
    return { success: false, error: 'No available window' }
  })

  ipcMain.handle('app:get-version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('aliyun-api:call', async (_, { method, url, headers, body }) => {
    try {
      const response = await net.fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await response.json()
      return {
        status: response.status,
        statusText: response.statusText,
        data,
      }
    } catch (error) {
      return {
        status: 500,
        statusText: 'Internal Server Error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}
