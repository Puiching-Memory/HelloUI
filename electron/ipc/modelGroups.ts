import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join, basename, dirname, resolve, relative, isAbsolute } from 'path'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import type { ModelGroup } from '../../shared/types.js'
import type { AppState } from './state.js'
import { getDefaultModelsFolder, resolveModelPath } from '../utils/paths.js'
import { copyFileWithProgress, getFolderSize } from '../utils/fileUtils.js'

interface ModelGroupsDeps {
  getWindow: () => BrowserWindow | null
  state: AppState
}

/**
 * 将绝对路径转换为相对于 models 文件夹的相对路径
 */
function toRelativePath(absolutePath: string | undefined, weightsFolderPath: string | null): string | undefined {
  if (!absolutePath) return undefined

  const modelsFolder = weightsFolderPath || getDefaultModelsFolder()
  if (!isAbsolute(absolutePath)) return absolutePath

  try {
    const relativePath = relative(modelsFolder, absolutePath)
    if (relativePath.startsWith('..')) {
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
    return relativePath.replace(/\\/g, '/')
  } catch (error) {
    console.error(`[Main] Error converting path ${absolutePath} to relative:`, error)
    return absolutePath
  }
}

/**
 * 将模型组中的绝对路径转换为相对路径
 */
function normalizeModelGroupPaths(group: ModelGroup, weightsFolderPath: string | null): ModelGroup {
  return {
    ...group,
    sdModel: toRelativePath(group.sdModel, weightsFolderPath),
    highNoiseSdModel: toRelativePath(group.highNoiseSdModel, weightsFolderPath),
    vaeModel: toRelativePath(group.vaeModel, weightsFolderPath),
    llmModel: toRelativePath(group.llmModel, weightsFolderPath),
    clipLModel: toRelativePath(group.clipLModel, weightsFolderPath),
    t5xxlModel: toRelativePath(group.t5xxlModel, weightsFolderPath),
  }
}

/**
 * 获取模型组配置文件的路径
 */
function getModelGroupsFilePath(weightsFolderPath: string | null): string {
  const modelsFolder = weightsFolderPath || getDefaultModelsFolder()
  return join(modelsFolder, 'model-groups.json')
}

/**
 * 加载模型组列表
 */
export async function loadModelGroups(weightsFolderPath: string | null): Promise<ModelGroup[]> {
  const filePath = getModelGroupsFilePath(weightsFolderPath)
  if (!existsSync(filePath)) return []
  const content = await fs.readFile(filePath, 'utf-8')
  const groups = JSON.parse(content) as ModelGroup[]
  return groups.map((g) => normalizeModelGroupPaths(g, weightsFolderPath))
}

/**
 * 保存模型组列表
 */
async function saveModelGroups(groups: ModelGroup[], weightsFolderPath: string | null): Promise<void> {
  const filePath = getModelGroupsFilePath(weightsFolderPath)
  const dirPath = dirname(filePath)
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true })
  }
  const normalizedGroups = groups.map((g) => normalizeModelGroupPaths(g, weightsFolderPath))
  await fs.writeFile(filePath, JSON.stringify(normalizedGroups, null, 2), 'utf-8')
  console.log(`[Main] Saved ${normalizedGroups.length} model groups to ${filePath}`)
}

export function registerModelGroupsHandlers({ getWindow, state }: ModelGroupsDeps): void {
  // 获取所有模型组
  ipcMain.handle('model-groups:list', async () => {
    return await loadModelGroups(state.weightsFolderPath)
  })

  // 创建模型组
  ipcMain.handle('model-groups:create', async (_, group: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
    const groups = await loadModelGroups(state.weightsFolderPath)
    const newGroup: ModelGroup = {
      ...group,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    groups.push(newGroup)
    await saveModelGroups(groups, state.weightsFolderPath)
    return newGroup
  })

  // 更新模型组
  ipcMain.handle(
    'model-groups:update',
    async (_, { id, updates }: { id: string; updates: Partial<Omit<ModelGroup, 'id' | 'createdAt'>> }) => {
      const groups = await loadModelGroups(state.weightsFolderPath)
      const index = groups.findIndex((g) => g.id === id)
      if (index === -1) throw new Error(`模型组不存在: ${id}`)

      const oldGroup = groups[index]
      const updatedGroup = { ...oldGroup, ...updates, updatedAt: Date.now() }
      groups[index] = updatedGroup
      await saveModelGroups(groups, state.weightsFolderPath)

      // 同时更新子文件夹内的 config.json
      try {
        const modelPath = oldGroup.sdModel || updatedGroup.sdModel
        if (modelPath) {
          const modelsDir = state.weightsFolderPath || getDefaultModelsFolder()
          const absoluteModelPath = resolve(modelsDir, modelPath)
          const groupDir = dirname(absoluteModelPath)
          const configJsonPath = join(groupDir, 'config.json')

          if (existsSync(configJsonPath)) {
            const { id: _id, createdAt: _ca, updatedAt: _ua, ...configData } = updatedGroup
            const modelFields = [
              'sdModel',
              'highNoiseSdModel',
              'vaeModel',
              'llmModel',
              'clipLModel',
              't5xxlModel',
              'clipVisionModel',
            ] as const
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
      }

      return updatedGroup
    },
  )

  // 删除模型组
  ipcMain.handle('model-groups:delete', async (_, { id, deleteFiles }: { id: string; deleteFiles?: boolean }) => {
    console.log(`[Main] Deleting model group: ${id}, deleteFiles: ${deleteFiles}`)
    const groups = await loadModelGroups(state.weightsFolderPath)
    const index = groups.findIndex((g) => g.id === id)
    if (index === -1) {
      console.error(`[Main] Model group not found: ${id}`)
      throw new Error(`模型组不存在: ${id}`)
    }
    const deletedGroup = groups[index]

    if (deleteFiles) {
      try {
        const modelPath = deletedGroup.sdModel
        if (modelPath) {
          const modelsDir = state.weightsFolderPath || getDefaultModelsFolder()
          const absoluteModelPath = resolve(modelsDir, modelPath)
          const groupDir = dirname(absoluteModelPath)

          const configJsonPath = join(groupDir, 'config.json')
          if (existsSync(configJsonPath)) {
            console.log(`[Main] Deleting model group folder: ${groupDir}`)
            await fs.rm(groupDir, { recursive: true, force: true })
          } else {
            console.warn(
              `[Main] Folder ${groupDir} does not contain config.json, skipping folder deletion to be safe`,
            )
          }
        }
      } catch (err) {
        console.error('[Main] Failed to delete model group folder:', err)
      }
    }

    groups.splice(index, 1)
    await saveModelGroups(groups, state.weightsFolderPath)
    console.log(`[Main] Successfully deleted model group: ${deletedGroup.name} (${id})`)
    return true
  })

  // 获取单个模型组
  ipcMain.handle('model-groups:get', async (_, id: string) => {
    const groups = await loadModelGroups(state.weightsFolderPath)
    return groups.find((g) => g.id === id) || null
  })

  // 选择模型组文件夹
  ipcMain.handle('model-groups:select-folder', async () => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: '选择模型组文件夹',
    })

    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0]
    return null
  })

  // 导入模型组
  ipcMain.handle('model-groups:import', async (event, { folderPath, targetFolder }) => {
    try {
      if (!existsSync(folderPath)) throw new Error('文件夹不存在')
      if (!existsSync(targetFolder)) await fs.mkdir(targetFolder, { recursive: true })

      const configPath = join(folderPath, 'config.json')
      if (!existsSync(configPath)) throw new Error('文件夹中未找到 config.json 配置文件')

      const configContent = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configContent)
      if (!config.name) throw new Error('配置文件中缺少模型组名称 (name)')

      const groupSubFolder = join(targetFolder, config.name)
      if (!existsSync(groupSubFolder)) await fs.mkdir(groupSubFolder, { recursive: true })

      const totalSize = await getFolderSize(folderPath)
      let totalCopied = 0

      const filesToCopy = await fs.readdir(folderPath)
      for (const file of filesToCopy) {
        const srcPath = join(folderPath, file)
        const destPath = join(groupSubFolder, file)

        const stats = await fs.stat(srcPath)
        if (stats.isDirectory()) {
          await fs.cp(srcPath, destPath, { recursive: true })
          totalCopied += await getFolderSize(srcPath)
          const progress = Math.round((totalCopied / totalSize) * 100)
          event.sender.send('model-groups:import-progress', {
            progress,
            copied: totalCopied,
            total: totalSize,
            fileName: file,
          })
        } else {
          await copyFileWithProgress(srcPath, destPath, (chunkLength) => {
            totalCopied += chunkLength
            const progress = Math.round((totalCopied / totalSize) * 100)
            event.sender.send('model-groups:import-progress', {
              progress,
              copied: totalCopied,
              total: totalSize,
              fileName: file,
            })
          })
        }
      }

      // 注册模型组
      const groups = await loadModelGroups(state.weightsFolderPath)
      const modelFields = [
        'sdModel',
        'highNoiseSdModel',
        'vaeModel',
        'llmModel',
        'clipLModel',
        't5xxlModel',
        'clipVisionModel',
      ] as const
      const updatedConfig = { ...config }

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

      const normalizedGroup = normalizeModelGroupPaths(newGroup, state.weightsFolderPath)
      groups.push(normalizedGroup)
      await saveModelGroups(groups, state.weightsFolderPath)

      return { success: true, group: normalizedGroup }
    } catch (error) {
      console.error('[Main] Failed to import model group:', error)
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  // 建立并导出模型组
  ipcMain.handle(
    'model-groups:build-and-export',
    async (event, groupData: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
      const window = getWindow()
      if (!window) throw new Error('没有可用的窗口')

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
        if (!existsSync(groupFolder)) await fs.mkdir(groupFolder, { recursive: true })

        const exportedConfig = { ...groupData }
        const modelFields = [
          'sdModel',
          'highNoiseSdModel',
          'vaeModel',
          'llmModel',
          'clipLModel',
          't5xxlModel',
          'clipVisionModel',
        ] as const

        let totalSize = 0
        const validModels: { field: string; absolutePath: string; fileName: string }[] = []

        for (const field of modelFields) {
          const modelPath = groupData[field]
          if (modelPath) {
            const absolutePath = resolveModelPath(modelPath, state.weightsFolderPath)
            if (absolutePath && existsSync(absolutePath)) {
              const stats = await fs.stat(absolutePath)
              totalSize += stats.size
              validModels.push({ field, absolutePath, fileName: basename(absolutePath) })
            }
          }
        }

        let totalCopied = 0

        for (const { field, absolutePath, fileName } of validModels) {
          const destPath = join(groupFolder, fileName)
          await copyFileWithProgress(absolutePath, destPath, (chunkLength) => {
            totalCopied += chunkLength
            const progress = Math.round((totalCopied / totalSize) * 100)
            event.sender.send('model-groups:export-progress', {
              progress,
              copied: totalCopied,
              total: totalSize,
              fileName,
            })
          })
          // @ts-ignore
          exportedConfig[field] = fileName
        }

        await fs.writeFile(join(groupFolder, 'config.json'), JSON.stringify(exportedConfig, null, 2), 'utf8')

        return { success: true, exportPath: groupFolder }
      } catch (error) {
        console.error('[Main] Failed to export model group:', error)
        return { success: false, message: error instanceof Error ? error.message : String(error) }
      }
    },
  )
}
