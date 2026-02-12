import { app, BrowserWindow, protocol, net } from 'electron'
import { join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

// IPC handler registrations
import { registerSystemIpc } from './ipc/system.js'
import { registerDialogHandlers } from './ipc/dialog.js'
import { registerWeightsHandlers } from './ipc/weights.js'
import { registerSDCppHandlers } from './ipc/sdcpp.js'
import { registerModelGroupsHandlers } from './ipc/modelGroups.js'
import { registerModelDownloadHandlers } from './ipc/modelDownload.js'
import { registerGenerateHandlers } from './ipc/generate.js'
import { registerVideoGenerateHandlers } from './ipc/videoGenerate.js'
import { registerGeneratedImagesHandlers } from './ipc/generatedImages.js'
import { registerPerfectPixelHandlers } from './ipc/perfectPixel.js'
import { createAppState } from './ipc/state.js'

// Utilities
import { initDefaultModelsFolder, initDefaultSDCppFolder, initDefaultOutputsFolder } from './utils/paths.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ========== App paths ==========
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
const preload = resolve(__dirname, 'preload.js')
const url = process.env.VITE_DEV_SERVER_URL

// ========== Shared state ==========
const appState = createAppState()

// ========== Window creation ==========
function createWindow() {
  const iconPath = process.env.VITE_PUBLIC ? join(process.env.VITE_PUBLIC, 'favicon.ico') : undefined
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (url) {
    win.loadURL(url)
    win.webContents.openDevTools()
  } else {
    const distPath = process.env.DIST || join(__dirname, '../dist')
    win.loadFile(join(distPath, 'index.html'))
  }
}

// ========== App lifecycle ==========
app.on('window-all-closed', () => {
  app.quit()
  win = null
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// ========== Register all IPC handlers ==========
const getWindow = () => win || BrowserWindow.getFocusedWindow()

registerSystemIpc({ getWindow })
registerDialogHandlers({ getWindow, state: appState })
registerWeightsHandlers({ getWindow, state: appState })
registerSDCppHandlers({ getWindow, state: appState })
registerModelGroupsHandlers({ getWindow, state: appState })
registerModelDownloadHandlers({ getWindow, state: appState })
registerGenerateHandlers({ state: appState })
registerVideoGenerateHandlers({ state: appState })
registerGeneratedImagesHandlers({ getWindow })
registerPerfectPixelHandlers({ getWindow })

// ========== App ready ==========
app.whenReady().then(async () => {
  // 注册 media 协议以允许加载本地资源
  protocol.handle('media', (request) => {
    let filePath = decodeURIComponent(request.url.slice('media://'.length))

    if (process.platform === 'win32') {
      if (filePath.startsWith('/')) filePath = filePath.slice(1)
      if (!filePath.includes(':') && /^[a-zA-Z](\/|\\)/.test(filePath)) {
        filePath = filePath[0] + ':' + filePath.slice(1)
      }
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })

  // 初始化默认文件夹
  await initDefaultModelsFolder()
  await initDefaultSDCppFolder()
  await initDefaultOutputsFolder()

  createWindow()
})
