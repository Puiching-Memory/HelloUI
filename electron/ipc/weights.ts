import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join, basename, relative } from 'path'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import type { AppState } from './state.js'
import { getDefaultModelsFolder, initDefaultModelsFolder } from '../utils/paths.js'

interface WeightsDeps {
  getWindow: () => BrowserWindow | null
  state: AppState
}

export function registerWeightsHandlers({ getWindow, state }: WeightsDeps): void {
  // 初始化默认 models 文件夹
  ipcMain.handle('weights:init-default-folder', async () => {
    const folder = await initDefaultModelsFolder()
    state.weightsFolderPath = folder
    return folder
  })

  // 检查文件夹是否存在
  ipcMain.handle('weights:check-folder', async (_, folderPath: string) => {
    return existsSync(folderPath)
  })

  // 设置权重文件夹
  ipcMain.handle('weights:set-folder', async (_, folder: string) => {
    state.weightsFolderPath = folder
    return true
  })

  // 获取权重文件夹
  ipcMain.handle('weights:get-folder', async () => {
    return state.weightsFolderPath
  })

  // 列出文件夹中的文件
  ipcMain.handle('weights:list-files', async (_, folder: string) => {
    if (!existsSync(folder)) return []

    const files: Array<{ name: string; size: number; path: string; modified: number }> = []

    async function scanDir(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name)
        if (entry.isDirectory()) {
          await scanDir(fullPath)
        } else if (entry.isFile()) {
          if (entry.name.toLowerCase().endsWith('.json')) continue
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

  // 下载文件（复制到用户选择的位置）
  ipcMain.handle('weights:download-file', async (_, filePath: string) => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const fileName = basename(filePath)
    const result = await dialog.showSaveDialog(window, {
      title: '保存权重文件',
      defaultPath: fileName,
      filters: [{ name: '所有文件', extensions: ['*'] }],
    })

    if (!result.canceled && result.filePath) {
      await fs.copyFile(filePath, result.filePath)
      return true
    }
    return false
  })

  // 删除文件
  ipcMain.handle('weights:delete-file', async (_, filePath: string) => {
    await fs.unlink(filePath)
    return true
  })
}
