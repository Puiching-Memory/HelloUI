import { app, BrowserWindow, ipcMain, dialog, protocol, net, utilityProcess } from 'electron'
import { join, basename, extname, resolve, dirname, isAbsolute, relative, sep } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { promises as fs } from 'fs'
import { existsSync, createReadStream, createWriteStream, watchFile, unwatchFile } from 'fs'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'
import { spawn, exec } from 'child_process'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const archiver = require('archiver')
import { execa } from 'execa'
import { AsyncOperationGuard } from './utils/AsyncOperationGuard.js'
import { ResourceManager } from './utils/ResourceManager.js'
import { registerSystemIpc } from './ipc/system.js'
import type { DeviceType, ModelGroup, GenerateImageParams, GeneratedImageInfo } from './types/index.js'

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
let sdcppDeviceType: DeviceType = 'cuda'

// 存储当前正在运行的生成进程，用于取消生成
let currentGenerateProcess: ReturnType<typeof spawn> | null = null
let currentGenerateKill: (() => void) | null = null

// 获取运行位置目录（可执行文件所在目录）
function getRunPath(): string {
  return app.isPackaged ? dirname(process.execPath) : join(__dirname, '..')
}

// 获取 FFmpeg 可执行文件路径
function getFFmpegPath(): string {
  const runPath = getRunPath()
  return join(runPath, 'engines', 'ffmpeg', 'bin', 'ffmpeg.exe')
}

// 注意：不再需要手动转义函数，现在使用 execa 库自动处理参数转义
// execa 会自动处理包含空格、引号等特殊字符的参数，更安全可靠

// 将相对路径转换为绝对路径（基于运行路径和 models 文件夹）
function resolveModelPath(modelPath: string | undefined): string | undefined {
  if (!modelPath) {
    return undefined
  }
  
  // 如果已经是绝对路径，直接返回
  if (isAbsolute(modelPath)) {
    return modelPath
  }
  
  // 如果路径以 "models/" 开头，移除该前缀
  let normalizedPath = modelPath.replace(/^models[\/\\]/, '')
  
  // 优先尝试在当前权重文件夹中解析
  const modelsFolder = weightsFolderPath || getDefaultModelsFolder()
  const pathInModels = resolve(modelsFolder, normalizedPath)
  if (existsSync(pathInModels)) {
    return pathInModels
  }
  
  // 如果路径包含路径分隔符，说明是相对路径，基于运行路径解析（用于引擎等）
  if (normalizedPath.includes('/') || normalizedPath.includes('\\')) {
    return resolve(getRunPath(), normalizedPath)
  } else {
    // 纯文件名，假设在默认 models 文件夹中
    return join(getDefaultModelsFolder(), normalizedPath)
  }
}

/**
 * 带有进度报告的文件复制函数
 */
async function copyFileWithProgress(
  src: string,
  dest: string,
  onProgress: (chunkLength: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = createReadStream(src)
    const writeStream = createWriteStream(dest)

    readStream.on('data', (chunk) => {
      onProgress(chunk.length)
    })

    readStream.on('error', reject)
    writeStream.on('error', reject)
    writeStream.on('finish', resolve)

    readStream.pipe(writeStream)
  })
}

/**
 * 递归获取文件夹总大小
 */
async function getFolderSize(folderPath: string): Promise<number> {
  let totalSize = 0
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(folderPath, entry.name)
    if (entry.isDirectory()) {
      totalSize += await getFolderSize(fullPath)
    } else {
      const stats = await fs.stat(fullPath)
      totalSize += stats.size
    }
  }
  
  return totalSize
}

// 获取默认的 models 文件夹路径
function getDefaultModelsFolder(): string {
  return join(getRunPath(), 'models')
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
  return join(getRunPath(), 'engines', 'sdcpp')
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
  return join(getRunPath(), 'outputs')
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
  const folder = await initDefaultModelsFolder()
  weightsFolderPath = folder
  return folder
})

// IPC 处理程序：检查文件夹是否存在
ipcMain.handle('weights:check-folder', async (_, folderPath: string) => {
  return existsSync(folderPath)
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
  if (!existsSync(folder)) {
    return []
  }
  
  const files: Array<{ name: string; size: number; path: string; modified: number }> = []
  
  async function scanDir(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await scanDir(fullPath)
      } else if (entry.isFile()) {
        // 排除 JSON 配置文件，避免在权重列表中显示
        if (entry.name.toLowerCase().endsWith('.json')) {
          continue
        }
        const stats = await fs.stat(fullPath)
        files.push({
          name: relative(folder, fullPath).replace(/\\/g, '/'),
          size: stats.size,
          path: fullPath,
          modified: stats.mtimeMs,
        })
      }
    }
  }
  
  await scanDir(folder)
  files.sort((a, b) => b.modified - a.modified)
  return files
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

// IPC 处理程序：选择图片文件
ipcMain.handle('edit-image:select-file', async () => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }
  
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    title: '选择要编辑的图片',
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// 别名，用于视频生成页面
ipcMain.handle('dialog:open-image', async () => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }
  
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    title: '选择图片',
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// IPC 处理程序：读取图片文件并返回 base64 数据 URL
ipcMain.handle('edit-image:read-image-base64', async (_, filePath: string) => {
  try {
    if (!existsSync(filePath)) {
      throw new Error('文件不存在')
    }
    
    // 读取文件内容
    const fileBuffer = await fs.readFile(filePath)
    
    // 根据文件扩展名确定 MIME 类型
    const ext = extname(filePath).toLowerCase()
    let mimeType = 'image/png' // 默认值
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg'
        break
      case '.png':
        mimeType = 'image/png'
        break
      case '.bmp':
        mimeType = 'image/bmp'
        break
      case '.webp':
        mimeType = 'image/webp'
        break
      case '.gif':
        mimeType = 'image/gif'
        break
    }
    
    // 转换为 base64
    const base64 = fileBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`
    
    return dataUrl
  } catch (error) {
    console.error('Failed to read image file:', error)
    throw error
  }
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
  if (!existsSync(targetFolder)) {
    return null
  }
  
  const sourceQuickHash = await calculateQuickHash(sourcePath, sourceSize)
  const entries = await fs.readdir(targetFolder, { withFileTypes: true })
  
  // 第一级：快速检查 - 只检查文件大小相同的文件
  const candidates: Array<{ path: string; size: number }> = []
  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = join(targetFolder, entry.name)
      const stats = await fs.stat(filePath)
      if (stats.size === sourceSize) {
        candidates.push({ path: filePath, size: stats.size })
      }
    }
  }
  
  if (candidates.length === 0) {
    return null
  }
  
  // 第二级：快速采样哈希检查
  for (const candidate of candidates) {
    const candidateQuickHash = await calculateQuickHash(candidate.path, candidate.size)
    if (candidateQuickHash === sourceQuickHash) {
      return candidate.path
    }
  }
  
  return null
}

// IPC 处理程序：下载文件（复制到用户选择的位置）
ipcMain.handle('weights:download-file', async (_, filePath: string) => {
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
})

// IPC 处理程序：删除文件
ipcMain.handle('weights:delete-file', async (_, filePath: string) => {
  await fs.unlink(filePath)
  return true
})

// ========== SD.cpp 引擎相关 IPC 处理程序 ==========

// IPC 处理程序：初始化默认 SD.cpp 引擎文件夹（运行位置目录下的engines/sdcpp文件夹）
ipcMain.handle('sdcpp:init-default-folder', async () => {
  const folder = await initDefaultSDCppFolder()
  sdcppFolderPath = folder
  return folder
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
ipcMain.handle('sdcpp:set-device', async (_, device: DeviceType) => {
  sdcppDeviceType = device
  return true
})

// IPC 处理程序：获取设备类型
ipcMain.handle('sdcpp:get-device', async () => {
  return sdcppDeviceType
})

// IPC 处理程序：列出文件夹中的文件（根据设备类型）
// 获取可执行文件的版本号
async function getExecutableVersion(exePath: string): Promise<string | null> {
  const cwd = dirname(exePath)

  try {
    const { stdout, stderr } = await execa(exePath, ['--version'], {
      cwd,
      timeout: 5000
    })
    const output = (stdout || stderr || '').trim()

    if (output) {
      // 提取版本信息，例如：stable-diffusion.cpp version unknown, commit bda7fab
      const commitMatch = output.match(/commit\s+([a-f0-9]+)/i)
      const versionMatch = output.match(/version\s+([^\s,]+)/i)
      
      if (versionMatch && versionMatch[1] !== 'unknown') {
        return versionMatch[1]
      } else if (commitMatch) {
        return `commit ${commitMatch[1]}`
      } else {
        // 如果无法解析，返回原始输出的前100个字符
        return output.length > 100 ? output.substring(0, 100) + '...' : output
      }
    }
  } catch (error: any) {
    console.error(`[Main] Failed to get engine version for ${exePath}:`, error.message)
  }
  return null
}

ipcMain.handle('sdcpp:list-files', async (_, folder: string, deviceType: DeviceType) => {
  const deviceFolder = join(folder, deviceType)
  if (!existsSync(deviceFolder)) {
    return { files: [], version: null }
  }
  
  const entries = await fs.readdir(deviceFolder, { withFileTypes: true })
  const files: Array<{ name: string; size: number; path: string; modified: number }> = []
  // 目前仅支持 Windows 平台
  // TODO: 未来如需支持其他平台，可在此处添加对应的文件扩展名（如 .so 用于 Linux，.dylib 用于 macOS）
  const engineExtensions = ['.exe', '.dll', '.bin', '.txt']
  
  // 查找 sd-cli.exe 以获取引擎版本号
  let engineVersion: string | null = null
  const executableName = 'sd-cli.exe'
  const executablePath = join(deviceFolder, executableName)
  
  // 收集所有文件信息
  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (engineExtensions.includes(ext)) {
        const filePath = join(deviceFolder, entry.name)
        const stats = await fs.stat(filePath)
        files.push({
          name: entry.name,
          size: stats.size,
          path: filePath,
          modified: stats.mtimeMs,
        })
      }
    }
  }
  
  // 如果找到 sd-cli.exe，获取引擎版本号（代表整个引擎文件夹的版本）
  if (existsSync(executablePath)) {
    try {
      engineVersion = await getExecutableVersion(executablePath)
    } catch (error) {
      console.error(`Failed to get engine version for ${executablePath}:`, error)
    }
  }
  
  files.sort((a, b) => b.modified - a.modified)
  return { files, version: engineVersion }
})


// IPC 处理程序：下载文件（复制到用户选择的位置）
ipcMain.handle('sdcpp:download-file', async (_, filePath: string) => {
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
})

// IPC 处理程序：删除文件
ipcMain.handle('sdcpp:delete-file', async (_, filePath: string) => {
  await fs.unlink(filePath)
  return true
})

// ========== 模型组管理相关 IPC 处理程序 ==========

// 获取模型组配置文件的路径
function getModelGroupsFilePath(): string {
  const modelsFolder = weightsFolderPath || getDefaultModelsFolder()
  return join(modelsFolder, 'model-groups.json')
}

// 将绝对路径转换为相对于 models 文件夹的相对路径
function toRelativePath(absolutePath: string | undefined): string | undefined {
  if (!absolutePath) {
    return undefined
  }
  
  const modelsFolder = weightsFolderPath || getDefaultModelsFolder()
  
  // 如果路径已经是相对路径（不以盘符或 / 开头），直接返回
  if (!isAbsolute(absolutePath)) {
    return absolutePath
  }
  
  // 检查路径是否在 models 文件夹内
  try {
    const relativePath = relative(modelsFolder, absolutePath)
    // 如果 relative 返回的路径以 .. 开头，说明不在 models 文件夹内，保持原路径
    if (relativePath.startsWith('..')) {
      // 尝试检查是否在默认 models 文件夹内
      const defaultModelsFolder = getDefaultModelsFolder()
      if (modelsFolder !== defaultModelsFolder) {
        const relativeToDefault = relative(defaultModelsFolder, absolutePath)
        if (!relativeToDefault.startsWith('..')) {
          return relativeToDefault.replace(/\\/g, '/')
        }
      }
      console.warn(`[Main] Path ${absolutePath} is not within models folder, keeping as-is`)
      return absolutePath
    }
    // 规范化路径分隔符（统一使用正斜杠）
    return relativePath.replace(/\\/g, '/')
  } catch (error) {
    console.error(`[Main] Error converting path ${absolutePath} to relative:`, error)
    return absolutePath
  }
}

// 将模型组中的绝对路径转换为相对路径
function normalizeModelGroupPaths(group: ModelGroup): ModelGroup {
  return {
    ...group,
    sdModel: toRelativePath(group.sdModel),
    highNoiseSdModel: toRelativePath(group.highNoiseSdModel),
    vaeModel: toRelativePath(group.vaeModel),
    llmModel: toRelativePath(group.llmModel),
    clipLModel: toRelativePath(group.clipLModel),
    t5xxlModel: toRelativePath(group.t5xxlModel),
  }
}

// 加载模型组列表
async function loadModelGroups(): Promise<ModelGroup[]> {
  const filePath = getModelGroupsFilePath()
  if (!existsSync(filePath)) {
    return []
  }
  const content = await fs.readFile(filePath, 'utf-8')
  const groups = JSON.parse(content) as ModelGroup[]
  // 加载时也规范化路径，确保旧数据中的绝对路径被转换
  return groups.map(normalizeModelGroupPaths)
}

// 保存模型组列表
async function saveModelGroups(groups: ModelGroup[]): Promise<void> {
  const filePath = getModelGroupsFilePath()
  const dirPath = dirname(filePath)
  // 确保目录存在
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true })
  }
  // 保存前规范化所有路径，确保只保存相对路径
  const normalizedGroups = groups.map(normalizeModelGroupPaths)
  await fs.writeFile(filePath, JSON.stringify(normalizedGroups, null, 2), 'utf-8')
  console.log(`[Main] Saved ${normalizedGroups.length} model groups to ${filePath}`)
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
ipcMain.handle('model-groups:update', async (_, { id, updates }: { id: string, updates: Partial<Omit<ModelGroup, 'id' | 'createdAt'>> }) => {
  const groups = await loadModelGroups()
  const index = groups.findIndex(g => g.id === id)
  if (index === -1) {
    throw new Error(`模型组不存在: ${id}`)
  }

  const oldGroup = groups[index]
  const updatedGroup = {
    ...oldGroup,
    ...updates,
    updatedAt: Date.now(),
  }
  groups[index] = updatedGroup

  await saveModelGroups(groups)

  // 同时更新子文件夹内的 config.json
  try {
    // 尝试通过 sdModel 确定子文件夹
    const modelPath = oldGroup.sdModel || updatedGroup.sdModel
    if (modelPath) {
      const modelsDir = weightsFolderPath || getDefaultModelsFolder()
      const absoluteModelPath = resolve(modelsDir, modelPath)
      const groupDir = dirname(absoluteModelPath)
      const configJsonPath = join(groupDir, 'config.json')

      if (existsSync(configJsonPath)) {
        // 准备要写入 config.json 的数据
        // 排除 id, createdAt, updatedAt 等内部字段
        const { id: _id, createdAt: _ca, updatedAt: _ua, ...configData } = updatedGroup

        // 将模型路径转换为相对于 groupDir 的路径
        const modelFields = ['sdModel', 'highNoiseSdModel', 'vaeModel', 'llmModel', 'clipLModel', 't5xxlModel', 'clipVisionModel'] as const
        for (const field of modelFields) {
          const val = configData[field]
          if (val && typeof val === 'string') {
            const absPath = resolve(modelsDir, val)
            // @ts-ignore
            configData[field] = relative(groupDir, absPath).replace(/\\/g, '/')
          }
        }

        await fs.writeFile(configJsonPath, JSON.stringify(configData, null, 2), 'utf-8')
        console.log(`[Main] Updated config.json in ${groupDir}`)
      }
    }
  } catch (err) {
    console.error('[Main] Failed to update config.json in subfolder:', err)
    // 不抛出错误，以免影响主流程
  }

  return updatedGroup
})

// IPC 处理程序：删除模型组
ipcMain.handle('model-groups:delete', async (_, { id, deleteFiles }: { id: string, deleteFiles?: boolean }) => {
  console.log(`[Main] Deleting model group: ${id}, deleteFiles: ${deleteFiles}`)
  const groups = await loadModelGroups()
  const index = groups.findIndex(g => g.id === id)
  if (index === -1) {
    console.error(`[Main] Model group not found: ${id}`)
    throw new Error(`模型组不存在: ${id}`)
  }
  const deletedGroup = groups[index]

  if (deleteFiles) {
    try {
      // 尝试通过 sdModel 确定子文件夹
      const modelPath = deletedGroup.sdModel
      if (modelPath) {
        const modelsDir = weightsFolderPath || getDefaultModelsFolder()
        const absoluteModelPath = resolve(modelsDir, modelPath)
        const groupDir = dirname(absoluteModelPath)
        
        // 检查是否包含 config.json，确保这是一个模型组文件夹，避免误删
        const configJsonPath = join(groupDir, 'config.json')
        if (existsSync(configJsonPath)) {
          console.log(`[Main] Deleting model group folder: ${groupDir}`)
          await fs.rm(groupDir, { recursive: true, force: true })
        } else {
          console.warn(`[Main] Folder ${groupDir} does not contain config.json, skipping folder deletion to be safe`)
        }
      }
    } catch (err) {
      console.error('[Main] Failed to delete model group folder:', err)
      // 继续删除配置，即使文件夹删除失败
    }
  }

  groups.splice(index, 1)
  await saveModelGroups(groups)
  console.log(`[Main] Successfully deleted model group: ${deletedGroup.name} (${id})`)
  return true
})

// IPC 处理程序：获取单个模型组
ipcMain.handle('model-groups:get', async (_, id: string) => {
  const groups = await loadModelGroups()
  return groups.find(g => g.id === id) || null
})

// IPC 处理程序：选择模型组文件夹
ipcMain.handle('model-groups:select-folder', async () => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }
  
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
    title: '选择模型组文件夹',
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// IPC 处理程序：导入模型组（从文件夹导入并注册）
ipcMain.handle('model-groups:import', async (event, { folderPath, targetFolder }) => {
  try {
    if (!existsSync(folderPath)) {
      throw new Error('文件夹不存在')
    }

    if (!existsSync(targetFolder)) {
      await fs.mkdir(targetFolder, { recursive: true })
    }

    // 查找 config.json
    const configPath = join(folderPath, 'config.json')
    if (!existsSync(configPath)) {
      throw new Error('文件夹中未找到 config.json 配置文件')
    }

    const configContent = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(configContent)
    
    if (!config.name) {
      throw new Error('配置文件中缺少模型组名称 (name)')
    }

    // 为模型组创建独立的子文件夹
    const groupSubFolder = join(targetFolder, config.name)
    if (!existsSync(groupSubFolder)) {
      await fs.mkdir(groupSubFolder, { recursive: true })
    }

    // 计算总大小以报告进度
    const totalSize = await getFolderSize(folderPath)
    let totalCopied = 0

    // 将文件夹中的所有文件复制到 groupSubFolder
    const filesToCopy = await fs.readdir(folderPath)
    for (const file of filesToCopy) {
      const srcPath = join(folderPath, file)
      const destPath = join(groupSubFolder, file)
      
      const stats = await fs.stat(srcPath)
      if (stats.isDirectory()) {
        // 递归复制目录
        await fs.cp(srcPath, destPath, { recursive: true })
        totalCopied += await getFolderSize(srcPath)
        const progress = Math.round((totalCopied / totalSize) * 100)
        event.sender.send('model-groups:import-progress', { progress, copied: totalCopied, total: totalSize, fileName: file })
      } else {
        await copyFileWithProgress(srcPath, destPath, (chunkLength) => {
          totalCopied += chunkLength
          const progress = Math.round((totalCopied / totalSize) * 100)
          event.sender.send('model-groups:import-progress', { progress, copied: totalCopied, total: totalSize, fileName: file })
        })
      }
    }

    // 注册模型组
    const groups = await loadModelGroups()
    const modelFields = ['sdModel', 'highNoiseSdModel', 'vaeModel', 'llmModel', 'clipLModel', 't5xxlModel', 'clipVisionModel'] as const
    const updatedConfig = { ...config }
    
    // 更新模型路径为子文件夹中的绝对路径，以便后续 normalize
    for (const field of modelFields) {
      if (updatedConfig[field] && typeof updatedConfig[field] === 'string') {
        if (!isAbsolute(updatedConfig[field])) {
          updatedConfig[field] = join(groupSubFolder, updatedConfig[field])
        }
      }
    }

    const newGroup: ModelGroup = {
      ...updatedConfig,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    // 确保路径是相对于 models 文件夹的
    const normalizedGroup = normalizeModelGroupPaths(newGroup)
    
    groups.push(normalizedGroup)
    await saveModelGroups(groups)

    return { success: true, group: normalizedGroup }
  } catch (error) {
    console.error('[Main] Failed to import model group:', error)
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
})

// IPC 处理程序：建立并导出模型组（导出到文件夹）
ipcMain.handle('model-groups:build-and-export', async (event, groupData: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }

  try {
    const result = await dialog.showOpenDialog(window, {
      title: '选择导出目标文件夹',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '导出已取消' }
    }

    const exportPath = result.filePaths[0]
    const groupFolder = join(exportPath, groupData.name)
    
    if (!existsSync(groupFolder)) {
      await fs.mkdir(groupFolder, { recursive: true })
    }

    // 1. 准备导出的配置
    const exportedConfig = { ...groupData }
    const modelFields = ['sdModel', 'highNoiseSdModel', 'vaeModel', 'llmModel', 'clipLModel', 't5xxlModel', 'clipVisionModel'] as const
    
    // 计算总大小以报告进度
    let totalSize = 0
    const validModels: { field: string, absolutePath: string, fileName: string }[] = []

    for (const field of modelFields) {
      const modelPath = groupData[field]
      if (modelPath) {
        const absolutePath = resolveModelPath(modelPath)
        if (absolutePath && existsSync(absolutePath)) {
          const stats = await fs.stat(absolutePath)
          totalSize += stats.size
          validModels.push({ field, absolutePath, fileName: basename(absolutePath) })
        }
      }
    }

    let totalCopied = 0

    // 2. 复制模型文件到目标文件夹，并更新配置中的路径
    for (const { field, absolutePath, fileName } of validModels) {
      const destPath = join(groupFolder, fileName)
      
      // 复制文件并报告进度
      await copyFileWithProgress(absolutePath, destPath, (chunkLength) => {
        totalCopied += chunkLength
        const progress = Math.round((totalCopied / totalSize) * 100)
        event.sender.send('model-groups:export-progress', { progress, copied: totalCopied, total: totalSize, fileName })
      })
      
      // 更新 config 中的路径为文件夹内部的相对路径（即文件名）
      // @ts-ignore
      exportedConfig[field] = fileName
    }

    // 3. 写入 config.json 到目标文件夹
    await fs.writeFile(
      join(groupFolder, 'config.json'),
      JSON.stringify(exportedConfig, null, 2),
      'utf8'
    )

    return { success: true, exportPath: groupFolder }
  } catch (error) {
    console.error('[Main] Failed to export model group:', error)
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
})

// ========== 图片生成相关 IPC 处理程序 ==========

// 获取 SD.cpp 可执行文件路径
function getSDCppExecutablePath(deviceType: DeviceType): string {
  const engineFolder = sdcppFolderPath || getDefaultSDCppFolder()
  const deviceFolder = join(engineFolder, deviceType)
  // 目前仅支持 Windows 平台
  // TODO: 未来如需支持其他平台，可在此处添加平台检测逻辑
  const executableName = 'sd-cli.exe'
  return join(deviceFolder, executableName)
}

// IPC 处理程序：取消生成
ipcMain.handle('generate:cancel', async () => {
  if (currentGenerateProcess && currentGenerateKill) {
    currentGenerateKill()
    return { success: true }
  }
  return { success: false, message: '没有正在进行的生成任务' }
})

// IPC 处理程序：开始生成图片
ipcMain.handle('generate:start', async (event, params: GenerateImageParams) => {
  try {
    const { 
      groupId, deviceType, prompt, negativePrompt = '',
      steps = 20, width = 512, height = 512, cfgScale = 7.0,
      samplingMethod, scheduler, seed, batchCount = 1, threads,
      preview, previewInterval = 1, verbose = false, color = false,
      offloadToCpu = false, diffusionFa = false, controlNetCpu = false,
      clipOnCpu = false, vaeOnCpu = false, diffusionConvDirect = false,
      vaeConvDirect = false, vaeTiling = false, inputImage,
      flowShift, qwenImageZeroCondT
    } = params

    let sdModelPath: string | undefined
    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (!group || !group.sdModel) throw new Error('模型组配置错误')
      sdModelPath = resolveModelPath(group.sdModel)
      if (!sdModelPath || !existsSync(sdModelPath)) throw new Error(`模型文件不存在: ${sdModelPath}`)
    } else {
      throw new Error('必须提供模型组ID')
    }

    const isQwenEdit2511 = sdModelPath.toLowerCase().includes('qwen-image-edit-2511')
    const sdExePath = getSDCppExecutablePath(deviceType)
    if (!existsSync(sdExePath)) throw new Error(`引擎文件不存在: ${sdExePath}`)

    const outputsDir = getDefaultOutputsFolder()
    if (!existsSync(outputsDir)) await fs.mkdir(outputsDir, { recursive: true })

    const timestamp = Date.now()
    const outputImagePath = join(outputsDir, `generated_${timestamp}.png`)
    const outputMetadataPath = join(outputsDir, `generated_${timestamp}.json`)
    const previewImagePath = join(outputsDir, `preview_${timestamp}.png`)

    const args: string[] = ['--diffusion-model', sdModelPath, '--prompt', prompt]
    
    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      const taskType = group?.taskType
      args.push('-M', taskType === 'upscale' ? 'upscale' : 'img_gen')
      if (group?.vaeModel) {
        const p = resolveModelPath(group.vaeModel)
        if (p && existsSync(p)) args.push('--vae', p)
      }
      if (taskType === 'edit' && !isQwenEdit2511) {
        if (group?.clipLModel) {
          const p = resolveModelPath(group.clipLModel)
          if (p && existsSync(p)) args.push('--clip_l', p)
        }
        if (group?.t5xxlModel) {
          const p = resolveModelPath(group.t5xxlModel)
          if (p && existsSync(p)) args.push('--t5xxl', p)
        }
      } else if (group?.llmModel) {
        const p = resolveModelPath(group.llmModel)
        if (p && existsSync(p)) args.push('--llm', p)
      }
    }

    if (negativePrompt) args.push('--negative-prompt', negativePrompt)
    if (inputImage) {
      const p = resolve(inputImage)
      if (existsSync(p)) args.push(isQwenEdit2511 ? '-r' : '--init-img', p)
    }
    if (isQwenEdit2511) {
      args.push('--qwen-image-zero-cond-t')
      args.push('--flow-shift', (flowShift !== undefined ? flowShift : 3).toString())
    }

    args.push('--output', outputImagePath)
    if (steps !== 20) args.push('--steps', steps.toString())
    if (width !== 512) args.push('--width', width.toString())
    if (height !== 512) args.push('--height', height.toString())
    if (Math.abs(cfgScale - 7.0) > 0.0001) args.push('--cfg-scale', cfgScale.toString())
    if (samplingMethod?.trim()) args.push('--sampling-method', samplingMethod.trim())
    if (scheduler?.trim()) args.push('--scheduler', scheduler.trim())
    if (seed !== undefined && seed >= 0) args.push('--seed', seed.toString())
    if (batchCount > 1) args.push('--batch-count', batchCount.toString())
    
    if (threads !== undefined && threads > 0) {
      args.push('--threads', threads.toString())
    }

    if (preview && preview !== 'none' && preview.trim() !== '') {
      args.push('--preview', preview.trim())
      args.push('--preview-path', resolve(previewImagePath))
      if (previewInterval > 1) args.push('--preview-interval', previewInterval.toString())
    }

    if (verbose) args.push('--verbose')
    if (color) args.push('--color')
    if (offloadToCpu) args.push('--offload-to-cpu')
    if (diffusionFa) args.push('--diffusion-fa')
    if (controlNetCpu) args.push('--control-net-cpu')
    if (clipOnCpu) args.push('--clip-on-cpu')
    if (vaeOnCpu) args.push('--vae-on-cpu')
    if (diffusionConvDirect) args.push('--diffusion-conv-direct')
    if (vaeConvDirect) args.push('--vae-conv-direct')
    if (vaeTiling) args.push('--vae-tiling')

    console.log(`[Generate] Starting image generation (${deviceType}): ${sdExePath}`)
    const startTime = Date.now()
    event.sender.send('generate:progress', { progress: '正在启动 SD.cpp 引擎...' })

    return new Promise((resolvePromise, reject) => {
      let stdout = ''
      let stderr = ''
      let isResolved = false
      const operationGuard = new AsyncOperationGuard()
      const resourceManager = new ResourceManager()
      let childProcess: any = null

      const killProcess = () => {
        if (isResolved) return
        if (childProcess && childProcess.pid) {
          if (process.platform === 'win32') exec(`taskkill /F /T /PID ${childProcess.pid}`)
          else childProcess.kill()
        }
      }

      currentGenerateKill = killProcess

      const cleanup = () => {
        operationGuard.invalidate()
        resourceManager.cleanupAll()
        if (currentGenerateProcess === childProcess) {
          currentGenerateProcess = null
          currentGenerateKill = null
        }
      }

      const handleCompletion = async () => {
        try {
          if (!existsSync(outputImagePath)) throw new Error('未找到输出图片文件')
          const duration = Date.now() - startTime
          const metadata = {
            prompt, negativePrompt, steps, width, height, cfgScale, deviceType,
            groupId, timestamp, generatedAt: new Date().toISOString(),
            samplingMethod, scheduler, seed, batchCount, threads,
            commandLine: args.join(' '), duration, type: 'generate', mediaType: 'image'
          }
          await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
          
          const imageBuffer = await fs.readFile(outputImagePath)
          const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
          
          if (preview && preview !== 'none' && preview.trim() !== '') {
            await fs.unlink(resolve(previewImagePath)).catch(() => {})
          }

          const durationSeconds = (duration / 1000).toFixed(2)
          console.log(`[Generate] Image generation completed in ${durationSeconds}s (${duration}ms)`)
          event.sender.send('generate:progress', { progress: `生成完成（耗时: ${durationSeconds}秒）`, image: base64Image })
          resolvePromise({ success: true, image: base64Image, imagePath: outputImagePath, duration })
        } catch (e: any) {
          reject(e)
        }
      }

      childProcess = execa(sdExePath, args, { cwd: dirname(sdExePath) })
      currentGenerateProcess = childProcess

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        stdout += text
        if (operationGuard.check() && !event.sender.isDestroyed()) {
          event.sender.send('generate:cli-output', { type: 'stdout', text })
          const m = text.match(/progress[:\s]+(\d+)%/i)
          if (m) event.sender.send('generate:progress', { progress: `生成中... ${m[1]}%` })
        }
      })

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        stderr += text
        if (operationGuard.check() && !event.sender.isDestroyed()) {
          event.sender.send('generate:cli-output', { type: 'stderr', text })
        }
      })

      childProcess.on('close', (code: number, signal: string) => {
        cleanup()
        if (isResolved) return
        isResolved = true
        if (code === 0) {
          handleCompletion()
        } else {
          const wasCancelled = signal === 'SIGTERM' || signal === 'SIGKILL'
          if (wasCancelled) {
            reject(new Error('生成已取消'))
          } else {
            const errorMsg = stderr || stdout || `进程退出，代码: ${code}, 信号: ${signal}`
            reject(new Error(`图片生成失败: ${errorMsg}`))
          }
        }
      })

      childProcess.on('error', (err: Error) => {
        cleanup()
        if (isResolved) return
        isResolved = true
        reject(err)
      })

      if (preview && preview !== 'none' && preview.trim() !== '') {
        const absPath = resolve(previewImagePath)
        let lastUpdate = 0
        const watch = () => {
          if (!operationGuard.check() || !existsSync(absPath)) return
          watchFile(absPath, { interval: 200 }, async (curr, prev) => {
            if (!operationGuard.check() || (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size)) return
            const now = Date.now()
            if (now - lastUpdate < 200) return
            lastUpdate = now
            const buf = await fs.readFile(absPath)
            event.sender.send('generate:preview-update', { previewImage: `data:image/png;base64,${buf.toString('base64')}` })
          })
          resourceManager.register(() => unwatchFile(absPath), 'watcher')
        }
        setTimeout(watch, 1000)
      }
    })
  } catch (error: any) {
    console.error('[Generate] Error:', error)
    throw error
  }
})

// ========== 视频生成相关 IPC 处理程序 ==========

// 视频生成的默认负面提示词
const VIDEO_DEFAULT_NEGATIVE_PROMPT = '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走'

// IPC 处理程序：取消视频生成
ipcMain.handle('generate-video:cancel', async () => {
  if (currentGenerateProcess && !currentGenerateProcess.killed) {
    if (currentGenerateKill) {
      currentGenerateKill()
    }
    return true
  }
  return false
})

// IPC 处理程序：开始视频生成
ipcMain.handle('generate-video:start', async (event, params: GenerateImageParams & { frames?: number; fps?: number }) => {
  try {
    const { 
      groupId, deviceType, mode, initImage, prompt, negativePrompt = '',
      steps = 20, width = 512, height = 512, cfgScale = 7.0,
      samplingMethod, scheduler, seed, batchCount = 1, threads,
      preview, previewInterval = 1, verbose = false, color = false,
      offloadToCpu = false, diffusionFa = false, controlNetCpu = false,
      clipOnCpu = false, vaeOnCpu = false, diffusionConvDirect = false,
      vaeConvDirect = false, vaeTiling = false, frames = 33, fps = 8,
      flowShift = 3.0, highNoiseSteps, highNoiseCfgScale, highNoiseSamplingMethod
    } = params

    let sdModelPath: string | undefined
    let highNoiseModelPath: string | undefined
    let clipVisionModelPath: string | undefined

    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (!group || !group.sdModel) throw new Error('模型组配置错误')
      sdModelPath = resolveModelPath(group.sdModel)
      if (!sdModelPath || !existsSync(sdModelPath)) throw new Error(`模型文件不存在: ${sdModelPath}`)
      
      if (group.highNoiseSdModel) {
        highNoiseModelPath = resolveModelPath(group.highNoiseSdModel)
      }
      if (group.clipVisionModel) {
        clipVisionModelPath = resolveModelPath(group.clipVisionModel)
      }
    } else {
      throw new Error('必须提供模型组ID')
    }

    const sdExePath = getSDCppExecutablePath(deviceType)
    if (!existsSync(sdExePath)) throw new Error(`引擎文件不存在: ${sdExePath}`)

    const outputsDir = getDefaultOutputsFolder()
    if (!existsSync(outputsDir)) await fs.mkdir(outputsDir, { recursive: true })

    const timestamp = Date.now()
    const outputAviPath = join(outputsDir, `video_${timestamp}.avi`)
    const outputMp4Path = join(outputsDir, `video_${timestamp}.mp4`)
    const outputMetadataPath = join(outputsDir, `video_${timestamp}.json`)

    const args: string[] = ['-M', 'vid_gen', '--diffusion-model', sdModelPath, '--prompt', prompt]
    if (mode === 'image2video' && initImage) args.push('-i', initImage)
    
    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (group?.vaeModel) {
        const p = resolveModelPath(group.vaeModel)
        if (p && existsSync(p)) args.push('--vae', p)
      }
      if (group?.llmModel) {
        const p = resolveModelPath(group.llmModel)
        if (p && existsSync(p)) args.push('--t5xxl', p)
      }
    }

    args.push('--negative-prompt', negativePrompt || VIDEO_DEFAULT_NEGATIVE_PROMPT)
    args.push('--output', outputAviPath)
    if (highNoiseModelPath) args.push('--high-noise-diffusion-model', highNoiseModelPath)
    if (clipVisionModelPath) args.push('--clip_vision', clipVisionModelPath)
    if (frames > 0) args.push('--video-frames', frames.toString())
    if (flowShift !== undefined) args.push('--flow-shift', flowShift.toString())
    if (steps !== 20) args.push('--steps', steps.toString())
    if (highNoiseModelPath) args.push('--high-noise-steps', (highNoiseSteps || steps).toString())
    if (width !== 512) args.push('--width', width.toString())
    if (height !== 512) args.push('--height', height.toString())
    if (Math.abs(cfgScale - 7.0) > 0.0001) args.push('--cfg-scale', cfgScale.toString())
    if (highNoiseModelPath) args.push('--high-noise-cfg-scale', (highNoiseCfgScale || cfgScale).toString())
    if (samplingMethod?.trim()) args.push('--sampling-method', samplingMethod.trim())
    if (highNoiseModelPath) args.push('--high-noise-sampling-method', highNoiseSamplingMethod || samplingMethod || 'euler')
    if (scheduler?.trim()) args.push('--scheduler', scheduler.trim())
    if (seed !== undefined && seed >= 0) args.push('--seed', seed.toString())
    if (batchCount > 1) args.push('--batch-count', batchCount.toString())
    if (threads !== undefined && threads > 0) args.push('--threads', threads.toString())

    if (preview && preview !== 'none' && preview.trim() !== '') {
      const p = join(outputsDir, `preview_video_${timestamp}.png`)
      args.push('--preview', preview.trim())
      args.push('--preview-path', resolve(p))
      if (previewInterval > 1) args.push('--preview-interval', previewInterval.toString())
    }

    if (verbose) args.push('--verbose')
    if (color) args.push('--color')
    if (offloadToCpu) args.push('--offload-to-cpu')
    if (diffusionFa) args.push('--diffusion-fa')
    if (controlNetCpu) args.push('--control-net-cpu')
    if (clipOnCpu) args.push('--clip-on-cpu')
    if (vaeOnCpu) args.push('--vae-on-cpu')
    if (diffusionConvDirect) args.push('--diffusion-conv-direct')
    if (vaeConvDirect) args.push('--vae-conv-direct')
    if (vaeTiling) args.push('--vae-tiling')

    console.log(`[Generate Video] Starting video generation (${deviceType}): ${sdExePath}`)
    const startTime = Date.now()
    event.sender.send('generate-video:progress', { progress: '正在启动 SD.cpp 引擎...' })

    return new Promise((resolvePromise, reject) => {
      let stdout = ''
      let stderr = ''
      let isResolved = false
      const operationGuard = new AsyncOperationGuard()
      const resourceManager = new ResourceManager()
      let childProcess: any = null

      const killProcess = () => {
        if (isResolved) return
        if (childProcess && childProcess.pid) {
          if (process.platform === 'win32') exec(`taskkill /F /T /PID ${childProcess.pid}`)
          else childProcess.kill()
        }
      }

      currentGenerateKill = killProcess

      const cleanup = () => {
        operationGuard.invalidate()
        resourceManager.cleanupAll()
        if (currentGenerateProcess === childProcess) {
          currentGenerateProcess = null
          currentGenerateKill = null
        }
      }

      const handleVideoCompletion = async () => {
        try {
          if (!existsSync(outputAviPath)) throw new Error('未找到输出视频文件')
          event.sender.send('generate-video:progress', { progress: '正在转换视频格式 (AVI -> MP4)...' })
          const ffmpegPath = getFFmpegPath()
          if (existsSync(ffmpegPath)) {
            await execa(ffmpegPath, ['-i', outputAviPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', outputMp4Path])
            await fs.unlink(outputAviPath).catch(() => {})
          } else {
            throw new Error(`未找到 FFmpeg 引擎: ${ffmpegPath}`)
          }

          const duration = Date.now() - startTime
          const metadata = {
            prompt, negativePrompt, steps, width, height, cfgScale, deviceType,
            groupId, timestamp, generatedAt: new Date().toISOString(),
            samplingMethod, scheduler, seed, batchCount, threads,
            frames, fps, commandLine: args.join(' '), duration, type: 'video', mediaType: 'video'
          }
          await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
          const videoUrl = `media:///${outputMp4Path.replace(/\\/g, '/')}`
          event.sender.send('generate-video:progress', { progress: `生成完成`, video: videoUrl })
          resolvePromise({ success: true, video: videoUrl, videoPath: outputMp4Path, duration })
        } catch (e: any) {
          reject(e)
        }
      }

      childProcess = execa(sdExePath, args, { cwd: dirname(sdExePath) })
      currentGenerateProcess = childProcess

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        stdout += text
        if (operationGuard.check() && !event.sender.isDestroyed()) {
          event.sender.send('generate-video:cli-output', { type: 'stdout', text })
          const m = text.match(/progress[:\s]+(\d+)%/i)
          if (m) event.sender.send('generate-video:progress', { progress: `生成中... ${m[1]}%` })
        }
      })

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        stderr += text
        if (operationGuard.check() && !event.sender.isDestroyed()) {
          event.sender.send('generate-video:cli-output', { type: 'stderr', text })
        }
      })

      childProcess.on('close', (code: number) => {
        cleanup()
        if (isResolved) return
        isResolved = true
        if (code === 0) handleVideoCompletion()
        else reject(new Error(`SD.cpp 退出，错误代码: ${code}`))
      })

      childProcess.on('error', (err: Error) => {
        cleanup()
        if (isResolved) return
        isResolved = true
        reject(err)
      })
    })
  } catch (error: any) {
    console.error('[Generate Video] Error:', error)
    throw error
  }
})

// ========== 已生成图片管理相关 IPC 处理程序 ==========

// 递归查找所有 outputs 目录中的图片文件
async function findAllGeneratedImages(): Promise<GeneratedImageInfo[]> {
  const images: GeneratedImageInfo[] = []
  const outputsFolder = getDefaultOutputsFolder()
  
  if (!existsSync(outputsFolder)) {
    return images
  }

  // 支持的图片格式
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
  // 支持的视频格式
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv']
  
  const entries = await fs.readdir(outputsFolder, { withFileTypes: true })
  
  // 优化：并行处理文件，而不是串行
  const filePromises = entries.map(async (entry) => {
    if (!entry.isFile()) {
      return null
    }
    
    const ext = extname(entry.name).toLowerCase()
    const fileName = entry.name.toLowerCase()
    
    // 判断是否为图片或视频
    const isImage = imageExtensions.includes(ext)
    const isVideo = videoExtensions.includes(ext)
    
    if (!isImage && !isVideo) {
      return null
    }
    
    const filePath = join(outputsFolder, entry.name)
    
    // 并行获取文件信息和元数据
    const [stats, metadata] = await Promise.all([
      fs.stat(filePath),
      (async () => {
        let metadata: any = {}
        if (isImage) {
          const metadataPath = filePath.replace(/\.(png|jpg|jpeg|gif|bmp|webp)$/i, '.json')
          if (existsSync(metadataPath)) {
            try {
              const metadataContent = await fs.readFile(metadataPath, 'utf-8')
              metadata = JSON.parse(metadataContent)
            } catch (error) {
              console.error(`Failed to parse metadata for ${entry.name}:`, error)
            }
          }
        } else if (isVideo) {
          const metadataPath = filePath.replace(/\.(mp4|webm|avi|mov|mkv|flv|wmv)$/i, '.json')
          if (existsSync(metadataPath)) {
            try {
              const metadataContent = await fs.readFile(metadataPath, 'utf-8')
              metadata = JSON.parse(metadataContent)
            } catch (error) {
              console.error(`Failed to parse metadata for ${entry.name}:`, error)
            }
          }
        }
        return metadata
      })()
    ])
    
    // 根据文件名判断生成类型
    let generationType: 'generate' | 'edit' | 'video' | undefined = undefined
    if (fileName.startsWith('generated_')) {
      generationType = 'generate'
    } else if (fileName.startsWith('edited_') || fileName.startsWith('edit_')) {
      generationType = 'edit'
    } else if (fileName.startsWith('video_')) {
      generationType = 'video'
    }
    
    // 如果没有从文件名判断出类型，根据媒体类型推断
    if (!generationType) {
      if (isVideo) {
        generationType = 'video'
      } else {
        generationType = 'generate'  // 默认为图片生成
      }
    }
    
    // 确定媒体类型
    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'
    
    return {
      name: entry.name,
      path: filePath,
      size: stats.size,
      modified: stats.mtimeMs,
      type: generationType,
      mediaType: mediaType,
      ...metadata,
    }
  })
  
  const results = await Promise.all(filePromises)
  for (const result of results) {
    if (result) {
      images.push(result)
    }
  }
  
  // 按修改时间降序排序
  images.sort((a, b) => b.modified - a.modified)
  
  return images
}

// IPC 处理程序：列出所有已生成的图片和视频
ipcMain.handle('generated-images:list', async () => {
  const startTime = Date.now()
  const images = await findAllGeneratedImages()
  const totalTime = Date.now() - startTime
  console.log(`[GeneratedImages] Found ${images.length} files, scanning took ${totalTime}ms`)
  
  // 不再生成预览图，所有预览图都通过 generated-images:get-preview 按需加载
  return images
})

// IPC 处理程序：下载图片或视频
ipcMain.handle('generated-images:download', async (_, filePath: string) => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }
  
  const fileName = basename(filePath)
  const ext = extname(filePath).toLowerCase()
  const isVideo = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv'].includes(ext)
  
  const result = await dialog.showSaveDialog(window, {
    title: isVideo ? '保存视频' : '保存图片',
    defaultPath: fileName,
    filters: isVideo
      ? [
          { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'] },
          { name: '所有文件', extensions: ['*'] },
        ]
      : [
          { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
          { name: '所有文件', extensions: ['*'] },
        ],
  })
  
  if (!result.canceled && result.filePath) {
    await fs.copyFile(filePath, result.filePath)
    return true
  }
  return false
})

// IPC 处理程序：删除图片或视频
ipcMain.handle('generated-images:delete', async (_, filePath: string) => {
  await fs.unlink(filePath)
  
  // 删除对应的元数据文件
  const metadataPath = filePath.replace(/\.(png|jpg|jpeg|gif|bmp|webp|mp4|webm|avi|mov|mkv|flv|wmv)$/i, '.json')
  if (existsSync(metadataPath)) {
    await fs.unlink(metadataPath)
  }
  
  return true
})

// IPC 处理程序：获取图片预览（完整 base64）
ipcMain.handle('generated-images:get-preview', async (_, imagePath: string) => {
  const imageBuffer = await fs.readFile(imagePath)
  return imageBuffer.toString('base64')
})

// IPC 处理程序：获取视频数据（返回 ArrayBuffer 和 MIME 类型），用于在前端创建 Blob URL 播放本地视频
ipcMain.handle('generated-images:get-video-data', async (_, videoPath: string) => {
  const ext = extname(videoPath).toLowerCase()
  const videoBuffer = await fs.readFile(videoPath)

  let mimeType = 'video/*'
  switch (ext) {
    case '.mp4':
      mimeType = 'video/mp4'
      break
    case '.webm':
      mimeType = 'video/webm'
      break
    case '.avi':
      mimeType = 'video/x-msvideo'
      break
    case '.mov':
      mimeType = 'video/quicktime'
      break
    case '.mkv':
      mimeType = 'video/x-matroska'
      break
    case '.flv':
      mimeType = 'video/x-flv'
      break
    case '.wmv':
      mimeType = 'video/x-ms-wmv'
      break
    default:
      mimeType = 'video/*'
      break
  }

  // 返回 ArrayBuffer（通过 Uint8Array 转换）和 MIME 类型
  // 注意：Electron IPC 会自动序列化 Buffer，前端接收到的会是类似数组的对象
  return {
    data: Array.from(videoBuffer), // 转换为普通数组以便序列化
    mimeType: mimeType
  }
})

// IPC 处理程序：批量下载并打包为 ZIP
ipcMain.handle('generated-images:batch-download', async (_, filePaths: string[]) => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (!window) {
    throw new Error('没有可用的窗口')
  }
  
  if (!filePaths || filePaths.length === 0) {
    throw new Error('没有选择要下载的文件')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const defaultZipName = `generated-files-${timestamp}.zip`
  
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

      const safeReject = (error: any) => {
        if (!isResolved) {
          isResolved = true
          output.destroy()
          archive.abort()
          reject(error)
        }
      }

      // 监听输出流的错误（例如权限拒绝、磁盘满等）
      output.on('error', (err: any) => {
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
      archive.on('warning', (err: any) => {
        if (err.code === 'ENOENT') {
          console.warn('Archive warning:', err)
        } else {
          safeReject(err)
        }
      })

      // 监听归档错误
      archive.on('error', (err: any) => {
        console.error('Archive error:', err)
        safeReject(err)
      })

      // 将输出流管道连接到归档
      archive.pipe(output)

      // 添加所有文件到 ZIP
      for (const filePath of filePaths) {
        const fileName = basename(filePath)
        archive.file(filePath, { name: fileName })
      }

      archive.finalize()
    })
})

app.whenReady().then(async () => {
  registerSystemIpc({ getWindow: () => win || BrowserWindow.getFocusedWindow() })
  // 注册 media 协议以允许加载本地资源
  protocol.handle('media', (request) => {
    let filePath = decodeURIComponent(request.url.slice('media://'.length))
    
    // 处理 Windows 路径
    if (process.platform === 'win32') {
      // 如果路径以 / 开头（例如 /C:/...），移除开头的 /
      if (filePath.startsWith('/')) {
        filePath = filePath.slice(1)
      }
      // 如果路径不包含 : 但第一个部分看起来像盘符（例如 C/Users/...），补回 :
      if (!filePath.includes(':') && /^[a-zA-Z](\/|\\)/.test(filePath)) {
        filePath = filePath[0] + ':' + filePath.slice(1)
      }
    }
    
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // 初始化默认 models 文件夹
  await initDefaultModelsFolder()
  // 初始化默认 SD.cpp 引擎文件夹
  await initDefaultSDCppFolder()
  // 初始化默认 outputs 文件夹
  await initDefaultOutputsFolder()
  createWindow()
})


