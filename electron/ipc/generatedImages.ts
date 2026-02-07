import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join, basename, extname } from 'path'
import { existsSync, createWriteStream } from 'fs'
import { promises as fs } from 'fs'
import { createRequire } from 'module'
import type { GeneratedImageInfo } from '../../shared/types.js'
import { getDefaultOutputsFolder } from '../utils/paths.js'

const require = createRequire(import.meta.url)
const archiver = require('archiver')

interface GeneratedImagesDeps {
  getWindow: () => BrowserWindow | null
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv']
const MEDIA_REGEX = /\.(png|jpg|jpeg|gif|bmp|webp|mp4|webm|avi|mov|mkv|flv|wmv)$/i

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
  }
  return map[ext] || 'video/*'
}

async function findAllGeneratedImages(): Promise<GeneratedImageInfo[]> {
  const outputsFolder = getDefaultOutputsFolder()

  if (!existsSync(outputsFolder)) return []

  const entries = await fs.readdir(outputsFolder, { withFileTypes: true })

  const filePromises = entries.map(async (entry) => {
    if (!entry.isFile()) return null

    const ext = extname(entry.name).toLowerCase()
    const fileName = entry.name.toLowerCase()
    const isImage = IMAGE_EXTENSIONS.includes(ext)
    const isVideo = VIDEO_EXTENSIONS.includes(ext)

    if (!isImage && !isVideo) return null

    const filePath = join(outputsFolder, entry.name)

    const [stats, metadata] = await Promise.all([
      fs.stat(filePath),
      (async () => {
        const metadataPath = filePath.replace(MEDIA_REGEX, '.json')
        if (existsSync(metadataPath)) {
          try {
            const content = await fs.readFile(metadataPath, 'utf-8')
            return JSON.parse(content)
          } catch (error) {
            console.error(`Failed to parse metadata for ${entry.name}:`, error)
          }
        }
        return {}
      })(),
    ])

    // 根据文件名判断生成类型
    let generationType: 'generate' | 'edit' | 'video' | undefined
    if (fileName.startsWith('generated_')) generationType = 'generate'
    else if (fileName.startsWith('edited_') || fileName.startsWith('edit_')) generationType = 'edit'
    else if (fileName.startsWith('video_')) generationType = 'video'
    else generationType = isVideo ? 'video' : 'generate'

    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'

    return {
      name: entry.name,
      path: filePath,
      size: stats.size,
      modified: stats.mtimeMs,
      type: generationType,
      mediaType,
      ...metadata,
    } as GeneratedImageInfo
  })

  const results = await Promise.all(filePromises)
  const images = results.filter((r): r is GeneratedImageInfo => r !== null)
  images.sort((a, b) => b.modified - a.modified)
  return images
}

export function registerGeneratedImagesHandlers({ getWindow }: GeneratedImagesDeps): void {
  // 列出所有已生成的图片和视频
  ipcMain.handle('generated-images:list', async () => {
    const startTime = Date.now()
    const images = await findAllGeneratedImages()
    console.log(`[GeneratedImages] Found ${images.length} files (${Date.now() - startTime}ms)`)
    return images
  })

  // 下载图片或视频
  ipcMain.handle('generated-images:download', async (_, filePath: string) => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const fileName = basename(filePath)
    const ext = extname(filePath).toLowerCase()
    const isVideo = VIDEO_EXTENSIONS.includes(ext)

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

  // 删除图片或视频
  ipcMain.handle('generated-images:delete', async (_, filePath: string) => {
    await fs.unlink(filePath)
    const metadataPath = filePath.replace(MEDIA_REGEX, '.json')
    if (existsSync(metadataPath)) {
      await fs.unlink(metadataPath)
    }
    return true
  })

  // 获取图片预览（完整 base64）
  ipcMain.handle('generated-images:get-preview', async (_, imagePath: string) => {
    const imageBuffer = await fs.readFile(imagePath)
    return imageBuffer.toString('base64')
  })

  // 获取视频数据（返回数组和 MIME 类型）
  ipcMain.handle('generated-images:get-video-data', async (_, videoPath: string) => {
    const ext = extname(videoPath).toLowerCase()
    const videoBuffer = await fs.readFile(videoPath)
    return {
      data: Array.from(videoBuffer),
      mimeType: getMimeType(ext),
    }
  })

  // 批量下载并打包为 ZIP
  ipcMain.handle('generated-images:batch-download', async (_, filePaths: string[]) => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')
    if (!filePaths || filePaths.length === 0) throw new Error('没有选择要下载的文件')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const result = await dialog.showSaveDialog(window, {
      title: '保存压缩包',
      defaultPath: `generated-files-${timestamp}.zip`,
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
      const archive = archiver('zip', { zlib: { level: 9 } })
      let isResolved = false

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

      output.on('error', (err: any) => {
        safeReject(new Error(`写入ZIP文件失败: ${err.message}`))
      })

      output.on('close', () => {
        if (!isResolved) {
          console.log(`ZIP file created: ${zipPath} (${archive.pointer()} bytes)`)
          safeResolve({ success: true, zipPath, size: archive.pointer() })
        }
      })

      archive.on('warning', (err: any) => {
        if (err.code !== 'ENOENT') safeReject(err)
        else console.warn('Archive warning:', err)
      })

      archive.on('error', (err: any) => safeReject(err))

      archive.pipe(output)
      for (const fp of filePaths) {
        archive.file(fp, { name: basename(fp) })
      }
      archive.finalize()
    })
  })
}
