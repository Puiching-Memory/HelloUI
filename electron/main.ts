import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
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
ipcMain.handle('sdcpp:set-device', async (_, device: 'cpu' | 'vulkan' | 'cuda') => {
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
  return new Promise((resolve) => {
    // sd-cli.exe 已经内置 UTF-8 支持（PR 1101），无需手动设置代码页
    const command = `"${exePath}" --version`
    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        // 如果命令执行失败，返回 null
        resolve(null)
        return
      }
      
      // 解析版本信息
      const output = (stdout || stderr || '').trim()
      if (output) {
        // 提取版本信息，例如：stable-diffusion.cpp version unknown, commit bda7fab
        // 尝试提取 commit hash 或版本号
        const commitMatch = output.match(/commit\s+([a-f0-9]+)/i)
        const versionMatch = output.match(/version\s+([^\s,]+)/i)
        
        if (versionMatch && versionMatch[1] !== 'unknown') {
          resolve(versionMatch[1])
        } else if (commitMatch) {
          resolve(`commit ${commitMatch[1]}`)
        } else {
          // 如果无法解析，返回原始输出的前100个字符
          resolve(output.length > 100 ? output.substring(0, 100) + '...' : output)
        }
      } else {
        resolve(null)
      }
    })
  })
}

ipcMain.handle('sdcpp:list-files', async (_, folder: string, deviceType: 'cpu' | 'vulkan' | 'cuda') => {
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
  const modelsFolder = getDefaultModelsFolder()
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
      groupId, 
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
      offloadToCpu = false,
      diffusionFa = false,
      controlNetCpu = false,
      clipOnCpu = false,
      vaeOnCpu = false,
      diffusionConvDirect = false,
      vaeConvDirect = false,
      vaeTiling = false,
      inputImage,
      flowShift,
      qwenImageZeroCondT
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
      // 将相对路径转换为绝对路径
      const resolvedSdModelPath = resolveModelPath(group.sdModel)
      if (!resolvedSdModelPath) {
        throw new Error('无法解析SD模型路径')
      }
      sdModelPath = resolvedSdModelPath
      
      // 检查模型文件是否存在
      if (!existsSync(sdModelPath)) {
        throw new Error(`SD模型文件不存在: ${sdModelPath}`)
      }
    } else {
      throw new Error('必须提供模型组ID')
    }

    // 检测是否为 Qwen Image Edit 2511 模型
    const isQwenEdit2511 = sdModelPath.toLowerCase().includes('qwen-image-edit-2511')

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
    // 不再需要日志文件，直接通过 stdout/stderr 捕获输出

    // 构建命令行参数
    // 根据 sd-cli.exe 的参数要求：
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
      
      // 根据任务类型添加 mode 参数
      const taskType = group?.taskType
      if (taskType === 'upscale') {
        args.push('-M', 'upscale')
      } else {
        // generate 和 edit 都使用 img_gen
        args.push('-M', 'img_gen')
      }
      
      if (group?.vaeModel) {
        // 将相对路径转换为绝对路径
        const vaeModelPath = resolveModelPath(group.vaeModel)
        if (vaeModelPath && existsSync(vaeModelPath)) {
          args.push('--vae', vaeModelPath)
        }
      }
      
      // 根据任务类型选择不同的文本编码器模型
      if (taskType === 'edit' && !isQwenEdit2511) {
        // 普通图片编辑任务：使用 CLIP L 和 T5XXL 模型
        if (group?.clipLModel) {
          const clipLModelPath = resolveModelPath(group.clipLModel)
          if (clipLModelPath && existsSync(clipLModelPath)) {
            args.push('--clip_l', clipLModelPath)
            console.log(`[Generate] CLIP L model: ${clipLModelPath}`)
          }
        }
        if (group?.t5xxlModel) {
          const t5xxlModelPath = resolveModelPath(group.t5xxlModel)
          if (t5xxlModelPath && existsSync(t5xxlModelPath)) {
            args.push('--t5xxl', t5xxlModelPath)
            console.log(`[Generate] T5XXL model: ${t5xxlModelPath}`)
          }
        }
      } else {
        // 其他任务类型或 Qwen 2511：使用 LLM 文本编码器支持
        if (group?.llmModel) {
          // 将相对路径转换为绝对路径
          const llmModelPath = resolveModelPath(group.llmModel)
          if (llmModelPath && existsSync(llmModelPath)) {
            args.push('--llm', llmModelPath)
          }
        }
      }
    }

    if (negativePrompt) {
      args.push('--negative-prompt', negativePrompt)
    }

    // 添加输入图片（用于图片编辑和上采样）
    if (inputImage) {
      const inputImagePath = resolve(inputImage)
      if (existsSync(inputImagePath)) {
        if (isQwenEdit2511) {
          // Qwen 2511 使用 -r 参数作为参考图片
          args.push('-r', inputImagePath)
          console.log(`[Generate] Qwen 2511 Reference image: ${inputImagePath}`)
        } else {
          // 统一使用 --init-img 参数
          args.push('--init-img', inputImagePath)
          console.log(`[Generate] Input image: ${inputImagePath}`)
        }
      } else {
        throw new Error(`输入图片文件不存在: ${inputImagePath}`)
      }
    }

    // Qwen Image Edit 2511 特有参数
    if (isQwenEdit2511) {
      // 必须启用 --qwen-image-zero-cond-t
      args.push('--qwen-image-zero-cond-t')
      console.log(`[Generate] Qwen 2511: Enabled --qwen-image-zero-cond-t`)
      
      // 默认使用 flow-shift 3
      const finalFlowShift = flowShift !== undefined ? flowShift : 3
      args.push('--flow-shift', finalFlowShift.toString())
      console.log(`[Generate] Qwen 2511: Flow shift set to ${finalFlowShift}`)
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

    // 添加 diffusion-fa 选项（如果启用）
    if (diffusionFa === true) {
      args.push('--diffusion-fa')
      console.log(`[Generate] Diffusion FA: enabled`)
    }

    // 添加 control-net-cpu 选项（如果启用）
    if (controlNetCpu === true) {
      args.push('--control-net-cpu')
      console.log(`[Generate] ControlNet CPU: enabled`)
    }

    // 添加 clip-on-cpu 选项（如果启用）
    if (clipOnCpu === true) {
      args.push('--clip-on-cpu')
      console.log(`[Generate] CLIP on CPU: enabled`)
    }

    // 添加 vae-on-cpu 选项（如果启用）
    if (vaeOnCpu === true) {
      args.push('--vae-on-cpu')
      console.log(`[Generate] VAE on CPU: enabled`)
    }

    // 添加 diffusion-conv-direct 选项（如果启用）
    if (diffusionConvDirect === true) {
      args.push('--diffusion-conv-direct')
      console.log(`[Generate] Diffusion Conv Direct: enabled`)
    }

    // 添加 vae-conv-direct 选项（如果启用）
    if (vaeConvDirect === true) {
      args.push('--vae-conv-direct')
      console.log(`[Generate] VAE Conv Direct: enabled`)
    }

    // 添加 vae-tiling 选项（如果启用）
    if (vaeTiling === true) {
      args.push('--vae-tiling')
      console.log(`[Generate] VAE Tiling: enabled`)
    }

    console.log(`[Generate] Starting image generation: ${sdExePath}`)
    console.log(`[Generate] Command line arguments: ${args.join(' ')}`)

    // 记录生成开始时间
    const startTime = Date.now()

    // 发送进度更新
    event.sender.send('generate:progress', { progress: '正在启动 SD.cpp 引擎...' })

    return new Promise((resolvePromise, reject) => {
      // 使用 execa 库来执行命令，它自动处理参数转义，无需手动转义
      // execa 会自动转义包含空格、引号等特殊字符的参数，更安全可靠
      // 现在不再需要输出重定向到文件，可以直接捕获 stdout 和 stderr
      
      console.log(`[Generate] Starting image generation: ${sdExePath}`)
      console.log(`[Generate] Command line arguments: ${args.join(' ')}`)
      
      // 使用 execa 执行命令，自动处理参数转义
      const childProcess = execa(sdExePath, args, {
        cwd: dirname(sdExePath),
        // execa 会自动处理参数转义，无需手动转义
        // 在 Windows 上，execa 会自动使用正确的转义规则
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

      // 存储当前生成进程引用
      currentGenerateProcess = childProcess

      // 直接捕获 stdout 和 stderr（不再需要文件重定向）
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const text = data.toString('utf8')
          stdout += text
          
          if (operationGuard.check() && !event.sender.isDestroyed()) {
            // 发送输出
            event.sender.send('generate:cli-output', { type: 'stdout', text })
            
            // 进度检测逻辑
            const progressMatch = text.match(/progress[:\s]+(\d+)%/i)
            if (progressMatch) {
              event.sender.send('generate:progress', { progress: `生成中... ${progressMatch[1]}%` })
            } else if (text.includes('Generating') || text.includes('generating')) {
              event.sender.send('generate:progress', { progress: '正在生成图片...' })
            } else if (text.includes('Loading') || text.includes('loading')) {
              event.sender.send('generate:progress', { progress: '正在加载模型...' })
            }
          }
        })
      }
      
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString('utf8')
          stderr += text
          
          if (operationGuard.check() && !event.sender.isDestroyed()) {
            // 发送错误输出
            event.sender.send('generate:cli-output', { type: 'stderr', text })
          }
        })
      }

      const killProcess = () => {
        if (childProcess && !childProcess.killed && childProcess.pid) {
          if (killTimeout) {
            clearTimeout(killTimeout)
            killTimeout = null
          }

          const pid = childProcess.pid
          console.log(`[Generate] Attempting to kill process tree (PID: ${pid})`)
          
          // 在 Windows 上，使用 taskkill 来终止整个进程树（包括所有子进程）
          // /F = 强制终止，/T = 终止进程树，/PID = 指定进程ID
          // 这样可以确保 sdcpp 进程也被终止
          if (process.platform === 'win32') {
            // 首先尝试通过 PID 终止进程树
            exec(`taskkill /F /T /PID ${pid}`, (error) => {
              if (error) {
                console.warn(`[Generate] Failed to kill process tree by PID: ${error.message}`)
                // 如果通过 PID 失败，尝试通过进程名称终止 sdcpp
                // 获取可执行文件名（不包含路径）
                const exeName = basename(sdExePath)
                console.log(`[Generate] Attempting to kill process by name: ${exeName}`)
                exec(`taskkill /F /T /IM ${exeName}`, (nameError) => {
                  if (nameError) {
                    console.warn(`[Generate] Failed to kill process by name: ${nameError.message}`)
                  } else {
                    console.log(`[Generate] Successfully killed process by name: ${exeName}`)
                  }
                  // 无论成功与否，都尝试标准的 kill 方法作为最后手段
                  try {
                    childProcess.kill('SIGTERM')
                  } catch (e) {
                    console.warn(`[Generate] Failed to send SIGTERM: ${e}`)
                  }
                })
              } else {
                console.log(`[Generate] Successfully killed process tree (PID: ${pid})`)
              }
            })
          } else {
            // 非 Windows 平台使用标准方法
            childProcess.kill('SIGTERM')
            killTimeout = setTimeout(() => {
              if (childProcess && !childProcess.killed && childProcess.pid) {
                childProcess.kill('SIGKILL')
              }
              killTimeout = null
            }, 3000)
          }
        }
      }

      // 保存 killProcess 函数以便外部调用
      currentGenerateKill = killProcess

      // 统一的清理函数
      const cleanup = () => {
        operationGuard.invalidate()
        // 清理强制终止超时（如果存在）
        if (killTimeout) {
          clearTimeout(killTimeout)
          killTimeout = null
        }
        resourceManager.cleanupAll()
        // 清除当前生成进程引用
        if (currentGenerateProcess === childProcess) {
          currentGenerateProcess = null
          currentGenerateKill = null
        }
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

      // 不再需要文件监听，直接通过 stdout/stderr 事件捕获输出

      // 设置预览图片文件监听
      if (preview && preview !== 'none' && preview.trim() !== '') {
        const absolutePreviewPath = resolve(previewImagePath)
        
        const readPreviewImage = async () => {
          if (!operationGuard.check() || event.sender.isDestroyed() || !existsSync(absolutePreviewPath)) {
            return
          }
          
          const imageBuffer = await fs.readFile(absolutePreviewPath)
          const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
          event.sender.send('generate:preview-update', { previewImage: base64Image })
        }

        setTimeout(() => {
          if (!operationGuard.check()) return
          
          watchFile(absolutePreviewPath, { interval: 200 }, (curr, prev) => {
            if (!operationGuard.check() || curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) {
              return
            }
            
            const now = Date.now()
            if (now - lastPreviewUpdate < 200) return
            lastPreviewUpdate = now
            
            readPreviewImage()
          })
          
          resourceManager.register(() => unwatchFile(absolutePreviewPath), 'watcher')
        }, 1000)
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
              // 计算生成耗时（毫秒）
              const endTime = Date.now()
              const duration = endTime - startTime
              
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
                diffusionFa,
                controlNetCpu,
                clipOnCpu,
                vaeOnCpu,
                diffusionConvDirect,
                vaeConvDirect,
                vaeTiling,
                commandLine: args.join(' '), // 保存完整命令行用于重现
                duration, // 生成耗时（毫秒）
              }
              
              await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
              
              // 读取生成的图片并转换为 base64
              const imageBuffer = await fs.readFile(outputImagePath)
              const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
              
              // 删除预览图片文件
              if (preview && preview !== 'none' && preview.trim() !== '') {
                const absolutePreviewPath = resolve(previewImagePath)
                if (existsSync(absolutePreviewPath)) {
                  await fs.unlink(absolutePreviewPath)
                }
              }
              
              // 格式化耗时显示（秒，保留2位小数）
              const durationSeconds = (duration / 1000).toFixed(2)
              console.log(`[Generate] Image generation completed in ${durationSeconds}s (${duration}ms)`)
              
              event.sender.send('generate:progress', { 
                progress: `生成完成（耗时: ${durationSeconds}秒）`,
                image: base64Image 
              })
              
              safeResolve({
                success: true,
                image: base64Image,
                imagePath: outputImagePath,
                duration, // 返回耗时（毫秒）
              })
            } catch (error) {
              console.error('[Generate] Failed to read image:', error)
              safeReject(new Error(`读取生成的图片失败: ${error instanceof Error ? error.message : String(error)}`))
            }
          } else {
            safeReject(new Error('生成完成但未找到输出图片文件'))
          }
        } else {
          // 计算生成耗时（毫秒）
          const endTime = Date.now()
          const duration = endTime - startTime
          const durationSeconds = (duration / 1000).toFixed(2)
          
          if (preview && preview !== 'none' && preview.trim() !== '') {
            const absolutePreviewPath = resolve(previewImagePath)
            if (existsSync(absolutePreviewPath)) {
              await fs.unlink(absolutePreviewPath)
            }
          }
          
          // 检查是否是取消操作（信号为 SIGTERM 或 SIGKILL）
          const wasCancelled = signal === 'SIGTERM' || signal === 'SIGKILL'
          
          if (wasCancelled) {
            console.log(`[Generate] Image generation cancelled after ${durationSeconds}s (${duration}ms)`)
            event.sender.send('generate:progress', { progress: `生成已取消（耗时: ${durationSeconds}秒）` })
            safeReject(new Error('生成已取消'))
          } else {
            // 从日志文件读取错误信息
            let errorMsg = stderr || stdout
            // 使用捕获的 stderr 或 stdout 作为错误信息
            // 不再需要读取日志文件，直接使用捕获的输出
            if (!errorMsg) {
              errorMsg = `进程退出，代码: ${code}, 信号: ${signal}`
            }
            console.log(`[Generate] Image generation failed after ${durationSeconds}s (${duration}ms)`)
            const errorPreview = errorMsg.length > 100 ? errorMsg.slice(0, 100) + '...' : errorMsg
            event.sender.send('generate:progress', { progress: `生成失败: ${errorPreview}（耗时: ${durationSeconds}秒）` })
            safeReject(new Error(`图片生成失败: ${errorMsg.slice(0, 500)}`))
          }
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
      groupId, 
      deviceType, 
      mode,
      initImage,
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
      offloadToCpu = false,
      diffusionFa = false,
      controlNetCpu = false,
      clipOnCpu = false,
      vaeOnCpu = false,
      diffusionConvDirect = false,
      vaeConvDirect = false,
      vaeTiling = false,
      frames = 33, // 视频帧数
      fps = 8, // 帧率
      flowShift = 3.0, // Flow Shift
      highNoiseSteps,
      highNoiseCfgScale,
      highNoiseSamplingMethod
    } = params

    // 确定使用的模型路径
    let sdModelPath: string | undefined
    let highNoiseModelPath: string | undefined
    let clipVisionModelPath: string | undefined

    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (!group) {
        throw new Error(`模型组不存在: ${groupId}`)
      }
      if (!group.sdModel) {
        throw new Error('模型组中未配置SD模型')
      }
      const resolvedSdModelPath = resolveModelPath(group.sdModel)
      if (!resolvedSdModelPath) {
        throw new Error('无法解析SD模型路径')
      }
      sdModelPath = resolvedSdModelPath
      if (!existsSync(sdModelPath)) {
        throw new Error(`SD模型文件不存在: ${sdModelPath}`)
      }

      // 如果模型组配置了高噪声模型，在此解析路径
      if (group.highNoiseSdModel) {
        const candidate = resolveModelPath(group.highNoiseSdModel)
        if (!candidate) {
          throw new Error('无法解析高噪声SD模型路径')
        }
        if (!existsSync(candidate)) {
          throw new Error(`高噪声SD模型文件不存在: ${candidate}`)
        }
        highNoiseModelPath = candidate
      }

      // 如果模型组配置了 CLIP Vision 模型，在此解析路径
      if (group.clipVisionModel) {
        const candidate = resolveModelPath(group.clipVisionModel)
        if (candidate && existsSync(candidate)) {
          clipVisionModelPath = candidate
        }
      }
    } else {
      throw new Error('必须提供模型组ID')
    }

    // 获取 SD.cpp 可执行文件路径
    const sdExePath = getSDCppExecutablePath(deviceType)
    if (!existsSync(sdExePath)) {
      throw new Error(`SD.cpp 引擎文件不存在: ${sdExePath}\n请确保已正确安装 ${deviceType.toUpperCase()} 版本的 SD.cpp 引擎`)
    }

    // 生成输出视频路径（保存在运行路径下的 outputs 目录）
    const outputsDir = getDefaultOutputsFolder()
    if (!existsSync(outputsDir)) {
      await fs.mkdir(outputsDir, { recursive: true })
    }

    const timestamp = Date.now()
    // CLI 直接输出 AVI 视频文件，之后我们会用 ffmpeg 转换为 MP4
    const outputAviPath = join(outputsDir, `video_${timestamp}.avi`)
    const outputMp4Path = join(outputsDir, `video_${timestamp}.mp4`)
    const outputMetadataPath = join(outputsDir, `video_${timestamp}.json`)

    // 构建命令行参数
    // 参考 sd-cli.exe 视频生成功能：使用模块 vid_gen
    const args: string[] = [
      '-M', 'vid_gen',
      '--diffusion-model', sdModelPath,
      '--prompt', prompt,
    ]

    // 如果是图片生成视频模式，添加初始图片
    if (mode === 'image2video' && initImage) {
      args.push('-i', initImage)
    }
    
    // 添加 VAE 和 文本编码器（T5/LLM）模型支持
    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (group?.vaeModel) {
        const vaeModelPath = resolveModelPath(group.vaeModel)
        if (vaeModelPath && existsSync(vaeModelPath)) {
          args.push('--vae', vaeModelPath)
        }
      }
      if (group?.llmModel) {
        const llmModelPath = resolveModelPath(group.llmModel)
        if (llmModelPath && existsSync(llmModelPath)) {
          // 在视频任务中，我们将该字段视为文本编码器（如 T5），对应 --t5xxl
          args.push('--t5xxl', llmModelPath)
        }
      }
    }

    // 视频生成：如果用户提供了负面提示词，使用用户的；否则使用默认的
    const finalNegativePrompt = negativePrompt || VIDEO_DEFAULT_NEGATIVE_PROMPT
    args.push('--negative-prompt', finalNegativePrompt)

    // CLI 直接输出 AVI 视频文件
    args.push('--output', outputAviPath)

    // 如果存在高噪声模型，则启用 --high-noise-diffusion-model
    if (highNoiseModelPath) {
      args.push('--high-noise-diffusion-model', highNoiseModelPath)
    }

    // 如果存在 CLIP Vision 模型，则启用 --clip_vision
    if (clipVisionModelPath) {
      args.push('--clip_vision', clipVisionModelPath)
    }

    // 视频帧数，对应示例命令中的 --video-frames
    if (frames && frames > 0) {
      args.push('--video-frames', frames.toString())
    }

    // Flow Shift 参数 (Wan2.2 特有)
    if (flowShift !== undefined) {
      args.push('--flow-shift', flowShift.toString())
    }

    // 添加高级参数
    if (steps !== 20) {
      args.push('--steps', steps.toString())
    }
    
    // 高噪声路径的步数
    if (highNoiseModelPath) {
      const finalHighNoiseSteps = highNoiseSteps || steps
      args.push('--high-noise-steps', finalHighNoiseSteps.toString())
    }

    if (width !== 512) {
      args.push('--width', width.toString())
    }
    if (height !== 512) {
      args.push('--height', height.toString())
    }
    
    if (Math.abs(cfgScale - 7.0) > 0.0001) {
      args.push('--cfg-scale', cfgScale.toString())
    }

    // 高噪声路径的 CFG scale
    if (highNoiseModelPath) {
      const finalHighNoiseCfgScale = highNoiseCfgScale || cfgScale
      args.push('--high-noise-cfg-scale', finalHighNoiseCfgScale.toString())
    }

    if (samplingMethod && typeof samplingMethod === 'string' && samplingMethod.trim() !== '') {
      const method = samplingMethod.trim()
      args.push('--sampling-method', method)
    }

    // 高噪声路径的采样方法
    if (highNoiseModelPath) {
      const finalHighNoiseMethod = highNoiseSamplingMethod || samplingMethod || 'euler'
      args.push('--high-noise-sampling-method', finalHighNoiseMethod)
    }

    if (scheduler && typeof scheduler === 'string' && scheduler.trim() !== '') {
      args.push('--scheduler', scheduler.trim())
    }

    if (seed !== undefined && seed >= 0) {
      args.push('--seed', seed.toString())
    }

    if (batchCount !== undefined && batchCount > 1) {
      args.push('--batch-count', batchCount.toString())
    }

    if (threads !== undefined && threads > 0) {
      args.push('--threads', threads.toString())
    }

    if (preview && preview !== 'none' && preview.trim() !== '') {
      const previewImagePath = join(outputsDir, `preview_video_${timestamp}.png`)
      args.push('--preview', preview.trim())
      args.push('--preview-path', resolve(previewImagePath))
      if (previewInterval !== undefined && previewInterval > 1) {
        args.push('--preview-interval', previewInterval.toString())
      }
    }

    if (verbose === true) {
      args.push('--verbose')
    }

    if (color === true) {
      args.push('--color')
    }

    if (offloadToCpu === true) {
      args.push('--offload-to-cpu')
    }

    if (diffusionFa === true) {
      args.push('--diffusion-fa')
    }

    if (controlNetCpu === true) {
      args.push('--control-net-cpu')
    }

    if (clipOnCpu === true) {
      args.push('--clip-on-cpu')
    }

    if (vaeOnCpu === true) {
      args.push('--vae-on-cpu')
    }

    if (diffusionConvDirect === true) {
      args.push('--diffusion-conv-direct')
    }

    if (vaeConvDirect === true) {
      args.push('--vae-conv-direct')
    }

    if (vaeTiling === true) {
      args.push('--vae-tiling')
    }

    console.log(`[Generate Video] Starting video generation: ${sdExePath}`)
    console.log(`[Generate Video] Command line arguments: ${args.join(' ')}`)
    console.log(`[Generate Video] Frames: ${frames}, FPS: ${fps}`)

    const startTime = Date.now()

    event.sender.send('generate-video:progress', { progress: '正在启动 SD.cpp 引擎...' })

    return new Promise((resolvePromise, reject) => {
      // 使用 execa 库来执行命令，它自动处理参数转义，无需手动转义
      // execa 会自动转义包含空格、引号等特殊字符的参数，更安全可靠
      
      // 使用 execa 执行命令，自动处理参数转义
      const childProcess = execa(sdExePath, args, {
        cwd: dirname(sdExePath),
        // execa 会自动处理参数转义，无需手动转义
        // 在 Windows 上，execa 会自动使用正确的转义规则
      })

      let stdout = ''
      let stderr = ''
      let isResolved = false
      
      const resourceManager = new ResourceManager()
      const operationGuard = new AsyncOperationGuard()

      let killTimeout: NodeJS.Timeout | null = null

      currentGenerateProcess = childProcess

      const killProcess = () => {
        if (childProcess && !childProcess.killed && childProcess.pid) {
          if (killTimeout) {
            clearTimeout(killTimeout)
            killTimeout = null
          }

          const pid = childProcess.pid
          console.log(`[Generate Video] Attempting to kill process tree (PID: ${pid})`)
          
          if (process.platform === 'win32') {
            exec(`taskkill /F /T /PID ${pid}`, (error) => {
              if (error) {
                console.warn(`[Generate Video] Failed to kill process tree by PID: ${error.message}`)
                const exeName = basename(sdExePath)
                exec(`taskkill /F /T /IM ${exeName}`, (nameError) => {
                  if (nameError) {
                    console.warn(`[Generate Video] Failed to kill process by name: ${nameError.message}`)
                  }
                })
              }
            })
          } else {
            childProcess.kill('SIGTERM')
            killTimeout = setTimeout(() => {
              if (childProcess && !childProcess.killed && childProcess.pid) {
                childProcess.kill('SIGKILL')
              }
              killTimeout = null
            }, 3000)
          }
        }
      }

      currentGenerateKill = killProcess

      const cleanup = () => {
        operationGuard.invalidate()
        if (killTimeout) {
          clearTimeout(killTimeout)
          killTimeout = null
        }
        resourceManager.cleanupAll()
        if (currentGenerateProcess === childProcess) {
          currentGenerateProcess = null
          currentGenerateKill = null
        }
      }

      const cleanupExceptKillTimeout = () => {
        operationGuard.invalidate()
        resourceManager.cleanupAll()
      }

      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true
          killProcess()
          cleanupExceptKillTimeout()
          reject(error)
        }
      }

      const safeResolve = (value: any) => {
        if (!isResolved) {
          isResolved = true
          cleanup()
          resolvePromise(value)
        }
      }

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        stdout += text
        console.log(`[SD.cpp stdout RAW] length=${data.length}, text="${text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`)
        
        if (!operationGuard.check() || event.sender.isDestroyed()) {
          return
        }
        
        // 直接发送原始数据块，不做任何处理
        event.sender.send('generate-video:cli-output', { type: 'stdout', text, raw: true })
        
        // 进度检测逻辑（基于原始数据块）
        const progressMatch = text.match(/progress[:\s]+(\d+)%/i)
        if (progressMatch) {
          event.sender.send('generate-video:progress', { progress: `生成中... ${progressMatch[1]}%` })
        } else if (text.includes('Generating') || text.includes('generating')) {
          event.sender.send('generate-video:progress', { progress: '正在生成视频...' })
        } else if (text.includes('Loading') || text.includes('loading')) {
          event.sender.send('generate-video:progress', { progress: '正在加载模型...' })
        }
      })

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        stderr += text
        console.error(`[SD.cpp stderr RAW] length=${data.length}, text="${text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`)
        
        if (!operationGuard.check() || event.sender.isDestroyed()) {
          return
        }
        
        // 直接发送原始数据块，不做任何处理
        event.sender.send('generate-video:cli-output', { type: 'stderr', text, raw: true })
      })

      childProcess.on('error', (error: Error) => {
        console.error('[Generate Video] Failed to start process:', error)
        event.sender.send('generate-video:progress', { progress: `错误: ${error.message}` })
        safeReject(new Error(`无法启动 SD.cpp 引擎: ${error.message}`))
      })

      childProcess.on('exit', async (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup()

        if (isResolved) return

        if (code === 0) {
          // 生成成功
          try {
            const endTime = Date.now()
            const duration = endTime - startTime

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

            // 检查视频文件是否存在
            if (!existsSync(outputAviPath)) {
              safeReject(new Error('生成完成但未找到输出视频文件'))
              return
            }

            // 转换 AVI 到 MP4
            try {
              event.sender.send('generate-video:progress', { progress: '正在转换视频格式 (AVI -> MP4)...' })
              const ffmpegPath = getFFmpegPath()
              if (existsSync(ffmpegPath)) {
                // 使用 ffmpeg 转换，libx264 编码，yuv420p 像素格式以确保浏览器兼容性
                await execa(ffmpegPath, [
                  '-i', outputAviPath,
                  '-c:v', 'libx264',
                  '-pix_fmt', 'yuv420p',
                  '-y',
                  outputMp4Path
                ])
                console.log(`[Generate Video] FFmpeg conversion completed: ${outputMp4Path}`)
                
                // 转换成功后删除原始 AVI 文件
                await fs.unlink(outputAviPath).catch(err => console.warn(`[Generate Video] Failed to delete AVI: ${err.message}`))
              } else {
                console.warn(`[Generate Video] FFmpeg not found at ${ffmpegPath}, skipping conversion.`)
                // 如果没有 ffmpeg，我们只能报错，因为用户明确要求转换
                throw new Error(`未找到 FFmpeg 引擎: ${ffmpegPath}`)
              }
            } catch (convError) {
              console.error('[Generate Video] FFmpeg conversion failed:', convError)
              safeReject(new Error(`视频转换失败: ${convError instanceof Error ? convError.message : String(convError)}`))
              return
            }

            // 自动删除可能存在的预览 AVI 文件
            const previewAviPath = join(outputsDir, `preview_video_${timestamp}.avi`)
            if (existsSync(previewAviPath)) {
              await fs.unlink(previewAviPath).catch(() => {})
            }

            const durationSeconds = (duration / 1000).toFixed(2)
            console.log(`[Generate Video] Video generation completed in ${durationSeconds}s (${duration}ms)`)

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
              diffusionFa,
              controlNetCpu,
              clipOnCpu,
              vaeOnCpu,
              diffusionConvDirect,
              vaeConvDirect,
              vaeTiling,
              frames,
              fps,
              commandLine: args.join(' '),
              duration,
              type: 'video' as const,
              mediaType: 'video' as const,
            }

            await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

            // 发送完成消息（使用 media:/// 协议 URL）
            const videoFileUrl = `media:///${outputMp4Path.replace(/\\/g, '/')}`
            event.sender.send('generate-video:progress', {
              progress: `生成完成（耗时: ${durationSeconds}秒）`,
              video: videoFileUrl,
            })

            safeResolve({
              success: true,
              video: videoFileUrl,
              videoPath: outputMp4Path,
              duration,
            })
          } catch (error) {
            console.error('[Generate Video] Failed to process generated video:', error)
            safeReject(new Error(`处理生成视频失败: ${error instanceof Error ? error.message : String(error)}`))
          }
        } else {
          const endTime = Date.now()
          const duration = endTime - startTime
          const durationSeconds = (duration / 1000).toFixed(2)
          
          const wasCancelled = signal === 'SIGTERM' || signal === 'SIGKILL'
          
          if (wasCancelled) {
            console.log(`[Generate Video] Video generation cancelled after ${durationSeconds}s (${duration}ms)`)
            event.sender.send('generate-video:progress', { progress: `生成已取消（耗时: ${durationSeconds}秒）` })
            safeReject(new Error('生成已取消'))
          } else {
            const errorMsg = stderr || stdout || `进程退出，代码: ${code}, 信号: ${signal}`
            console.log(`[Generate Video] Video generation failed after ${durationSeconds}s (${duration}ms)`)
            event.sender.send('generate-video:progress', { progress: `生成失败: ${errorMsg}（耗时: ${durationSeconds}秒）` })
            safeReject(new Error(`视频生成失败: ${errorMsg}`))
          }
        }
      })
    })
  } catch (error) {
    console.error('[Generate Video] Failed to generate video:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`生成视频失败: ${errorMessage}`)
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

      // 添加所有文件到 ZIP
      for (const filePath of filePaths) {
        const fileName = basename(filePath)
        archive.file(filePath, { name: fileName })
      }

      archive.finalize()
    })
})

// IPC 处理程序：切换开发者工具（打开/关闭）
ipcMain.handle('devtools:toggle', async () => {
  const window = win || BrowserWindow.getFocusedWindow()
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
    try {
      window.webContents.toggleDevTools()
      return { success: true, isOpen: window.webContents.isDevToolsOpened() }
    } catch (error) {
      console.error('Failed to toggle DevTools:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  return { success: false, error: 'No available window' }
})

// IPC 处理程序：获取应用版本号
ipcMain.handle('app:get-version', async () => {
  return app.getVersion()
})

// IPC 处理程序：阿里通义 API 调用
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
    console.error('Aliyun API call failed:', error)
    return {
      status: 500,
      statusText: 'Internal Server Error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
})

app.whenReady().then(async () => {
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


