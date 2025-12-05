import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'

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
    // electron-vite-vue#298
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    const distPath = process.env.DIST || join(__dirname, '../dist')
    win.loadFile(join(distPath, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  app.quit()
  win = null
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 存储权重文件夹路径
let weightsFolderPath: string | null = null

// 存储 SD.cpp 引擎文件夹路径和设备类型
let sdcppFolderPath: string | null = null
let sdcppDeviceType: 'cpu' | 'vulkan' | 'cuda' = 'cpu'

// 存储当前上传的流引用，用于取消上传
interface UploadState {
  readStream: ReturnType<typeof createReadStream> | null
  writeStream: ReturnType<typeof createWriteStream> | null
  targetPath: string
  cancelled: boolean
}

let currentUpload: UploadState | null = null

// 获取默认的 models 文件夹路径
function getDefaultModelsFolder(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'models')
}

// 初始化默认 models 文件夹
async function initDefaultModelsFolder(): Promise<string> {
  const defaultFolder = getDefaultModelsFolder()
  if (!existsSync(defaultFolder)) {
    await fs.mkdir(defaultFolder, { recursive: true })
    console.log(`[Main] Created default models folder: ${defaultFolder}`)
  }
  return defaultFolder
}

// 获取默认的 SD.cpp 引擎文件夹路径（运行位置目录下的engines/sdcpp文件夹）
function getDefaultSDCppFolder(): string {
  // 获取运行位置目录（可执行文件所在目录）
  let runPath: string
  if (app.isPackaged) {
    // 已打包：使用可执行文件所在目录
    runPath = dirname(process.execPath)
  } else {
    // 开发环境：使用项目根目录（__dirname指向dist-electron，需要回到项目根目录）
    runPath = join(__dirname, '..')
  }
  return join(runPath, 'engines', 'sdcpp')
}

// 初始化默认 SD.cpp 引擎文件夹（运行位置目录下的engines/sdcpp文件夹）
async function initDefaultSDCppFolder(): Promise<string> {
  const defaultFolder = getDefaultSDCppFolder()
  if (!existsSync(defaultFolder)) {
    await fs.mkdir(defaultFolder, { recursive: true })
    console.log(`[Main] Created default SD.cpp engine folder: ${defaultFolder}`)
  }
  // 创建设备子文件夹
  const deviceFolders = ['cpu', 'vulkan', 'cuda']
  for (const device of deviceFolders) {
    const deviceFolder = join(defaultFolder, device)
    if (!existsSync(deviceFolder)) {
      await fs.mkdir(deviceFolder, { recursive: true })
      console.log(`[Main] Created device folder: ${deviceFolder}`)
    }
  }
  return defaultFolder
}

// IPC 处理程序：初始化默认 models 文件夹
ipcMain.handle('weights:init-default-folder', async () => {
  try {
    const folder = await initDefaultModelsFolder()
    weightsFolderPath = folder
    return folder
  } catch (error) {
    console.error('Failed to initialize default folder:', error)
    throw error
  }
})

// IPC 处理程序：检查文件夹是否存在
ipcMain.handle('weights:check-folder', async (_, folderPath: string) => {
  try {
    return existsSync(folderPath)
  } catch (error) {
    console.error('Failed to check folder:', error)
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
    console.error('Failed to list files:', error)
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
      { name: '模型文件', extensions: ['bin', 'safetensors', 'pt', 'pth', 'onnx', 'ckpt', 'gguf'] },
      { name: 'GGUF 文件', extensions: ['gguf'] },
    ],
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// 计算文件的快速采样哈希（智能多点采样）
// 使用单个文件描述符读取所有采样点，减少系统调用
// 对于大文件，采用更多采样点以提高准确性
async function calculateQuickHash(filePath: string, fileSize: number): Promise<string> {
  const baseSampleSize = 32 * 1024 // 基础采样大小 32KB（减少读取量）
  const hash = createHash('md5') // 使用 MD5 代替 SHA-256，速度更快，对于采样哈希足够安全
  
  // 使用单个文件描述符读取所有采样点
  const fd = await fs.open(filePath, 'r')
  
  try {
    // 总是读取文件开头（最重要）
    const startBuffer = Buffer.alloc(Math.min(baseSampleSize, fileSize))
    await fd.read(startBuffer, 0, startBuffer.length, 0)
    hash.update(startBuffer)
    
    // 根据文件大小决定采样策略
    if (fileSize <= baseSampleSize) {
      // 小文件：只读取开头就够了
    } else if (fileSize <= 100 * 1024 * 1024) {
      // 中等文件（<100MB）：读取开头和结尾
      const endPos = Math.max(0, fileSize - baseSampleSize)
      const endBuffer = Buffer.alloc(fileSize - endPos)
      await fd.read(endBuffer, 0, endBuffer.length, endPos)
      hash.update(endBuffer)
    } else {
      // 大文件（>=100MB）：多点采样（开头、1/4、1/2、3/4、结尾）
      const samplePoints = [
        0, // 开头
        Math.floor(fileSize * 0.25) - baseSampleSize / 2,
        Math.floor(fileSize * 0.5) - baseSampleSize / 2,
        Math.floor(fileSize * 0.75) - baseSampleSize / 2,
        Math.max(0, fileSize - baseSampleSize), // 结尾
      ]
      
      for (const pos of samplePoints) {
        const safePos = Math.max(0, Math.min(pos, fileSize - baseSampleSize))
        const buffer = Buffer.alloc(baseSampleSize)
        await fd.read(buffer, 0, baseSampleSize, safePos)
        hash.update(buffer)
      }
    }
    
    // 包含文件大小信息，确保不同大小的文件不会误判
    hash.update(Buffer.from(fileSize.toString()))
    
    return hash.digest('hex')
  } finally {
    await fd.close()
  }
}

// 快速检查目标文件夹中是否已有相同文件
// 使用两级检查：1. 文件大小 2. 快速采样哈希
async function findDuplicateFile(targetFolder: string, sourcePath: string, sourceSize: number): Promise<string | null> {
  try {
    if (!existsSync(targetFolder)) {
      return null
    }
    
    // 计算源文件的快速哈希
    const sourceQuickHash = await calculateQuickHash(sourcePath, sourceSize)
    
    const entries = await fs.readdir(targetFolder, { withFileTypes: true })
    
    // 第一级：快速检查 - 只检查文件大小相同的文件
    const candidates: Array<{ path: string; size: number }> = []
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(targetFolder, entry.name)
        try {
          const stats = await fs.stat(filePath)
          // 只检查大小相同的文件
          if (stats.size === sourceSize) {
            candidates.push({ path: filePath, size: stats.size })
          }
        } catch (error) {
          console.warn(`Failed to get file info: ${filePath}`, error)
        }
      }
    }
    
    // 如果没有大小相同的文件，直接返回
    if (candidates.length === 0) {
      return null
    }
    
    // 第二级：快速采样哈希检查
    for (const candidate of candidates) {
      try {
        const candidateQuickHash = await calculateQuickHash(candidate.path, candidate.size)
        if (candidateQuickHash === sourceQuickHash) {
          // 采样哈希匹配，认为是相同文件
          return candidate.path
        }
      } catch (error) {
        // 如果计算某个文件的哈希失败，继续检查下一个文件
        console.warn(`Failed to calculate file hash: ${candidate.path}`, error)
      }
    }
    
    return null
  } catch (error) {
    console.error('Failed to check file duplicates:', error)
    return null
  }
}

// IPC 处理程序：取消上传
ipcMain.handle('weights:cancel-upload', async () => {
  if (currentUpload) {
    currentUpload.cancelled = true
    
    // 停止流
    if (currentUpload.readStream) {
      currentUpload.readStream.destroy()
    }
    if (currentUpload.writeStream) {
      currentUpload.writeStream.destroy()
    }
    
    // 删除部分复制的文件
    try {
      if (existsSync(currentUpload.targetPath)) {
        await fs.unlink(currentUpload.targetPath)
      }
    } catch (error) {
      console.warn('Failed to delete partially copied file:', error)
    }
    
    currentUpload = null
    return { success: true }
  }
  return { success: false, message: '没有正在进行的上传' }
})

// IPC 处理程序：上传文件（复制到权重文件夹，带进度）
ipcMain.handle('weights:upload-file', async (event, sourcePath: string, targetFolder: string) => {
  try {
    if (!existsSync(targetFolder)) {
      await fs.mkdir(targetFolder, { recursive: true })
    }
    
    const fileName = basename(sourcePath)
    
    // 获取源文件大小
    const sourceStats = await fs.stat(sourcePath)
    const sourceSize = sourceStats.size
    
    // 使用优化的快速检查算法查找重复文件
    // 先比较文件大小，再使用采样哈希，最后完整哈希确认
    const existingFile = await findDuplicateFile(targetFolder, sourcePath, sourceSize)
    if (existingFile) {
      const existingFileName = basename(existingFile)
      return {
        success: false,
        skipped: true,
        reason: 'duplicate',
        existingFile: existingFileName,
        message: `文件已存在: ${existingFileName}`,
      }
    }
    
    let targetPath = join(targetFolder, fileName)
    
    // 如果目标文件已存在（同名但不同哈希），添加时间戳
    if (existsSync(targetPath)) {
      const ext = extname(fileName)
      const name = basename(fileName, ext)
      const timestamp = Date.now()
      const newFileName = `${name}_${timestamp}${ext}`
      targetPath = join(targetFolder, newFileName)
    }
    
    // 获取源文件大小
    const stats = await fs.stat(sourcePath)
    const totalSize = stats.size
    let copiedSize = 0
    
    // 使用流式复制以支持进度跟踪
    const readStream = createReadStream(sourcePath)
    const writeStream = createWriteStream(targetPath)
    
    // 存储当前上传状态
    currentUpload = {
      readStream,
      writeStream,
      targetPath,
      cancelled: false,
    }
    
    // 监听数据块，更新进度
    readStream.on('data', (chunk: Buffer | string) => {
      // 检查是否已取消
      if (currentUpload?.cancelled) {
        readStream.destroy()
        writeStream.destroy()
        return
      }
      
      const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      copiedSize += chunkSize
      const progress = Math.round((copiedSize / totalSize) * 100)
      // 发送进度更新到渲染进程
      event.sender.send('weights:upload-progress', {
        progress,
        copied: copiedSize,
        total: totalSize,
        fileName: fileName,
      })
    })
    
    // 监听错误
    readStream.on('error', (error) => {
      if (currentUpload?.cancelled) {
        // 如果是取消操作，不打印错误
        return
      }
      // 检查是否是流销毁相关的错误
      const errorCode = (error as any)?.code
      const isStreamDestroyedError = errorCode === 'ERR_STREAM_DESTROYED' ||
        errorCode === 'ERR_STREAM_PREMATURE_CLOSE' ||
        (error instanceof Error && (
          error.message.includes('destroyed') ||
          error.message.includes('Premature close')
        ))
      
      if (!isStreamDestroyedError) {
        console.error('Read stream error:', error)
      }
    })
    
    writeStream.on('error', (error) => {
      if (currentUpload?.cancelled) {
        // 如果是取消操作，不打印错误
        return
      }
      // 检查是否是流销毁相关的错误
      const errorCode = (error as any)?.code
      const isStreamDestroyedError = errorCode === 'ERR_STREAM_DESTROYED' ||
        errorCode === 'ERR_STREAM_PREMATURE_CLOSE' ||
        (error instanceof Error && (
          error.message.includes('destroyed') ||
          error.message.includes('Premature close')
        ))
      
      if (!isStreamDestroyedError) {
        console.error('Write stream error:', error)
      }
    })
    
    try {
      // 使用 pipeline 确保流正确关闭
      await pipeline(readStream, writeStream)
      
      // 检查是否已取消
      if (currentUpload?.cancelled) {
        // 清理状态
        const uploadState = currentUpload
        currentUpload = null
        // 删除部分复制的文件
        try {
          if (existsSync(uploadState.targetPath)) {
            await fs.unlink(uploadState.targetPath)
          }
        } catch (unlinkError) {
          console.warn('Failed to delete partially copied file:', unlinkError)
        }
        return {
          success: false,
          cancelled: true,
          message: '上传已取消',
        }
      }
      
      // 发送最终进度（100%）
      event.sender.send('weights:upload-progress', {
        progress: 100,
        copied: totalSize,
        total: totalSize,
        fileName: fileName,
      })
      
      // 清理状态
      currentUpload = null
      
      return { success: true, targetPath, skipped: false }
    } catch (error) {
      const wasCancelled = currentUpload?.cancelled || false
      // 清理状态
      const uploadState = currentUpload
      currentUpload = null
      
      // 检查是否是取消操作导致的错误
      const errorCode = (error as any)?.code
      const isCancellationError = wasCancelled || 
        (error instanceof Error && (
          error.message.includes('destroyed') ||
          error.message.includes('Premature close') ||
          error.message.includes('ERR_STREAM_PREMATURE_CLOSE') ||
          errorCode === 'ERR_STREAM_PREMATURE_CLOSE'
        ))
      
      if (isCancellationError) {
        // 删除部分复制的文件
        if (uploadState) {
          try {
            if (existsSync(uploadState.targetPath)) {
              await fs.unlink(uploadState.targetPath)
            }
          } catch (unlinkError) {
            console.warn('Failed to delete partially copied file:', unlinkError)
          }
        }
        return {
          success: false,
          cancelled: true,
          message: '上传已取消',
        }
      }
      
      // 删除部分复制的文件
      try {
        if (existsSync(targetPath)) {
          await fs.unlink(targetPath)
        }
      } catch (unlinkError) {
        console.warn('Failed to delete partially copied file:', unlinkError)
      }
      
      throw error
    }
  } catch (error) {
    // 清理状态
    currentUpload = null
    
    console.error('Failed to upload file:', error)
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
    console.error('Failed to download file:', error)
    throw error
  }
})

// IPC 处理程序：删除文件
ipcMain.handle('weights:delete-file', async (_, filePath: string) => {
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
})

// ========== SD.cpp 引擎相关 IPC 处理程序 ==========

// IPC 处理程序：初始化默认 SD.cpp 引擎文件夹（运行位置目录下的engines/sdcpp文件夹）
ipcMain.handle('sdcpp:init-default-folder', async () => {
  try {
    const folder = await initDefaultSDCppFolder()
    sdcppFolderPath = folder
    console.log(`[Main] SD.cpp engine search path (运行位置目录/engines/sdcpp): ${folder}`)
    // 确保设备子文件夹存在
    const deviceFolders = ['cpu', 'vulkan', 'cuda']
    for (const device of deviceFolders) {
      const deviceFolder = join(folder, device)
      if (!existsSync(deviceFolder)) {
        await fs.mkdir(deviceFolder, { recursive: true })
      }
      console.log(`[Main] SD.cpp engine device folder (${device}): ${deviceFolder}`)
    }
    return folder
  } catch (error) {
    console.error('Failed to initialize default SD.cpp engine folder:', error)
    throw error
  }
})


// IPC 处理程序：获取 SD.cpp 引擎文件夹（运行位置目录下的engines/sdcpp文件夹）
ipcMain.handle('sdcpp:get-folder', async () => {
  // 如果还没有设置路径，使用默认路径
  if (!sdcppFolderPath) {
    sdcppFolderPath = getDefaultSDCppFolder()
  }
  if (sdcppFolderPath) {
    console.log(`[Main] SD.cpp engine search path (运行位置目录/engines/sdcpp): ${sdcppFolderPath}`)
  }
  return sdcppFolderPath
})

// IPC 处理程序：设置设备类型
ipcMain.handle('sdcpp:set-device', async (_, device: 'cpu' | 'vulkan' | 'cuda') => {
  sdcppDeviceType = device
  return true
})

// IPC 处理程序：获取设备类型
ipcMain.handle('sdcpp:get-device', async () => {
  return sdcppDeviceType
})

// IPC 处理程序：列出文件夹中的文件（根据设备类型）
ipcMain.handle('sdcpp:list-files', async (_, folder: string, deviceType: 'cpu' | 'vulkan' | 'cuda') => {
  try {
    const deviceFolder = join(folder, deviceType)
    console.log(`[Main] SD.cpp engine search path (${deviceType}): ${deviceFolder}`)
    if (!existsSync(deviceFolder)) {
      console.log(`[Main] SD.cpp engine device folder does not exist: ${deviceFolder}`)
      return []
    }
    
    const entries = await fs.readdir(deviceFolder, { withFileTypes: true })
    const files: Array<{ name: string; size: number; path: string; modified: number }> = []
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(deviceFolder, entry.name)
        const stats = await fs.stat(filePath)
        // 只列出引擎相关文件（参考 engines/sdcpp 结构：.exe, .dll, .txt 等）
        const ext = extname(entry.name).toLowerCase()
        const engineExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.txt']
        if (engineExtensions.includes(ext)) {
          files.push({
            name: entry.name,
            size: stats.size,
            path: filePath,
            modified: stats.mtimeMs,
          })
        }
      }
    }
    
    // 按修改时间降序排序
    files.sort((a, b) => b.modified - a.modified)
    return files
  } catch (error) {
    console.error('Failed to list files:', error)
    return []
  }
})


// IPC 处理程序：下载文件（复制到用户选择的位置）
ipcMain.handle('sdcpp:download-file', async (_, filePath: string) => {
  try {
    const window = win || BrowserWindow.getFocusedWindow()
    if (!window) {
      throw new Error('没有可用的窗口')
    }
    
    const fileName = basename(filePath)
    const result = await dialog.showSaveDialog(window, {
      title: '保存引擎文件',
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
    console.error('Failed to download file:', error)
    throw error
  }
})

// IPC 处理程序：删除文件
ipcMain.handle('sdcpp:delete-file', async (_, filePath: string) => {
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
})

app.whenReady().then(async () => {
  // 初始化默认 models 文件夹
  await initDefaultModelsFolder()
  // 初始化默认 SD.cpp 引擎文件夹
  await initDefaultSDCppFolder()
  createWindow()
})

