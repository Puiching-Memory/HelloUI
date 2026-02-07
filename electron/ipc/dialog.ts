import { ipcMain, dialog, BrowserWindow } from 'electron'
import { extname } from 'path'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import type { AppState } from './state.js'

interface DialogDeps {
  getWindow: () => BrowserWindow | null
  state: AppState
}

export function registerDialogHandlers({ getWindow }: DialogDeps): void {
  // 选择要上传的权重文件
  ipcMain.handle('weights:select-file', async () => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      title: '选择要上传的权重文件',
      filters: [
        { name: '所有文件', extensions: ['*'] },
        { name: '模型文件', extensions: ['bin', 'safetensors', 'pt', 'pth', 'onnx', 'ckpt', 'gguf'] },
        { name: 'GGUF 文件', extensions: ['gguf'] },
      ],
    })

    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0]
    return null
  })

  // 选择图片文件（编辑）
  ipcMain.handle('edit-image:select-file', async () => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      title: '选择图片',
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })

    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0]
    return null
  })

  // 选择图片文件（通用，别名）
  ipcMain.handle('dialog:open-image', async () => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      title: '选择图片',
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })

    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0]
    return null
  })

  // 读取图片文件并返回 base64 数据 URL
  ipcMain.handle('edit-image:read-image-base64', async (_, filePath: string) => {
    try {
      if (!existsSync(filePath)) throw new Error('文件不存在')

      const fileBuffer = await fs.readFile(filePath)
      const ext = extname(filePath).toLowerCase()
      let mimeType = 'image/png'
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

      const base64 = fileBuffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error('Failed to read image file:', error)
      throw error
    }
  })
}
