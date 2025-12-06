import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { existsSync, createReadStream, createWriteStream, watchFile, unwatchFile } from 'fs'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'
import { spawn } from 'child_process'
import archiver from 'archiver'
import { AsyncOperationGuard } from './utils/AsyncOperationGuard.js'
import { ResourceManager } from './utils/ResourceManager.js'

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
  // 获取运行位置目录（可执行文件所在目录）
  let runPath: string
  if (app.isPackaged) {
    // 已打包：使用可执行文件所在目录
    runPath = dirname(process.execPath)
  } else {
    // 开发环境：使用项目根目录（__dirname指向dist-electron，需要回到项目根目录）
    runPath = join(__dirname, '..')
  }
  return join(runPath, 'models')
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

// 获取默认的 outputs 文件夹路径（运行位置目录下的outputs文件夹）
function getDefaultOutputsFolder(): string {
  // 获取运行位置目录（可执行文件所在目录）
  let runPath: string
  if (app.isPackaged) {
    // 已打包：使用可执行文件所在目录
    runPath = dirname(process.execPath)
  } else {
    // 开发环境：使用项目根目录（__dirname指向dist-electron，需要回到项目根目录）
    runPath = join(__dirname, '..')
  }
  return join(runPath, 'outputs')
}

// 初始化默认 outputs 文件夹（运行位置目录下的outputs文件夹）
async function initDefaultOutputsFolder(): Promise<string> {
  const defaultFolder = getDefaultOutputsFolder()
  if (!existsSync(defaultFolder)) {
    await fs.mkdir(defaultFolder, { recursive: true })
    console.log(`[Main] Created default outputs folder: ${defaultFolder}`)
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
    console.log(`[Main] SD.cpp engine search path (executable directory/engines/sdcpp): ${folder}`)
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
    console.log(`[Main] SD.cpp engine search path (executable directory/engines/sdcpp): ${sdcppFolderPath}`)
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

// ========== 模型组管理相关 IPC 处理程序 ==========

// 获取模型组配置文件的路径
function getModelGroupsFilePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'model-groups.json')
}

// 模型组接口定义
interface ModelGroup {
  id: string
  name: string
  sdModel?: string  // SD模型路径
  vaeModel?: string  // VAE模型路径
  llmModel?: string  // LLM/CLIP模型路径
  defaultSteps?: number  // 推荐的默认采样步数
  defaultCfgScale?: number  // 推荐的默认CFG Scale值
  defaultWidth?: number  // 推荐的默认图片宽度
  defaultHeight?: number  // 推荐的默认图片高度
  defaultSamplingMethod?: string  // 推荐的默认采样方法
  defaultScheduler?: string  // 推荐的默认调度器
  defaultSeed?: number  // 推荐的默认种子（-1表示随机）
  createdAt: number
  updatedAt: number
}

// 加载模型组列表
async function loadModelGroups(): Promise<ModelGroup[]> {
  try {
    const filePath = getModelGroupsFilePath()
    if (!existsSync(filePath)) {
      return []
    }
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as ModelGroup[]
  } catch (error) {
    console.error('Failed to load model groups:', error)
    return []
  }
}

// 保存模型组列表
async function saveModelGroups(groups: ModelGroup[]): Promise<void> {
  try {
    const filePath = getModelGroupsFilePath()
    await fs.writeFile(filePath, JSON.stringify(groups, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save model groups:', error)
    throw error
  }
}

// IPC 处理程序：获取所有模型组
ipcMain.handle('model-groups:list', async () => {
  return await loadModelGroups()
})

// IPC 处理程序：创建模型组
ipcMain.handle('model-groups:create', async (_, group: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
  const groups = await loadModelGroups()
  const newGroup: ModelGroup = {
    ...group,
    id: Date.now().toString(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  groups.push(newGroup)
  await saveModelGroups(groups)
  return newGroup
})

// IPC 处理程序：更新模型组
ipcMain.handle('model-groups:update', async (_, id: string, updates: Partial<Omit<ModelGroup, 'id' | 'createdAt'>>) => {
  const groups = await loadModelGroups()
  const index = groups.findIndex(g => g.id === id)
  if (index === -1) {
    throw new Error(`模型组不存在: ${id}`)
  }
  groups[index] = {
    ...groups[index],
    ...updates,
    updatedAt: Date.now(),
  }
  await saveModelGroups(groups)
  return groups[index]
})

// IPC 处理程序：删除模型组
ipcMain.handle('model-groups:delete', async (_, id: string) => {
  const groups = await loadModelGroups()
  const index = groups.findIndex(g => g.id === id)
  if (index === -1) {
    throw new Error(`模型组不存在: ${id}`)
  }
  groups.splice(index, 1)
  await saveModelGroups(groups)
  return true
})

// IPC 处理程序：获取单个模型组
ipcMain.handle('model-groups:get', async (_, id: string) => {
  const groups = await loadModelGroups()
  return groups.find(g => g.id === id) || null
})

// ========== 图片生成相关 IPC 处理程序 ==========

// 获取 SD.cpp 可执行文件路径
function getSDCppExecutablePath(deviceType: 'cpu' | 'vulkan' | 'cuda'): string {
  const engineFolder = sdcppFolderPath || getDefaultSDCppFolder()
  const deviceFolder = join(engineFolder, deviceType)
  // Windows 使用 .exe，其他平台可能没有扩展名
  const executableName = process.platform === 'win32' ? 'sd.exe' : 'sd'
  return join(deviceFolder, executableName)
}

// IPC 处理程序：开始生成图片
ipcMain.handle('generate:start', async (event, params: {
  groupId?: string  // 使用模型组ID
  modelPath?: string  // 兼容旧版本：直接使用模型路径
  deviceType: 'cpu' | 'vulkan' | 'cuda'
  prompt: string
  negativePrompt?: string
  steps?: number  // 采样步数，默认 20
  width?: number  // 图片宽度，默认 512
  height?: number  // 图片高度，默认 512
  cfgScale?: number  // CFG scale，默认 7.0
  samplingMethod?: string  // 采样方法
  scheduler?: string  // 调度器
  seed?: number  // 种子，undefined 表示随机
  batchCount?: number  // 批次数量，默认 1
  threads?: number  // 线程数，undefined 表示自动
  preview?: string  // 预览方法
  previewInterval?: number  // 预览间隔
  verbose?: boolean  // 详细输出
  color?: boolean  // 彩色日志
  offloadToCpu?: boolean  // 卸载到CPU
}) => {
  try {
    const { 
      groupId, 
      modelPath, 
      deviceType, 
      prompt, 
      negativePrompt = '',
      steps = 20,
      width = 512,
      height = 512,
      cfgScale = 7.0,
      samplingMethod,
      scheduler,
      seed,
      batchCount = 1,
      threads,
      preview,
      previewInterval = 1,
      verbose = false,
      color = false,
      offloadToCpu = false
    } = params

    // 确定使用的模型路径
    let sdModelPath: string | undefined

    if (groupId) {
      // 使用模型组
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (!group) {
        throw new Error(`模型组不存在: ${groupId}`)
      }
      if (!group.sdModel) {
        throw new Error('模型组中未配置SD模型')
      }
      sdModelPath = group.sdModel
      
      // 检查模型文件是否存在
      if (!existsSync(sdModelPath)) {
        throw new Error(`SD模型文件不存在: ${sdModelPath}`)
      }
    } else if (modelPath) {
      // 兼容旧版本：直接使用模型路径
      sdModelPath = modelPath
      if (!existsSync(sdModelPath)) {
        throw new Error(`模型文件不存在: ${sdModelPath}`)
      }
    } else {
      throw new Error('必须提供模型组ID或模型路径')
    }

    // 获取 SD.cpp 可执行文件路径
    const sdExePath = getSDCppExecutablePath(deviceType)
    if (!existsSync(sdExePath)) {
      throw new Error(`SD.cpp 引擎文件不存在: ${sdExePath}\n请确保已正确安装 ${deviceType.toUpperCase()} 版本的 SD.cpp 引擎`)
    }

    // 生成输出图片路径（保存在运行路径下的 outputs 目录）
    const outputsDir = getDefaultOutputsFolder()
    if (!existsSync(outputsDir)) {
      await fs.mkdir(outputsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const outputImagePath = join(outputsDir, `generated_${timestamp}.png`)
    const outputMetadataPath = join(outputsDir, `generated_${timestamp}.json`)
    const previewImagePath = join(outputsDir, `preview_${timestamp}.png`)

    // 构建命令行参数
    // 根据 sd.exe 的参数要求：
    // 必需参数：model_path/diffusion_model (位置参数) 或 --diffusion-model <string>
    // 使用 --diffusion-model 参数指定扩散模型路径
    const args: string[] = [
      '--diffusion-model', sdModelPath,
      '--prompt', prompt,
    ]
    
    // 添加 VAE 和 LLM 模型支持
    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (group?.vaeModel && existsSync(group.vaeModel)) {
        args.push('--vae', group.vaeModel)
      }
      // 添加 LLM 文本编码器支持（用于某些模型如 Z-Image 等）
      if (group?.llmModel && existsSync(group.llmModel)) {
        args.push('--llm', group.llmModel)
      }
      // 注意：根据 sd.exe 的帮助，还可能需要 clip_l, clip_g, clip_vision, t5xxl 等
      // 可以根据具体模型类型进一步扩展
    }

    if (negativePrompt) {
      args.push('--negative-prompt', negativePrompt)
    }

    args.push('--output', outputImagePath)

    // 添加高级参数
    if (steps !== 20) {
      args.push('--steps', steps.toString())
    }
    if (width !== 512) {
      args.push('--width', width.toString())
    }
    if (height !== 512) {
      args.push('--height', height.toString())
    }
    // 使用浮点数比较而非严格相等，避免精度问题
    if (Math.abs(cfgScale - 7.0) > 0.0001) {
      args.push('--cfg-scale', cfgScale.toString())
    }

    // 添加采样方法（如果指定了）
    if (samplingMethod && typeof samplingMethod === 'string' && samplingMethod.trim() !== '') {
      args.push('--sampling-method', samplingMethod.trim())
      console.log(`[Generate] Sampling method: ${samplingMethod}`)
    }

    // 添加调度器（如果指定了）
    if (scheduler && typeof scheduler === 'string' && scheduler.trim() !== '') {
      args.push('--scheduler', scheduler.trim())
      console.log(`[Generate] Scheduler: ${scheduler}`)
    }

    // 添加种子（如果指定了且 >= 0）
    if (seed !== undefined && seed >= 0) {
      args.push('--seed', seed.toString())
      console.log(`[Generate] Seed: ${seed}`)
    }

    // 添加批次数量（如果 > 1）
    if (batchCount !== undefined && batchCount > 1) {
      args.push('--batch-count', batchCount.toString())
      console.log(`[Generate] Batch count: ${batchCount}`)
    }

    // 添加线程数（如果指定了且 > 0）
    if (threads !== undefined && threads > 0) {
      args.push('--threads', threads.toString())
      console.log(`[Generate] Threads: ${threads}`)
    }

    // 添加预览选项（如果指定了且不是 'none'）
    if (preview && preview !== 'none' && preview.trim() !== '') {
      args.push('--preview', preview.trim())
      // 使用绝对路径，确保 SD.cpp 能找到预览文件
      const absolutePreviewPath: string = resolve(previewImagePath)
      args.push('--preview-path', absolutePreviewPath)
      console.log(`[Generate] Preview method: ${preview}`)
      console.log(`[Generate] Preview path (absolute): ${absolutePreviewPath}`)
      // 只有当预览间隔 > 1 时才添加参数（1 是默认值）
      if (previewInterval !== undefined && previewInterval > 1) {
        args.push('--preview-interval', previewInterval.toString())
        console.log(`[Generate] Preview interval: ${previewInterval}`)
      }
    }

    // 添加详细输出（如果启用）
    if (verbose === true) {
      args.push('--verbose')
      console.log(`[Generate] Verbose: enabled`)
    }

    // 添加彩色日志（如果启用）
    if (color === true) {
      args.push('--color')
      console.log(`[Generate] Color: enabled`)
    }

    // 添加卸载到CPU（如果启用）
    if (offloadToCpu === true) {
      args.push('--offload-to-cpu')
      console.log(`[Generate] Offload to CPU: enabled`)
    }

    console.log(`[Generate] Starting image generation: ${sdExePath}`)
    console.log(`[Generate] Command line arguments: ${args.join(' ')}`)

    // 发送进度更新
    event.sender.send('generate:progress', { progress: '正在启动 SD.cpp 引擎...' })

    return new Promise((resolvePromise, reject) => {
      const childProcess = spawn(sdExePath, args, {
        cwd: dirname(sdExePath),
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let isResolved = false
      let lastPreviewUpdate = 0
      
      // 使用资源管理器和异步操作保护器
      const resourceManager = new ResourceManager()
      const operationGuard = new AsyncOperationGuard()

      // 存储强制终止超时，不通过 resourceManager 管理，避免被过早清理
      let killTimeout: NodeJS.Timeout | null = null

      // 辅助函数：安全地终止进程
      const killProcess = () => {
        if (childProcess && !childProcess.killed && childProcess.pid) {
          try {
            // 如果已经有未完成的 kill timeout，先清理它
            if (killTimeout) {
              clearTimeout(killTimeout)
              killTimeout = null
            }

            // 在 Windows 上使用 taskkill，在其他平台上使用 kill
            if (process.platform === 'win32') {
              childProcess.kill('SIGTERM')
              // 如果进程在 3 秒后仍未退出，强制终止
              // 注意：不注册到 resourceManager，避免被 cleanup() 过早清除
              killTimeout = setTimeout(() => {
                if (childProcess && !childProcess.killed && childProcess.pid) {
                  try {
                    childProcess.kill('SIGKILL')
                  } catch (e) {
                    console.error('[Generate] Failed to force kill process:', e)
                  }
                }
                killTimeout = null
              }, 3000)
            } else {
              childProcess.kill('SIGTERM')
              // 如果进程在 3 秒后仍未退出，强制终止
              // 注意：不注册到 resourceManager，避免被 cleanup() 过早清除
              killTimeout = setTimeout(() => {
                if (childProcess && !childProcess.killed && childProcess.pid) {
                  try {
                    childProcess.kill('SIGKILL')
                  } catch (e) {
                    console.error('[Generate] Failed to force kill process:', e)
                  }
                }
                killTimeout = null
              }, 3000)
            }
          } catch (error) {
            console.error('[Generate] Error killing process:', error)
          }
        }
      }

      // 统一的清理函数
      const cleanup = () => {
        operationGuard.invalidate()
        // 清理强制终止超时（如果存在）
        if (killTimeout) {
          clearTimeout(killTimeout)
          killTimeout = null
        }
        resourceManager.cleanupAll()
      }

      // 清理除 kill timeout 之外的所有资源（用于 safeReject）
      const cleanupExceptKillTimeout = () => {
        operationGuard.invalidate()
        // 不清理 killTimeout，让它继续运行直到进程退出或超时
        resourceManager.cleanupAll()
      }

      // 安全地拒绝 Promise 并终止进程
      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true
          killProcess() // 先调用 killProcess，设置 timeout（不注册到 resourceManager）
          cleanupExceptKillTimeout() // 清理其他资源，但保留 kill timeout 直到进程退出或超时
          reject(error)
        }
      }

      // 安全地解决 Promise
      const safeResolve = (value: any) => {
        if (!isResolved) {
          isResolved = true
          cleanup()
          resolvePromise(value)
        }
      }

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        console.log(`[SD.cpp stdout] ${text}`)
        
        // 使用异步操作保护器保护发送操作
        operationGuard.executeSync(() => {
          if (!event.sender || event.sender.isDestroyed()) {
            return null
          }
          
          // 发送完整的 CLI 输出到渲染进程
          event.sender.send('generate:cli-output', { 
            type: 'stdout', 
            text: text 
          })
          
          // 解析输出，提取进度信息
          // SD.cpp 通常会输出进度信息，我们可以尝试提取
          const progressMatch = text.match(/progress[:\s]+(\d+)%/i)
          if (progressMatch) {
            const progress = parseInt(progressMatch[1])
            event.sender.send('generate:progress', { progress: `生成中... ${progress}%` })
          } else if (text.includes('Generating') || text.includes('generating')) {
            event.sender.send('generate:progress', { progress: '正在生成图片...' })
          } else if (text.includes('Loading') || text.includes('loading')) {
            event.sender.send('generate:progress', { progress: '正在加载模型...' })
          }
          return null
        })
      })

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderr += text
        console.error(`[SD.cpp stderr] ${text}`)
        
        // 使用异步操作保护器保护发送操作
        operationGuard.executeSync(() => {
          if (!event.sender || event.sender.isDestroyed()) {
            return null
          }
          
          // 发送完整的 CLI 输出到渲染进程
          event.sender.send('generate:cli-output', { 
            type: 'stderr', 
            text: text 
          })
          return null
        })
      })

      // 设置预览图片文件监听（如果启用了预览）
      if (preview && preview !== 'none' && preview.trim() !== '') {
        // 使用绝对路径进行监听
        const absolutePreviewPath: string = resolve(previewImagePath)
        
        // 读取预览图片的函数
        const readPreviewImage = async () => {
          return await operationGuard.execute(async () => {
            if (!event.sender || event.sender.isDestroyed()) {
              return null
            }
            
            if (existsSync(absolutePreviewPath)) {
              const imageBuffer = await fs.readFile(absolutePreviewPath)
              const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
              
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('generate:preview-update', { previewImage: base64Image })
              }
            }
            return null
          })
        }

        // 延迟启动监听，等待文件创建
        const previewSetupTimeout = setTimeout(async () => {
          if (!operationGuard.check() || !event.sender || event.sender.isDestroyed()) {
            return
          }

          // 如果文件已存在，立即读取一次
          if (existsSync(absolutePreviewPath)) {
            await readPreviewImage()
          }

          if (!operationGuard.check() || !event.sender || event.sender.isDestroyed()) {
            return
          }

          try {
            // 使用 watchFile 而不是 watch，因为 watchFile 是专门为监控单个文件设计的
            // watchFile 使用轮询机制，对于文件监控更可靠
            watchFile(absolutePreviewPath, { interval: 200 }, async (curr, prev) => {
              // 检查文件大小或修改时间是否改变
              if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
                // 防抖：避免过于频繁的更新（至少间隔 200ms）
                const now = Date.now()
                if (now - lastPreviewUpdate < 200) {
                  return
                }
                lastPreviewUpdate = now
                
                await operationGuard.execute(async () => {
                  await readPreviewImage()
                  return null
                })
              }
            })
            
            // 注册文件监控清理函数
            resourceManager.register(
              () => {
                try {
                  unwatchFile(absolutePreviewPath)
                } catch (error) {
                  console.error('[Generate] Error unwatching preview file:', error)
                }
              },
              'watcher'
            )
          } catch (error) {
            console.error('[Generate] Failed to watch preview file:', error)
            // 如果文件还不存在或监听失败，使用轮询方式检查
            if (!operationGuard.check() || !event.sender || event.sender.isDestroyed()) {
              return
            }
            
            let pollCount = 0
            const maxPollCount = 60 // 最多轮询 60 次（30秒）
            const intervalId = setInterval(async () => {
              if (!operationGuard.check()) {
                clearInterval(intervalId)
                return
              }
              
              pollCount++
              if (pollCount > maxPollCount) {
                clearInterval(intervalId)
                console.log(`[Generate] Stopped polling for preview file after ${maxPollCount} attempts`)
                return
              }
              
              if (existsSync(absolutePreviewPath)) {
                await readPreviewImage()
                // 文件已创建，尝试启动监听
                try {
                  if (operationGuard.check() && event.sender && !event.sender.isDestroyed()) {
                    watchFile(absolutePreviewPath, { interval: 200 }, async (curr, prev) => {
                      if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
                        const now = Date.now()
                        if (now - lastPreviewUpdate < 200) {
                          return
                        }
                        lastPreviewUpdate = now
                        console.log(`[Generate] Preview file changed, reading...`)
                        
                        await operationGuard.execute(async () => {
                          await readPreviewImage()
                          return null
                        })
                      }
                    })
                    
                    // 注册文件监控清理函数
                    resourceManager.register(
                      () => {
                        try {
                          unwatchFile(absolutePreviewPath)
                        } catch (error) {
                          console.error('[Generate] Error unwatching preview file:', error)
                        }
                      },
                      'watcher'
                    )
                    
                    // 停止轮询
                    clearInterval(intervalId)
                  }
                } catch (error) {
                  console.error('[Generate] Failed to watch preview file after polling:', error)
                  // 继续轮询
                }
              }
            }, 500) // 每 500ms 检查一次文件是否存在并读取
            
            // 注册轮询清理函数
            resourceManager.register(
              () => clearInterval(intervalId),
              'interval'
            )
          }
        }, 1000) // 延迟 1 秒启动监听
        
        // 注册延迟定时器清理函数
        resourceManager.register(
          () => clearTimeout(previewSetupTimeout),
          'timeout'
        )
      }

      childProcess.on('error', (error) => {
        console.error('[Generate] Failed to start process:', error)
        event.sender.send('generate:progress', { progress: `错误: ${error.message}` })
        safeReject(new Error(`无法启动 SD.cpp 引擎: ${error.message}`))
      })

      childProcess.on('exit', async (code, signal) => {
        // 使用统一的清理函数
        cleanup()

        if (isResolved) return

        if (code === 0) {
          // 生成成功
          if (existsSync(outputImagePath)) {
            try {
              // 获取模型组信息（如果有）
              let groupName: string | undefined
              let vaeModelPath: string | undefined
              let llmModelPath: string | undefined
              
              if (groupId) {
                const groups = await loadModelGroups()
                const group = groups.find(g => g.id === groupId)
                if (group) {
                  groupName = group.name
                  vaeModelPath = group.vaeModel
                  llmModelPath = group.llmModel
                }
              }
              
              // 保存生成参数元数据
              const metadata = {
                prompt,
                negativePrompt,
                steps,
                width,
                height,
                cfgScale,
                deviceType,
                groupId: groupId || null,
                groupName: groupName || null,
                modelPath: sdModelPath,
                vaeModelPath: vaeModelPath || null,
                llmModelPath: llmModelPath || null,
                timestamp,
                generatedAt: new Date().toISOString(),
                samplingMethod: samplingMethod || null,
                scheduler: scheduler || null,
                seed: seed !== undefined ? seed : null,
                batchCount,
                threads: threads !== undefined ? threads : null,
                preview: preview || null,
                previewInterval: previewInterval || null,
                verbose,
                color,
                offloadToCpu,
                commandLine: args.join(' '), // 保存完整命令行用于重现
              }
              
              await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
              
              // 读取生成的图片并转换为 base64
              const imageBuffer = await fs.readFile(outputImagePath)
              const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
              
              // 删除预览图片文件（如果存在）
              if (preview && preview !== 'none' && preview.trim() !== '') {
                const absolutePreviewPath = resolve(previewImagePath)
                try {
                  if (existsSync(absolutePreviewPath)) {
                    await fs.unlink(absolutePreviewPath)
                    console.log(`[Generate] Deleted preview image: ${absolutePreviewPath}`)
                  }
                } catch (error) {
                  // 如果删除失败，只记录错误，不影响生成结果
                  console.error(`[Generate] Failed to delete preview image: ${absolutePreviewPath}`, error)
                }
              }
              
              event.sender.send('generate:progress', { 
                progress: '生成完成',
                image: base64Image 
              })
              
              safeResolve({
                success: true,
                image: base64Image,
                imagePath: outputImagePath,
              })
            } catch (error) {
              console.error('[Generate] Failed to read image:', error)
              safeReject(new Error(`读取生成的图片失败: ${error instanceof Error ? error.message : String(error)}`))
            }
          } else {
            safeReject(new Error('生成完成但未找到输出图片文件'))
          }
        } else {
          // 生成失败，也尝试删除预览图片
          if (preview && preview !== 'none' && preview.trim() !== '') {
            const absolutePreviewPath = resolve(previewImagePath)
            try {
              if (existsSync(absolutePreviewPath)) {
                await fs.unlink(absolutePreviewPath)
                console.log(`[Generate] Deleted preview image after failure: ${absolutePreviewPath}`)
              }
            } catch (error) {
              console.error(`[Generate] Failed to delete preview image after failure: ${absolutePreviewPath}`, error)
            }
          }
          
          // 生成失败
          const errorMsg = stderr || stdout || `进程退出，代码: ${code}, 信号: ${signal}`
          console.error('[Generate] Generation failed:', errorMsg)
          event.sender.send('generate:progress', { progress: `生成失败: ${errorMsg}` })
          safeReject(new Error(`图片生成失败: ${errorMsg}`))
        }
      })
    })
  } catch (error) {
    console.error('[Generate] Failed to generate image:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    // 注意：如果进程已经在 Promise 中启动，它会在 Promise 的 reject 处理中被终止
    // 但如果错误发生在 spawn 之前，则不需要终止进程
    throw new Error(`生成图片失败: ${errorMessage}`)
  }
})

// ========== 已生成图片管理相关 IPC 处理程序 ==========

// 递归查找所有 outputs 目录中的图片文件
async function findAllGeneratedImages(): Promise<Array<{ 
  name: string
  path: string
  size: number
  modified: number
  width?: number
  height?: number
  prompt?: string
  negativePrompt?: string
  steps?: number
  cfgScale?: number
  deviceType?: string
  groupId?: string | null
  groupName?: string | null
  modelPath?: string
  vaeModelPath?: string | null
  llmModelPath?: string | null
  samplingMethod?: string | null
  scheduler?: string | null
  seed?: number | null
  batchCount?: number
  threads?: number | null
  preview?: string | null
  previewInterval?: number | null
  verbose?: boolean
  color?: boolean
  offloadToCpu?: boolean
  commandLine?: string
  generatedAt?: string
}>> {
  const images: Array<{ 
    name: string
    path: string
    size: number
    modified: number
    width?: number
    height?: number
    prompt?: string
    negativePrompt?: string
    steps?: number
    cfgScale?: number
    deviceType?: string
    groupId?: string | null
    groupName?: string | null
    modelPath?: string
    vaeModelPath?: string | null
    llmModelPath?: string | null
    samplingMethod?: string | null
    scheduler?: string | null
    seed?: number | null
    batchCount?: number
    threads?: number | null
    preview?: string | null
    previewInterval?: number | null
    verbose?: boolean
    color?: boolean
    offloadToCpu?: boolean
    commandLine?: string
    generatedAt?: string
  }> = []
  const outputsFolder = getDefaultOutputsFolder()
  
  if (!existsSync(outputsFolder)) {
    return images
  }

  // 支持的图片格式
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
  
  // 扫描 outputs 文件夹中的图片
  try {
    const entries = await fs.readdir(outputsFolder, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (imageExtensions.includes(ext)) {
          const filePath = join(outputsFolder, entry.name)
          const stats = await fs.stat(filePath)
          
          // 尝试读取对应的元数据文件
          const metadataPath = filePath.replace(/\.(png|jpg|jpeg|gif|bmp|webp)$/i, '.json')
          let metadata: any = {}
          
          if (existsSync(metadataPath)) {
            try {
              const metadataContent = await fs.readFile(metadataPath, 'utf-8')
              metadata = JSON.parse(metadataContent)
            } catch (error) {
              console.error(`Failed to read metadata for ${filePath}:`, error)
            }
          }
          
          images.push({
            name: entry.name,
            path: filePath,
            size: stats.size,
            modified: stats.mtimeMs,
            width: metadata.width,
            height: metadata.height,
            prompt: metadata.prompt,
            negativePrompt: metadata.negativePrompt,
            steps: metadata.steps,
            cfgScale: metadata.cfgScale,
            deviceType: metadata.deviceType,
            groupId: metadata.groupId,
            groupName: metadata.groupName,
            modelPath: metadata.modelPath,
            vaeModelPath: metadata.vaeModelPath,
            llmModelPath: metadata.llmModelPath,
            samplingMethod: metadata.samplingMethod,
            scheduler: metadata.scheduler,
            seed: metadata.seed,
            batchCount: metadata.batchCount,
            threads: metadata.threads,
            preview: metadata.preview,
            previewInterval: metadata.previewInterval,
            verbose: metadata.verbose,
            color: metadata.color,
            offloadToCpu: metadata.offloadToCpu,
            commandLine: metadata.commandLine,
            generatedAt: metadata.generatedAt,
          })
        }
      }
    }
  } catch (error) {
    console.error(`Failed to scan outputs folder ${outputsFolder}:`, error)
  }
  
  // 按修改时间降序排序
  images.sort((a, b) => b.modified - a.modified)
  
  return images
}

// IPC 处理程序：列出所有已生成的图片
ipcMain.handle('generated-images:list', async () => {
  try {
    const images = await findAllGeneratedImages()
    // 为每个图片生成预览（完整文件，base64）
    // 注意：如果图片很多或很大，可以考虑只加载缩略图
    const imagesWithPreview = await Promise.all(
      images.map(async (image) => {
        try {
          // 读取完整图片文件用于预览
          // 如果文件太大（>5MB），跳过预览以提高性能
          const stats = await fs.stat(image.path)
          if (stats.size > 5 * 1024 * 1024) {
            // 文件太大，不生成预览
            // 返回原始对象，但不设置previewImage字段
            // 注意：preview字段（预览方法字符串）和previewImage字段（base64图片）是不同的字段
            return image
          }
          
          const imageBuffer = await fs.readFile(image.path)
          // 明确设置previewImage字段（base64图片）
          // 注意：preview字段（预览方法字符串）和previewImage字段（base64图片）是不同的字段
          // preview字段来自元数据，表示生成时使用的预览方法（"proj", "tae", "vae", "none"）
          // previewImage字段是图片文件的base64编码，用于在UI中显示
          return {
            ...image,
            previewImage: imageBuffer.toString('base64'),
          }
        } catch (error) {
          console.error(`Failed to generate preview for ${image.path}:`, error)
          // 读取失败时，返回原始对象，但不设置previewImage字段
          return image
        }
      })
    )
    return imagesWithPreview
  } catch (error) {
    console.error('Failed to list generated images:', error)
    return []
  }
})

// IPC 处理程序：下载图片
ipcMain.handle('generated-images:download', async (_, imagePath: string) => {
  try {
    const window = win || BrowserWindow.getFocusedWindow()
    if (!window) {
      throw new Error('没有可用的窗口')
    }
    
    const fileName = basename(imagePath)
    const result = await dialog.showSaveDialog(window, {
      title: '保存图片',
      defaultPath: fileName,
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    
    if (!result.canceled && result.filePath) {
      await fs.copyFile(imagePath, result.filePath)
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to download image:', error)
    throw error
  }
})

// IPC 处理程序：删除图片
ipcMain.handle('generated-images:delete', async (_, imagePath: string) => {
  try {
    if (!existsSync(imagePath)) {
      throw new Error('图片文件不存在')
    }
    
    // 删除图片文件
    await fs.unlink(imagePath)
    
    // 删除对应的 JSON 元数据文件（如果存在）
    const metadataPath = imagePath.replace(/\.(png|jpg|jpeg|gif|bmp|webp)$/i, '.json')
    if (existsSync(metadataPath)) {
      try {
        await fs.unlink(metadataPath)
        console.log(`[GeneratedImages] Deleted metadata file: ${metadataPath}`)
      } catch (metadataError) {
        // 如果删除元数据文件失败，记录错误但不影响图片删除
        console.error(`[GeneratedImages] Failed to delete metadata file ${metadataPath}:`, metadataError)
      }
    }
    
    return true
  } catch (error) {
    console.error('[GeneratedImages] Failed to delete image:', error)
    throw error
  }
})

// IPC 处理程序：获取图片预览（完整 base64）
ipcMain.handle('generated-images:get-preview', async (_, imagePath: string) => {
  try {
    if (!existsSync(imagePath)) {
      throw new Error('图片文件不存在')
    }
    const imageBuffer = await fs.readFile(imagePath)
    return imageBuffer.toString('base64')
  } catch (error) {
    console.error('Failed to get image preview:', error)
    throw error
  }
})

// IPC 处理程序：批量下载并打包为 ZIP
ipcMain.handle('generated-images:batch-download', async (_, imagePaths: string[]) => {
  try {
    const window = win || BrowserWindow.getFocusedWindow()
    if (!window) {
      throw new Error('没有可用的窗口')
    }
    
    if (!imagePaths || imagePaths.length === 0) {
      throw new Error('没有选择要下载的图片')
    }

    // 验证所有文件是否存在
    for (const imagePath of imagePaths) {
      if (!existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`)
      }
    }

    // 生成 ZIP 文件名（使用时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const defaultZipName = `generated-images-${timestamp}.zip`
    
    // 让用户选择保存位置
    const result = await dialog.showSaveDialog(window, {
      title: '保存压缩包',
      defaultPath: defaultZipName,
      filters: [
        { name: 'ZIP 文件', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    const zipPath = result.filePath
    
    // 创建 ZIP 文件
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      })

      let isResolved = false

      // 安全地解决 Promise
      const safeResolve = (value: any) => {
        if (!isResolved) {
          isResolved = true
          resolve(value)
        }
      }

      // 安全地拒绝 Promise
      const safeReject = (error: any) => {
        if (!isResolved) {
          isResolved = true
          // 清理资源：关闭输出流和归档
          try {
            output.destroy()
          } catch (e) {
            console.error('Error destroying output stream:', e)
          }
          try {
            archive.abort()
          } catch (e) {
            console.error('Error aborting archive:', e)
          }
          reject(error)
        }
      }

      // 监听输出流的错误（例如权限拒绝、磁盘满等）
      output.on('error', (err) => {
        console.error('Output stream error:', err)
        safeReject(new Error(`写入ZIP文件失败: ${err.message}`))
      })

      // 监听所有归档数据都写入完成
      output.on('close', () => {
        if (!isResolved) {
          console.log(`ZIP file created: ${zipPath} (${archive.pointer()} bytes)`)
          safeResolve({ success: true, zipPath, size: archive.pointer() })
        }
      })

      // 监听警告（例如 stat 失败等）
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Archive warning:', err)
        } else {
          safeReject(err)
        }
      })

      // 监听归档错误
      archive.on('error', (err) => {
        console.error('Archive error:', err)
        safeReject(err)
      })

      // 将输出流管道连接到归档
      archive.pipe(output)

      // 添加所有图片文件到 ZIP
      for (const imagePath of imagePaths) {
        const fileName = basename(imagePath)
        archive.file(imagePath, { name: fileName })
      }

      // 完成归档（即我们已经附加了所有文件，但流必须完成）
      archive.finalize()
    })
  } catch (error) {
    console.error('Failed to batch download images:', error)
    throw error
  }
})

app.whenReady().then(async () => {
  // 初始化默认 models 文件夹
  await initDefaultModelsFolder()
  // 初始化默认 SD.cpp 引擎文件夹
  await initDefaultSDCppFolder()
  // 初始化默认 outputs 文件夹
  await initDefaultOutputsFolder()
  createWindow()
})

