import { createWriteStream, existsSync } from 'fs'
import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { net, BrowserWindow } from 'electron'
import { execa } from 'execa'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type {
  MirrorSource,
  SDCppRelease,
  SDCppReleaseAsset,
  SDCppDownloadProgress,
  MirrorTestResult,
  DeviceType,
} from '../../shared/types.js'

// ─── 常量 ─────────────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com/repos/leejet/stable-diffusion.cpp/releases'
const GITHUB_RELEASE_BASE = 'https://github.com/leejet/stable-diffusion.cpp/releases/download'

/** 内置镜像源列表 */
export const BUILTIN_MIRRORS: MirrorSource[] = [
  {
    id: 'github',
    name: 'GitHub (官方)',
    type: 'github',
    url: 'https://github.com',
    proxyApi: false,
    builtin: true,
  },
  {
    id: 'ghfast',
    name: 'GHFast 加速',
    type: 'proxy',
    url: 'https://ghfast.top',
    proxyApi: false,
    builtin: true,
  },
  {
    id: 'ghproxy',
    name: 'GitHub Proxy',
    type: 'proxy',
    url: 'https://mirror.ghproxy.com',
    proxyApi: false,
    builtin: true,
  },
  {
    id: 'moeyy',
    name: 'Moeyy 加速',
    type: 'proxy',
    url: 'https://github.moeyy.xyz',
    proxyApi: false,
    builtin: true,
  },
]

// ─── 资产名称匹配 ────────────────────────────────────────────────────

/** Windows 资产名称模式映射 */
const WIN_ASSET_PATTERNS: Array<{
  pattern: RegExp
  deviceType: SDCppReleaseAsset['deviceType']
  cpuVariant?: SDCppReleaseAsset['cpuVariant']
}> = [
  { pattern: /bin-win-cuda12-x64\.zip$/i, deviceType: 'cuda' },
  { pattern: /bin-win-vulkan-x64\.zip$/i, deviceType: 'vulkan' },
  { pattern: /bin-win-avx2-x64\.zip$/i, deviceType: 'cpu', cpuVariant: 'avx2' },
  { pattern: /bin-win-avx-x64\.zip$/i, deviceType: 'cpu', cpuVariant: 'avx' },
  { pattern: /bin-win-avx512-x64\.zip$/i, deviceType: 'cpu', cpuVariant: 'avx512' },
  { pattern: /bin-win-noavx-x64\.zip$/i, deviceType: 'cpu', cpuVariant: 'noavx' },
  { pattern: /cudart-sd-bin-win-cu12-x64\.zip$/i, deviceType: 'cudart' },
]

function classifyAsset(name: string): { deviceType: SDCppReleaseAsset['deviceType']; cpuVariant?: SDCppReleaseAsset['cpuVariant'] } {
  for (const { pattern, deviceType, cpuVariant } of WIN_ASSET_PATTERNS) {
    if (pattern.test(name)) {
      return { deviceType, cpuVariant }
    }
  }
  return { deviceType: 'unknown' }
}

// ─── 下载管理器 ──────────────────────────────────────────────────────

/** 当前活跃的下载 AbortController */
let activeDownloadController: AbortController | null = null

/**
 * 取消正在进行的下载
 */
export function cancelDownload(): boolean {
  if (activeDownloadController) {
    activeDownloadController.abort()
    activeDownloadController = null
    return true
  }
  return false
}

// ─── 镜像 URL 构建 ──────────────────────────────────────────────────

/**
 * 根据镜像源构建下载 URL
 */
function buildDownloadUrl(originalUrl: string, mirror: MirrorSource): string {
  if (mirror.type === 'github') {
    return originalUrl
  }
  // proxy 类型: 前缀式代理 → {mirrorUrl}/{originalUrl}
  return `${mirror.url}/${originalUrl}`
}

/**
 * 构建 API URL
 */
function buildApiUrl(apiPath: string, mirror: MirrorSource): string {
  const githubApiUrl = `${GITHUB_API_BASE}${apiPath}`
  if (mirror.type === 'github' || !mirror.proxyApi) {
    return githubApiUrl
  }
  return `${mirror.url}/${githubApiUrl}`
}

// ─── 网络请求 ────────────────────────────────────────────────────────

/**
 * 使用 Electron net 模块发起 GET 请求，返回 JSON
 */
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request aborted'))
      return
    }

    const request = net.request({
      url,
      method: 'GET',
    })

    request.setHeader('Accept', 'application/json')
    request.setHeader('User-Agent', 'HelloUI-SDCpp-Downloader')

    let responseData = ''

    const onAbort = () => {
      request.abort()
      reject(new Error('Request aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        signal?.removeEventListener('abort', onAbort)
        reject(new Error(`HTTP ${response.statusCode}: ${url}`))
        return
      }

      response.on('data', (chunk) => {
        responseData += chunk.toString()
      })

      response.on('end', () => {
        signal?.removeEventListener('abort', onAbort)
        try {
          resolve(JSON.parse(responseData) as T)
        } catch (err) {
          reject(new Error(`Failed to parse JSON from ${url}`))
        }
      })

      response.on('error', (err) => {
        signal?.removeEventListener('abort', onAbort)
        reject(err)
      })
    })

    request.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(err)
    })

    request.end()
  })
}

// ─── Release 获取 ────────────────────────────────────────────────────

interface GitHubAsset {
  name: string
  size: number
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  assets: GitHubAsset[]
}

/**
 * 获取最新的 Release 信息
 */
export async function fetchLatestRelease(mirror: MirrorSource): Promise<SDCppRelease> {
  const apiUrl = buildApiUrl('/latest', mirror)
  console.log(`[SDCpp Downloader] Fetching latest release from: ${apiUrl}`)

  const data = await fetchJson<GitHubRelease>(apiUrl)
  return parseRelease(data)
}

/**
 * 获取所有 Release 列表（最近 10 个）
 */
export async function fetchReleases(mirror: MirrorSource, count = 10): Promise<SDCppRelease[]> {
  const apiUrl = buildApiUrl(`?per_page=${count}`, mirror)
  console.log(`[SDCpp Downloader] Fetching releases from: ${apiUrl}`)

  const data = await fetchJson<GitHubRelease[]>(apiUrl)
  return data.map(parseRelease)
}

function parseRelease(data: GitHubRelease): SDCppRelease {
  const assets: SDCppReleaseAsset[] = data.assets
    .filter((asset) => asset.name.includes('win') || asset.name.includes('cudart'))
    .map((asset) => {
      const { deviceType, cpuVariant } = classifyAsset(asset.name)
      return {
        name: asset.name,
        size: asset.size,
        downloadUrl: asset.browser_download_url,
        deviceType,
        cpuVariant,
      }
    })
    .filter((a) => a.deviceType !== 'unknown')

  return {
    tagName: data.tag_name,
    name: data.name || data.tag_name,
    publishedAt: data.published_at,
    assets,
  }
}

// ─── 下载与解压 ──────────────────────────────────────────────────────

/**
 * 下载文件到指定目录，支持进度回调
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress: (downloaded: number, total: number, speed: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Download aborted'))
      return
    }

    const request = net.request({ url, method: 'GET' })
    request.setHeader('User-Agent', 'HelloUI-SDCpp-Downloader')

    const onAbort = () => {
      request.abort()
      reject(new Error('Download aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    request.on('response', (response) => {
      // Handle redirects (Electron net handles most automatically, but be safe)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        const location = response.headers['location']
        if (location) {
          signal?.removeEventListener('abort', onAbort)
          const redirectUrl = Array.isArray(location) ? location[0] : location
          downloadFile(redirectUrl, destPath, onProgress, signal).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode !== 200) {
        signal?.removeEventListener('abort', onAbort)
        reject(new Error(`Download failed: HTTP ${response.statusCode}`))
        return
      }

      const contentLength = response.headers['content-length']
      const totalBytes = contentLength ? parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10) : 0

      const writeStream = createWriteStream(destPath)
      let downloadedBytes = 0
      let lastTime = Date.now()
      let lastBytes = 0

      response.on('data', (chunk) => {
        if (signal?.aborted) {
          writeStream.destroy()
          reject(new Error('Download aborted'))
          return
        }

        writeStream.write(chunk)
        downloadedBytes += chunk.length

        const now = Date.now()
        const elapsed = (now - lastTime) / 1000
        if (elapsed >= 0.5) {
          const speed = (downloadedBytes - lastBytes) / elapsed
          lastTime = now
          lastBytes = downloadedBytes
          onProgress(downloadedBytes, totalBytes, speed)
        }
      })

      response.on('end', () => {
        signal?.removeEventListener('abort', onAbort)
        writeStream.end(() => {
          onProgress(downloadedBytes, totalBytes, 0)
          resolve()
        })
      })

      response.on('error', (err) => {
        signal?.removeEventListener('abort', onAbort)
        writeStream.destroy()
        reject(err)
      })
    })

    request.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(err)
    })

    request.end()
  })
}

/**
 * 解压 ZIP 文件到目标目录（使用 Node.js 内置 AdmZip 方式）
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  // 使用简单的 execa 调用系统 tar 解压（Windows 10+ 内置 tar）
  await fs.mkdir(destDir, { recursive: true })

  try {
    // Windows 10 1803+ 内置 tar 命令支持 zip
    await execa('tar', ['-xf', zipPath, '-C', destDir], { timeout: 120000 })
  } catch {
    // 回退：使用 PowerShell 解压
    await execa('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
    ], { timeout: 120000 })
  }
}

/**
 * 下载并安装 SD.cpp 引擎
 */
export async function downloadAndInstallEngine(
  asset: SDCppReleaseAsset,
  release: SDCppRelease,
  mirror: MirrorSource,
  engineFolder: string,
  getWindow: () => BrowserWindow | null,
): Promise<void> {
  const controller = new AbortController()
  activeDownloadController = controller

  const win = getWindow()
  const sendProgress = (progress: SDCppDownloadProgress) => {
    win?.webContents.send('sdcpp:download-progress', progress)
  }

  // 确定目标设备目录
  let targetDir: string
  if (asset.deviceType === 'cuda') {
    targetDir = join(engineFolder, 'cuda')
  } else if (asset.deviceType === 'vulkan') {
    targetDir = join(engineFolder, 'vulkan')
  } else if (asset.deviceType === 'cudart') {
    targetDir = join(engineFolder, 'cuda')
  } else {
    targetDir = join(engineFolder, 'cpu')
  }

  await fs.mkdir(targetDir, { recursive: true })

  const downloadUrl = buildDownloadUrl(asset.downloadUrl, mirror)
  const tempDir = join(engineFolder, '.temp')
  await fs.mkdir(tempDir, { recursive: true })
  const tempZipPath = join(tempDir, asset.name)

  try {
    // 阶段 1: 下载
    console.log(`[SDCpp Downloader] Downloading: ${downloadUrl}`)
    sendProgress({
      stage: 'downloading',
      downloadedBytes: 0,
      totalBytes: asset.size,
      speed: 0,
      fileName: asset.name,
    })

    await downloadFile(
      downloadUrl,
      tempZipPath,
      (downloaded, total, speed) => {
        sendProgress({
          stage: 'downloading',
          downloadedBytes: downloaded,
          totalBytes: total || asset.size,
          speed,
          fileName: asset.name,
        })
      },
      controller.signal,
    )

    // 阶段 2: 解压
    console.log(`[SDCpp Downloader] Extracting to: ${targetDir}`)
    sendProgress({
      stage: 'extracting',
      downloadedBytes: asset.size,
      totalBytes: asset.size,
      speed: 0,
      fileName: asset.name,
    })

    // 解压到临时目录
    const extractDir = join(tempDir, `extract_${Date.now()}`)
    await extractZip(tempZipPath, extractDir)

    // 将解压出的文件移动到目标目录
    await moveExtractedFiles(extractDir, targetDir)

    // 阶段 3: 完成
    sendProgress({
      stage: 'done',
      downloadedBytes: asset.size,
      totalBytes: asset.size,
      speed: 0,
      fileName: asset.name,
    })

    console.log(`[SDCpp Downloader] Installation complete: ${asset.name}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[SDCpp Downloader] Download failed: ${message}`)
    sendProgress({
      stage: 'error',
      downloadedBytes: 0,
      totalBytes: asset.size,
      speed: 0,
      fileName: asset.name,
      error: message,
    })
    throw err
  } finally {
    activeDownloadController = null
    // 清理临时文件
    try {
      if (existsSync(tempDir)) {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    } catch {
      // 忽略清理错误
    }
  }
}

/**
 * 将解压出的文件递归移动到目标目录
 * 处理 ZIP 内有子目录的情况
 */
async function moveExtractedFiles(srcDir: string, destDir: string): Promise<void> {
  const entries = await fs.readdir(srcDir, { withFileTypes: true })

  // 检查是否只有一个子目录（某些 ZIP 内嵌套一层）
  if (entries.length === 1 && entries[0].isDirectory()) {
    const innerDir = join(srcDir, entries[0].name)
    await moveExtractedFiles(innerDir, destDir)
    return
  }

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true })
      await moveExtractedFiles(srcPath, destPath)
    } else {
      // 覆盖已有文件
      await fs.copyFile(srcPath, destPath)
    }
  }
}

// ─── 镜像测速 ────────────────────────────────────────────────────────

/**
 * 测试镜像源的连通性和延迟
 */
export async function testMirror(mirror: MirrorSource): Promise<MirrorTestResult> {
  const startTime = Date.now()
  const testUrl = buildApiUrl('/latest', mirror)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    await fetchJson<unknown>(testUrl, controller.signal)
    clearTimeout(timeout)

    const latency = Date.now() - startTime
    return { mirrorId: mirror.id, latency, success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { mirrorId: mirror.id, latency: null, success: false, error: message }
  }
}

/**
 * 批量测试所有镜像源
 */
export async function testAllMirrors(mirrors: MirrorSource[]): Promise<MirrorTestResult[]> {
  const results = await Promise.all(mirrors.map(testMirror))
  return results
}

/**
 * 自动选择最快的镜像源
 */
export async function autoSelectMirror(mirrors: MirrorSource[]): Promise<MirrorSource> {
  const results = await testAllMirrors(mirrors)
  const successful = results
    .filter((r) => r.success && r.latency !== null)
    .sort((a, b) => (a.latency ?? Infinity) - (b.latency ?? Infinity))

  if (successful.length > 0) {
    const bestId = successful[0].mirrorId
    const best = mirrors.find((m) => m.id === bestId)
    if (best) {
      console.log(`[SDCpp Downloader] Auto-selected mirror: ${best.name} (${successful[0].latency}ms)`)
      return best
    }
  }

  // 没有可用镜像时默认返回 GitHub
  console.log('[SDCpp Downloader] No mirrors available, defaulting to GitHub')
  return mirrors.find((m) => m.id === 'github') || mirrors[0]
}

// ─── 镜像管理 ────────────────────────────────────────────────────────

/** 用户自定义镜像的持久化路径 */
let customMirrorsPath: string | null = null

export function setCustomMirrorsPath(path: string): void {
  customMirrorsPath = path
}

/**
 * 获取所有可用的镜像源（内置 + 自定义）
 */
export async function getAllMirrors(): Promise<MirrorSource[]> {
  const customs = await loadCustomMirrors()
  return [...BUILTIN_MIRRORS, ...customs]
}

/**
 * 添加自定义镜像源
 */
export async function addCustomMirror(mirror: Omit<MirrorSource, 'id' | 'builtin'>): Promise<MirrorSource> {
  const customs = await loadCustomMirrors()
  const newMirror: MirrorSource = {
    ...mirror,
    id: `custom_${Date.now()}`,
    builtin: false,
  }
  customs.push(newMirror)
  await saveCustomMirrors(customs)
  return newMirror
}

/**
 * 删除自定义镜像源
 */
export async function removeCustomMirror(mirrorId: string): Promise<boolean> {
  const customs = await loadCustomMirrors()
  const index = customs.findIndex((m) => m.id === mirrorId)
  if (index === -1) return false
  customs.splice(index, 1)
  await saveCustomMirrors(customs)
  return true
}

async function loadCustomMirrors(): Promise<MirrorSource[]> {
  if (!customMirrorsPath) return []
  try {
    const data = await fs.readFile(customMirrorsPath, 'utf-8')
    return JSON.parse(data) as MirrorSource[]
  } catch {
    return []
  }
}

async function saveCustomMirrors(mirrors: MirrorSource[]): Promise<void> {
  if (!customMirrorsPath) return
  const dir = join(customMirrorsPath, '..')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(customMirrorsPath, JSON.stringify(mirrors, null, 2), 'utf-8')
}
