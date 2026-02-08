import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { extname } from 'path'

interface PerfectPixelDeps {
  getWindow: () => BrowserWindow | null
}

export function registerPerfectPixelHandlers({ getWindow }: PerfectPixelDeps): void {
  // 选择图片文件
  ipcMain.handle('perfect-pixel:select-image', async () => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      title: '选择像素风格图片',
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })

    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0]
    return null
  })

  // 读取图片为 base64 data URL
  ipcMain.handle('perfect-pixel:read-image', async (_, filePath: string) => {
    const buffer = await fs.readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    let mimeType = 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
    else if (ext === '.webp') mimeType = 'image/webp'
    else if (ext === '.bmp') mimeType = 'image/bmp'
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  })

  // 保存处理后的图片
  ipcMain.handle('perfect-pixel:save', async (_, base64DataUrl: string) => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const result = await dialog.showSaveDialog(window, {
      title: '保存像素完美图片',
      defaultPath: `perfect_pixel_${Date.now()}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    })

    if (result.canceled || !result.filePath) return { success: false }

    const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '')
    await fs.writeFile(result.filePath, Buffer.from(base64Data, 'base64'))

    return { success: true, filePath: result.filePath }
  })
}
