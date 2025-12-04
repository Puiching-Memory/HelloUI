import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
// Here, you can also use other preload
// 使用绝对路径确保 preload 脚本正确加载
const preload = resolve(__dirname, 'preload.js')
const url = process.env.VITE_DEV_SERVER_URL

// 检查 preload 文件是否存在
if (!existsSync(preload)) {
  console.error(`[Main] Preload 文件不存在: ${preload}`)
  console.error(`[Main] __dirname: ${__dirname}`)
  // 尝试备用路径
  const altPath = resolve(process.cwd(), 'dist-electron', 'preload.js')
  console.error(`[Main] 尝试备用路径: ${altPath}`)
  if (existsSync(altPath)) {
    console.log(`[Main] 找到备用路径，使用: ${altPath}`)
  }
} else {
  console.log(`[Main] Preload 文件路径: ${preload}`)
  console.log(`[Main] Preload 文件存在: ${existsSync(preload)}`)
}

function createWindow() {
  console.log('[Main] 创建窗口，preload 路径:', preload)
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
  
  // 监听 preload 脚本错误（必须在创建窗口后立即监听）
  win.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('[Main] Preload 脚本加载错误:', preloadPath, error)
  })
  
  // 监听 preload 脚本加载完成
  win.webContents.on('did-attach-webview', () => {
    console.log('[Main] Webview 已附加')
  })
  
  // 在页面开始加载时检查
  win.webContents.on('did-start-loading', () => {
    console.log('[Main] 页面开始加载')
  })
  
  win.webContents.on('dom-ready', async () => {
    console.log('[Main] DOM 已就绪')
    // 等待一小段时间确保 preload 脚本执行完成
    setTimeout(async () => {
      try {
        const result = await win!.webContents.executeJavaScript('typeof window.ipcRenderer')
        console.log('[Main] window.ipcRenderer 类型:', result)
        if (result === 'undefined') {
          console.error('[Main] 警告: window.ipcRenderer 未定义，preload 脚本可能未正确执行')
          console.error('[Main] Preload 路径:', preload)
        } else {
          console.log('[Main] window.ipcRenderer 已正确加载')
        }
      } catch (error) {
        console.error('[Main] 检查 preload 脚本时出错:', error)
      }
    }, 100)
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (url) {
    // electron-vite-vue#298
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    const distPath = process.env.DIST || join(__dirname, '../dist')
    win.loadFile(join(distPath, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 存储权重文件夹路径
let weightsFolderPath: string | null = null

// IPC 处理程序：检查文件夹是否存在
ipcMain.handle('weights:check-folder', async (_, folderPath: string) => {
  try {
    return existsSync(folderPath)
  } catch (error) {
    console.error('检查文件夹失败:', error)
    return false
  }
})

// IPC 处理程序：设置权重文件夹
ipcMain.handle('weights:set-folder', async (_, folder: string) => {
  weightsFolderPath = folder
  return true
})

// IPC 处理程序：获取权重文件夹
ipcMain.handle('weights:get-folder', async () => {
  return weightsFolderPath
})

// IPC 处理程序：列出文件夹中的文件
ipcMain.handle('weights:list-files', async (_, folder: string) => {
  try {
    if (!existsSync(folder)) {
      return []
    }
    
    const entries = await fs.readdir(folder, { withFileTypes: true })
    const files: Array<{ name: string; size: number; path: string; modified: number }> = []
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(folder, entry.name)
        const stats = await fs.stat(filePath)
        files.push({
          name: entry.name,
          size: stats.size,
          path: filePath,
          modified: stats.mtimeMs,
        })
      }
    }
    
    // 按修改时间降序排序
    files.sort((a, b) => b.modified - a.modified)
    return files
  } catch (error) {
    console.error('列出文件失败:', error)
    return []
  }
})

// IPC 处理程序：选择要上传的文件
ipcMain.handle('weights:select-file', async () => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }
  
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    title: '选择要上传的权重文件',
    filters: [
      { name: '所有文件', extensions: ['*'] },
      { name: '模型文件', extensions: ['bin', 'safetensors', 'pt', 'pth', 'onnx', 'ckpt'] },
    ],
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// IPC 处理程序：上传文件（复制到权重文件夹）
ipcMain.handle('weights:upload-file', async (_, sourcePath: string, targetFolder: string) => {
  try {
    if (!existsSync(targetFolder)) {
      await fs.mkdir(targetFolder, { recursive: true })
    }
    
    const fileName = basename(sourcePath)
    const targetPath = join(targetFolder, fileName)
    
    // 如果目标文件已存在，添加时间戳
    if (existsSync(targetPath)) {
      const ext = extname(fileName)
      const name = basename(fileName, ext)
      const timestamp = Date.now()
      const newFileName = `${name}_${timestamp}${ext}`
      await fs.copyFile(sourcePath, join(targetFolder, newFileName))
    } else {
      await fs.copyFile(sourcePath, targetPath)
    }
    
    return true
  } catch (error) {
    console.error('上传文件失败:', error)
    throw error
  }
})

// IPC 处理程序：下载文件（复制到用户选择的位置）
ipcMain.handle('weights:download-file', async (_, filePath: string) => {
  try {
    const window = win || BrowserWindow.getFocusedWindow()
    if (!window) {
      throw new Error('没有可用的窗口')
    }
    
    const fileName = basename(filePath)
    const result = await dialog.showSaveDialog(window, {
      title: '保存权重文件',
      defaultPath: fileName,
      filters: [
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    
    if (!result.canceled && result.filePath) {
      await fs.copyFile(filePath, result.filePath)
      return true
    }
    return false
  } catch (error) {
    console.error('下载文件失败:', error)
    throw error
  }
})

// IPC 处理程序：删除文件
ipcMain.handle('weights:delete-file', async (_, filePath: string) => {
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    console.error('删除文件失败:', error)
    throw error
  }
})

app.whenReady().then(createWindow)

