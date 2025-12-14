import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, extname, resolve, dirname, isAbsolute, sep } from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { existsSync, createReadStream, createWriteStream, watchFile, unwatchFile } from 'fs'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'
import { spawn, exec } from 'child_process'
import archiver from 'archiver'
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

// 存储当前上传的流引用，用于取消上传
interface UploadState {
  readStream: ReturnType<typeof createReadStream> | null
  writeStream: ReturnType<typeof createWriteStream> | null
  targetPath: string
  cancelled: boolean
}

let currentUpload: UploadState | null = null

// 存储当前正在运行的生成进程，用于取消生成
let currentGenerateProcess: ReturnType<typeof spawn> | null = null
let currentGenerateKill: (() => void) | null = null

// 获取运行位置目录（可执行文件所在目录）
function getRunPath(): string {
  return app.isPackaged ? dirname(process.execPath) : join(__dirname, '..')
}

// 将相对路径转换为绝对路径（基于运行路径）
function resolveModelPath(modelPath: string): string {
  // 如果已经是绝对路径，直接返回
  if (isAbsolute(modelPath)) {
    return modelPath
  }
  // 如果是相对路径，基于运行路径解析
  return resolve(getRunPath(), modelPath)
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
  if (!existsSync(targetFolder)) {
    await fs.mkdir(targetFolder, { recursive: true })
  }
  
  const fileName = basename(sourcePath)
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
    
    const totalSize = sourceStats.size
    let copiedSize = 0
    
    const readStream = createReadStream(sourcePath)
    const writeStream = createWriteStream(targetPath)
    
    currentUpload = {
      readStream,
      writeStream,
      targetPath,
      cancelled: false,
    }
    
    readStream.on('data', (chunk: Buffer | string) => {
      if (currentUpload?.cancelled) {
        readStream.destroy()
        writeStream.destroy()
        return
      }
      
      copiedSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      event.sender.send('weights:upload-progress', {
        progress: Math.round((copiedSize / totalSize) * 100),
        copied: copiedSize,
        total: totalSize,
        fileName: fileName,
      })
    })
    
    await pipeline(readStream, writeStream)
    
    if (currentUpload?.cancelled) {
      if (existsSync(currentUpload.targetPath)) {
        await fs.unlink(currentUpload.targetPath)
      }
      currentUpload = null
      return { success: false, cancelled: true, message: '上传已取消' }
    }
    
    event.sender.send('weights:upload-progress', {
      progress: 100,
      copied: totalSize,
      total: totalSize,
      fileName: fileName,
    })
    
    currentUpload = null
    return { success: true, targetPath, skipped: false }
})

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
ipcMain.handle('sdcpp:list-files', async (_, folder: string, deviceType: 'cpu' | 'vulkan' | 'cuda') => {
  const deviceFolder = join(folder, deviceType)
  if (!existsSync(deviceFolder)) {
    return []
  }
  
  const entries = await fs.readdir(deviceFolder, { withFileTypes: true })
  const files: Array<{ name: string; size: number; path: string; modified: number }> = []
  // 目前仅支持 Windows 平台
  // TODO: 未来如需支持其他平台，可在此处添加对应的文件扩展名（如 .so 用于 Linux，.dylib 用于 macOS）
  const engineExtensions = ['.exe', '.dll', '.bin', '.txt']
  
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
  
  files.sort((a, b) => b.modified - a.modified)
  return files
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

// 加载模型组列表
async function loadModelGroups(): Promise<ModelGroup[]> {
  const filePath = getModelGroupsFilePath()
  if (!existsSync(filePath)) {
    return []
  }
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content) as ModelGroup[]
}

// 保存模型组列表
async function saveModelGroups(groups: ModelGroup[]): Promise<void> {
  const filePath = getModelGroupsFilePath()
  const dirPath = dirname(filePath)
  // 确保目录存在
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true })
  }
  await fs.writeFile(filePath, JSON.stringify(groups, null, 2), 'utf-8')
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
      offloadToCpu = false,
      diffusionFa = false,
      controlNetCpu = false,
      clipOnCpu = false,
      vaeOnCpu = false,
      diffusionConvDirect = false,
      vaeConvDirect = false,
      vaeTiling = false,
      inputImage
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
      sdModelPath = resolveModelPath(group.sdModel)
      
      // 检查模型文件是否存在
      if (!existsSync(sdModelPath)) {
        throw new Error(`SD模型文件不存在: ${sdModelPath}`)
      }
    } else if (modelPath) {
      // 兼容旧版本：直接使用模型路径
      // 将相对路径转换为绝对路径
      sdModelPath = resolveModelPath(modelPath)
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
      if (group?.vaeModel) {
        // 将相对路径转换为绝对路径
        const vaeModelPath = resolveModelPath(group.vaeModel)
        if (existsSync(vaeModelPath)) {
          args.push('--vae', vaeModelPath)
        }
      }
      // 添加 LLM 文本编码器支持（用于某些模型如 Z-Image 等）
      if (group?.llmModel) {
        // 将相对路径转换为绝对路径
        const llmModelPath = resolveModelPath(group.llmModel)
        if (existsSync(llmModelPath)) {
          args.push('--llm', llmModelPath)
        }
      }
      // 注意：根据 sd-cli.exe 的帮助，还可能需要 clip_l, clip_g, clip_vision, t5xxl 等
      // 可以根据具体模型类型进一步扩展
    }

    if (negativePrompt) {
      args.push('--negative-prompt', negativePrompt)
    }

    // 添加输入图片（用于图片编辑和上采样）
    if (inputImage) {
      const inputImagePath = resolve(inputImage)
      if (existsSync(inputImagePath)) {
        args.push('--input-image', inputImagePath)
        console.log(`[Generate] Input image: ${inputImagePath}`)
      } else {
        throw new Error(`输入图片文件不存在: ${inputImagePath}`)
      }
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
      // 在 Windows 上，如果路径包含中文字符，需要使用 shell: true 来正确处理编码
      // 为了安全，我们需要转义参数中的特殊字符
      const escapeShellArg = (arg: string): string => {
        // Windows CMD/PowerShell 转义规则：将引号加倍，然后用引号包裹整个参数
        // 这样可以正确处理包含空格、引号或中文字符的路径
        return `"${arg.replace(/"/g, '""')}"`
      }

      // 在 Windows 上使用 shell: true 以正确处理中文路径
      const spawnOptions: Parameters<typeof spawn>[2] = {
        cwd: dirname(sdExePath),
        stdio: ['ignore', 'pipe', 'pipe'],
      }

      // 目前仅支持 Windows 平台
      // TODO: 未来如需支持其他平台，可在此处添加平台检测逻辑
      // Windows: 使用 shell: true 并转义所有参数以正确处理中文路径
      // 使用 chcp 65001 设置代码页为 UTF-8，确保正确处理中文字符
      const escapedExePath = escapeShellArg(sdExePath)
      const escapedArgs = args.map(escapeShellArg)
      // 使用 cmd.exe 的 /c 参数执行命令，并在前面设置 UTF-8 代码页
      const command = `chcp 65001 >nul && ${escapedExePath} ${escapedArgs.join(' ')}`
      spawnOptions.shell = true
      const childProcess = spawn(command, [], spawnOptions)

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

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        console.log(`[SD.cpp stdout] ${text}`)
        
        if (!operationGuard.check() || event.sender.isDestroyed()) {
          return
        }
        
        event.sender.send('generate:cli-output', { type: 'stdout', text })
        
        const progressMatch = text.match(/progress[:\s]+(\d+)%/i)
        if (progressMatch) {
          event.sender.send('generate:progress', { progress: `生成中... ${progressMatch[1]}%` })
        } else if (text.includes('Generating') || text.includes('generating')) {
          event.sender.send('generate:progress', { progress: '正在生成图片...' })
        } else if (text.includes('Loading') || text.includes('loading')) {
          event.sender.send('generate:progress', { progress: '正在加载模型...' })
        }
      })

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderr += text
        console.error(`[SD.cpp stderr] ${text}`)
        
        if (!operationGuard.check() || event.sender.isDestroyed()) {
          return
        }
        
        event.sender.send('generate:cli-output', { type: 'stderr', text })
      })

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
            const errorMsg = stderr || stdout || `进程退出，代码: ${code}, 信号: ${signal}`
            console.log(`[Generate] Image generation failed after ${durationSeconds}s (${duration}ms)`)
            event.sender.send('generate:progress', { progress: `生成失败: ${errorMsg}（耗时: ${durationSeconds}秒）` })
            safeReject(new Error(`图片生成失败: ${errorMsg}`))
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
      offloadToCpu = false,
      diffusionFa = false,
      controlNetCpu = false,
      clipOnCpu = false,
      vaeOnCpu = false,
      diffusionConvDirect = false,
      vaeConvDirect = false,
      vaeTiling = false,
      frames = 16, // 视频帧数
      fps = 8 // 帧率
    } = params

    // 确定使用的模型路径
    let sdModelPath: string | undefined

    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (!group) {
        throw new Error(`模型组不存在: ${groupId}`)
      }
      if (!group.sdModel) {
        throw new Error('模型组中未配置SD模型')
      }
      sdModelPath = resolveModelPath(group.sdModel)
      
      if (!existsSync(sdModelPath)) {
        throw new Error(`SD模型文件不存在: ${sdModelPath}`)
      }
    } else if (modelPath) {
      sdModelPath = resolveModelPath(modelPath)
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

    // 生成输出视频路径（保存在运行路径下的 outputs 目录）
    const outputsDir = getDefaultOutputsFolder()
    if (!existsSync(outputsDir)) {
      await fs.mkdir(outputsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const outputVideoPath = join(outputsDir, `video_${timestamp}.mp4`)
    const outputMetadataPath = join(outputsDir, `video_${timestamp}.json`)

    // 构建命令行参数
    // 注意：sdcpp 主要是图像生成，这里创建一个框架
    // 实际视频生成可能需要其他工具或扩展的 sdcpp 功能
    const args: string[] = [
      '--diffusion-model', sdModelPath,
      '--prompt', prompt,
    ]
    
    // 添加 VAE 和 LLM 模型支持
    if (groupId) {
      const groups = await loadModelGroups()
      const group = groups.find(g => g.id === groupId)
      if (group?.vaeModel) {
        const vaeModelPath = resolveModelPath(group.vaeModel)
        if (existsSync(vaeModelPath)) {
          args.push('--vae', vaeModelPath)
        }
      }
      if (group?.llmModel) {
        const llmModelPath = resolveModelPath(group.llmModel)
        if (existsSync(llmModelPath)) {
          args.push('--llm', llmModelPath)
        }
      }
    }

    if (negativePrompt) {
      args.push('--negative-prompt', negativePrompt)
    }

    // 注意：sdcpp 默认输出图片，视频生成需要额外的处理
    // 这里先输出为图片序列，然后可以转换为视频
    const outputImagePath = join(outputsDir, `video_${timestamp}_frame.png`)
    args.push('--output', outputImagePath)

    // 添加高级参数（与图片生成相同）
    if (steps !== 20) {
      args.push('--steps', steps.toString())
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

    if (samplingMethod && typeof samplingMethod === 'string' && samplingMethod.trim() !== '') {
      args.push('--sampling-method', samplingMethod.trim())
    }

    if (scheduler && typeof scheduler === 'string' && scheduler.trim() !== '') {
      args.push('--schedule', scheduler.trim())
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
      const escapeShellArg = (arg: string): string => {
        return `"${arg.replace(/"/g, '""')}"`
      }

      const spawnOptions: Parameters<typeof spawn>[2] = {
        cwd: dirname(sdExePath),
        stdio: ['ignore', 'pipe', 'pipe'],
      }

      const escapedExePath = escapeShellArg(sdExePath)
      const escapedArgs = args.map(escapeShellArg)
      const command = `chcp 65001 >nul && ${escapedExePath} ${escapedArgs.join(' ')}`
      spawnOptions.shell = true
      const childProcess = spawn(command, [], spawnOptions)

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
        const text = data.toString()
        stdout += text
        console.log(`[SD.cpp stdout] ${text}`)
        
        if (!operationGuard.check() || event.sender.isDestroyed()) {
          return
        }
        
        event.sender.send('generate-video:cli-output', { type: 'stdout', text })
        
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
        const text = data.toString()
        stderr += text
        console.error(`[SD.cpp stderr] ${text}`)
        
        if (!operationGuard.check() || event.sender.isDestroyed()) {
          return
        }
        
        event.sender.send('generate-video:cli-output', { type: 'stderr', text })
      })

      childProcess.on('error', (error) => {
        console.error('[Generate Video] Failed to start process:', error)
        event.sender.send('generate-video:progress', { progress: `错误: ${error.message}` })
        safeReject(new Error(`无法启动 SD.cpp 引擎: ${error.message}`))
      })

      childProcess.on('exit', async (code, signal) => {
        cleanup()

        if (isResolved) return

        if (code === 0) {
          // 生成成功
          // 注意：sdcpp 主要生成图片，这里需要将图片序列转换为视频
          // 目前先返回生成的图片，后续可以扩展为真正的视频生成
          if (existsSync(outputImagePath)) {
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
              
              // 注意：目前 sdcpp 生成的是图片，需要转换为视频
              // 这里先返回图片路径，后续可以扩展为真正的视频生成
              // 暂时将图片复制为视频文件（实际应该使用 ffmpeg 等工具转换）
              if (existsSync(outputImagePath)) {
                // 暂时使用图片路径，后续可以扩展为视频转换
                const videoBuffer = await fs.readFile(outputImagePath)
                const base64Video = `data:image/png;base64,${videoBuffer.toString('base64')}`
                
                const durationSeconds = (duration / 1000).toFixed(2)
                console.log(`[Generate Video] Video generation completed in ${durationSeconds}s (${duration}ms)`)
                
                event.sender.send('generate-video:progress', { 
                  progress: `生成完成（耗时: ${durationSeconds}秒）`,
                  video: base64Video 
                })
                
                safeResolve({
                  success: true,
                  video: base64Video,
                  videoPath: outputImagePath, // 暂时返回图片路径
                  duration,
                })
              } else {
                safeReject(new Error('生成完成但未找到输出文件'))
              }
            } catch (error) {
              console.error('[Generate Video] Failed to read video:', error)
              safeReject(new Error(`读取生成的视频失败: ${error instanceof Error ? error.message : String(error)}`))
            }
          } else {
            safeReject(new Error('生成完成但未找到输出文件'))
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
  
  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      const fileName = entry.name.toLowerCase()
      
      // 判断是否为图片或视频
      const isImage = imageExtensions.includes(ext)
      const isVideo = videoExtensions.includes(ext)
      
      if (isImage || isVideo) {
        const filePath = join(outputsFolder, entry.name)
        const stats = await fs.stat(filePath)
        
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
        
        // 查找元数据文件
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
        
        images.push({
          name: entry.name,
          path: filePath,
          size: stats.size,
          modified: stats.mtimeMs,
          type: generationType,
          mediaType: mediaType,
          ...metadata,
        })
      }
    }
  }
  
  // 按修改时间降序排序
  images.sort((a, b) => b.modified - a.modified)
  
  return images
}

// IPC 处理程序：列出所有已生成的图片和视频
ipcMain.handle('generated-images:list', async () => {
  const images = await findAllGeneratedImages()
  const imagesWithPreview = await Promise.all(
    images.map(async (image) => {
      // 只对图片生成预览，视频不生成预览
      if (image.mediaType === 'video') {
        return image
      }
      
      const stats = await fs.stat(image.path)
      if (stats.size > 5 * 1024 * 1024) {
        return image
      }
      
      try {
        const imageBuffer = await fs.readFile(image.path)
        return {
          ...image,
          previewImage: imageBuffer.toString('base64'),
        }
      } catch (error) {
        console.error(`Failed to read preview for ${image.name}:`, error)
        return image
      }
    })
  )
  return imagesWithPreview
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

app.whenReady().then(async () => {
  // 初始化默认 models 文件夹
  await initDefaultModelsFolder()
  // 初始化默认 SD.cpp 引擎文件夹
  await initDefaultSDCppFolder()
  // 初始化默认 outputs 文件夹
  await initDefaultOutputsFolder()
  createWindow()
})

