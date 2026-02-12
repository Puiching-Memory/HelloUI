import { createWriteStream, existsSync } from 'fs'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { net, BrowserWindow } from 'electron'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { HfMirror, HfMirrorId, HfFileRef, ModelDownloadProgress } from '../../shared/types.js'

// ─── 常量 ─────────────────────────────────────────────────────────────

/** HF 镜像源列表 */
export const HF_MIRRORS: HfMirror[] = [
  {
    id: 'huggingface',
    name: 'HuggingFace (官方)',
    baseUrl: 'https://huggingface.co',
  },
  {
    id: 'hf-mirror',
    name: 'HF-Mirror (中国镜像)',
    baseUrl: 'https://hf-mirror.com',
  },
]

/** 当前选中的 HF 镜像 ID */
let selectedHfMirrorId: HfMirrorId = 'hf-mirror'

/** 当前活跃的下载 AbortController */
let activeDownloadController: AbortController | null = null

// ─── 镜像管理 ─────────────────────────────────────────────────────────

export function getSelectedHfMirror(): HfMirrorId {
  return selectedHfMirrorId
}

export function setSelectedHfMirror(mirrorId: HfMirrorId): boolean {
  const mirror = HF_MIRRORS.find((m) => m.id === mirrorId)
  if (!mirror) return false
  selectedHfMirrorId = mirrorId
  return true
}

export function getHfMirrorBaseUrl(mirrorId?: HfMirrorId): string {
  const mirror = HF_MIRRORS.find((m) => m.id === (mirrorId || selectedHfMirrorId))
  return mirror?.baseUrl || HF_MIRRORS[0].baseUrl
}

// ─── 下载管理 ─────────────────────────────────────────────────────────

/**
 * 取消正在进行的下载
 */
export function cancelModelDownload(): boolean {
  if (activeDownloadController) {
    activeDownloadController.abort()
    activeDownloadController = null
    return true
  }
  return false
}

/**
 * 构建 HF 下载 URL
 * 格式: {baseUrl}/{repo}/resolve/main/{file}
 */
function buildHfDownloadUrl(repo: string, file: string, mirrorId?: HfMirrorId): string {
  const baseUrl = getHfMirrorBaseUrl(mirrorId)
  return `${baseUrl}/${repo}/resolve/main/${file}`
}

/**
 * 通过 HEAD 请求获取文件大小
 */
async function getRemoteFileSize(url: string): Promise<number> {
  return new Promise((resolve) => {
    const request = net.request({ url, method: 'HEAD' })
    request.setHeader('User-Agent', 'HelloUI/1.0')
    request.on('response', (response) => {
      // 处理 3xx 重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location
        getRemoteFileSize(redirectUrl).then(resolve).catch(() => resolve(-1))
        return
      }
      const contentLength = response.headers['content-length']
      if (contentLength) {
        const size = parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10)
        resolve(isNaN(size) ? -1 : size)
      } else {
        resolve(-1)
      }
    })
    request.on('error', () => resolve(-1))
    request.end()
  })
}

/**
 * 使用 Electron net 模块下载单个文件，支持进度回调与中断
 */
function downloadFileWithProgress(
  url: string,
  destPath: string,
  abortSignal: AbortSignal,
  onProgress: (downloaded: number, total: number, speed: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 确保目标目录存在
    const dir = dirname(destPath)
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true })
    }

    const request = net.request(url)
    request.setHeader('User-Agent', 'HelloUI/1.0')

    if (abortSignal.aborted) {
      reject(new Error('下载已取消'))
      return
    }

    const abortHandler = () => {
      request.abort()
      reject(new Error('下载已取消'))
    }
    abortSignal.addEventListener('abort', abortHandler, { once: true })

    request.on('response', async (response) => {
      // 处理 3xx 重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location
        abortSignal.removeEventListener('abort', abortHandler)
        try {
          await downloadFileWithProgress(redirectUrl, destPath, abortSignal, onProgress)
          resolve()
        } catch (err) {
          reject(err)
        }
        return
      }

      if (response.statusCode !== 200) {
        abortSignal.removeEventListener('abort', abortHandler)
        reject(new Error(`HTTP ${response.statusCode}: 下载失败`))
        return
      }

      const contentLength = response.headers['content-length']
      const totalBytes = contentLength
        ? parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10)
        : -1

      let downloadedBytes = 0
      let lastReportTime = Date.now()
      let lastReportBytes = 0

      const chunks: Buffer[] = []

      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        downloadedBytes += chunk.length

        const now = Date.now()
        const elapsed = now - lastReportTime
        if (elapsed >= 500) {
          const speed = ((downloadedBytes - lastReportBytes) / elapsed) * 1000
          lastReportTime = now
          lastReportBytes = downloadedBytes
          onProgress(downloadedBytes, totalBytes, speed)
        }
      })

      response.on('end', async () => {
        abortSignal.removeEventListener('abort', abortHandler)
        try {
          const buffer = Buffer.concat(chunks)
          await fs.writeFile(destPath, buffer)
          onProgress(downloadedBytes, totalBytes, 0)
          resolve()
        } catch (err) {
          reject(err)
        }
      })

      response.on('error', (err: Error) => {
        abortSignal.removeEventListener('abort', abortHandler)
        reject(err)
      })
    })

    request.on('error', (err: Error) => {
      abortSignal.removeEventListener('abort', abortHandler)
      reject(err)
    })

    request.end()
  })
}

/**
 * 发送下载进度事件到渲染进程
 */
function sendProgressEvent(
  getWindow: () => BrowserWindow | null,
  progress: ModelDownloadProgress,
): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('models:download-progress', progress)
  }
}

/**
 * 下载模型组的全部 HF 文件
 */
export async function downloadModelGroupFiles(
  hfFiles: HfFileRef[],
  targetFolder: string,
  mirrorId: HfMirrorId | undefined,
  getWindow: () => BrowserWindow | null,
): Promise<void> {
  activeDownloadController = new AbortController()
  const { signal } = activeDownloadController
  const totalFiles = hfFiles.length

  for (let i = 0; i < hfFiles.length; i++) {
    if (signal.aborted) throw new Error('下载已取消')

    const hfFile = hfFiles[i]
    const savePath = hfFile.savePath || hfFile.file
    const destPath = join(targetFolder, savePath)

    // 如果文件已存在，跳过
    if (existsSync(destPath)) {
      console.log(`[HfDownloader] File already exists, skipping: ${destPath}`)
      sendProgressEvent(getWindow, {
        stage: 'downloading',
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        fileName: savePath,
        totalFiles,
        currentFileIndex: i + 1,
      })
      continue
    }

    const url = buildHfDownloadUrl(hfFile.repo, hfFile.file, mirrorId || selectedHfMirrorId)
    console.log(`[HfDownloader] Downloading [${i + 1}/${totalFiles}]: ${url}`)

    // 先尝试获取文件大小
    const fileSize = await getRemoteFileSize(url)

    sendProgressEvent(getWindow, {
      stage: 'downloading',
      downloadedBytes: 0,
      totalBytes: fileSize,
      speed: 0,
      fileName: savePath,
      totalFiles,
      currentFileIndex: i + 1,
    })

    await downloadFileWithProgress(url, destPath, signal, (downloaded, total, speed) => {
      sendProgressEvent(getWindow, {
        stage: 'downloading',
        downloadedBytes: downloaded,
        totalBytes: total > 0 ? total : fileSize,
        speed,
        fileName: savePath,
        totalFiles,
        currentFileIndex: i + 1,
      })
    })

    console.log(`[HfDownloader] Completed: ${destPath}`)
  }

  activeDownloadController = null

  sendProgressEvent(getWindow, {
    stage: 'done',
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    fileName: '',
    totalFiles,
    currentFileIndex: totalFiles,
  })
}

/**
 * 检查模型组 HF 文件是否已下载
 */
export async function checkModelGroupFiles(
  hfFiles: HfFileRef[],
  targetFolder: string,
): Promise<Array<{ file: string; exists: boolean; size?: number }>> {
  const results: Array<{ file: string; exists: boolean; size?: number }> = []

  for (const hfFile of hfFiles) {
    const savePath = hfFile.savePath || hfFile.file
    const destPath = join(targetFolder, savePath)

    if (existsSync(destPath)) {
      const stats = await fs.stat(destPath)
      results.push({ file: savePath, exists: true, size: stats.size })
    } else {
      results.push({ file: savePath, exists: false })
    }
  }

  return results
}
