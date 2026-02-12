import { ipcMain, BrowserWindow } from 'electron'
import { join, dirname, resolve } from 'path'
import { existsSync } from 'fs'
import type { AppState } from './state.js'
import type { HfMirrorId } from '../../shared/types.js'
import { getDefaultModelsFolder } from '../utils/paths.js'
import { loadModelGroups } from './modelGroups.js'
import {
  getSelectedHfMirror,
  setSelectedHfMirror,
  downloadModelGroupFiles,
  cancelModelDownload,
  checkModelGroupFiles,
} from '../utils/hfDownloader.js'

interface ModelDownloadDeps {
  getWindow: () => BrowserWindow | null
  state: AppState
}

export function registerModelDownloadHandlers({ getWindow, state }: ModelDownloadDeps): void {
  // 获取当前 HF 镜像
  ipcMain.handle('models:get-hf-mirror', async () => {
    return getSelectedHfMirror()
  })

  // 设置 HF 镜像
  ipcMain.handle('models:set-hf-mirror', async (_, mirrorId: HfMirrorId) => {
    return setSelectedHfMirror(mirrorId)
  })

  // 下载模型组的 HF 文件
  ipcMain.handle('models:download-group-files', async (_, opts: { groupId: string; mirrorId?: HfMirrorId }) => {
    try {
      const groups = await loadModelGroups(state.weightsFolderPath)
      const group = groups.find((g) => g.id === opts.groupId)
      if (!group) {
        return { success: false, error: `模型组不存在: ${opts.groupId}` }
      }
      if (!group.hfFiles || group.hfFiles.length === 0) {
        return { success: false, error: '该模型组没有预定义的 HuggingFace 文件' }
      }

      // 使用模型组的子文件夹作为目标 —— 从 sdModel 路径推断
      const modelsDir = state.weightsFolderPath || getDefaultModelsFolder()
      let targetFolder: string

      if (group.sdModel) {
        const absModelPath = resolve(modelsDir, group.sdModel)
        targetFolder = dirname(absModelPath)
      } else {
        targetFolder = join(modelsDir, group.name)
      }

      console.log(`[ModelDownload] Downloading ${group.hfFiles.length} files to ${targetFolder}`)

      await downloadModelGroupFiles(
        group.hfFiles,
        targetFolder,
        opts.mirrorId,
        getWindow,
      )

      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ModelDownload] Download failed:', message)
      return { success: false, error: message }
    }
  })

  // 取消下载
  ipcMain.handle('models:cancel-download', async () => {
    return cancelModelDownload()
  })

  // 检查模型组文件是否已下载
  ipcMain.handle('models:check-files', async (_, opts: { groupId: string }) => {
    try {
      const groups = await loadModelGroups(state.weightsFolderPath)
      const group = groups.find((g) => g.id === opts.groupId)
      if (!group || !group.hfFiles || group.hfFiles.length === 0) {
        return []
      }

      const modelsDir = state.weightsFolderPath || getDefaultModelsFolder()
      let targetFolder: string

      if (group.sdModel) {
        const absModelPath = resolve(modelsDir, group.sdModel)
        targetFolder = dirname(absModelPath)
      } else {
        targetFolder = join(modelsDir, group.name)
      }

      return await checkModelGroupFiles(group.hfFiles, targetFolder)
    } catch (err) {
      console.error('[ModelDownload] Failed to check files:', err)
      return []
    }
  })
}
