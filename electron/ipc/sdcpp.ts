import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join, basename, extname, dirname } from 'path'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import { execa } from 'execa'
import type { DeviceType } from '../../shared/types.js'
import type { AppState } from './state.js'
import { getDefaultSDCppFolder, initDefaultSDCppFolder, getRunPath } from '../utils/paths.js'
import {
  BUILTIN_MIRRORS,
  getAllMirrors,
  addCustomMirror,
  removeCustomMirror,
  testAllMirrors,
  autoSelectMirror,
  fetchReleases,
  downloadAndInstallEngine,
  cancelDownload,
  setCustomMirrorsPath,
} from '../utils/sdcppDownloader.js'

interface SDCppDeps {
  getWindow: () => BrowserWindow | null
  state: AppState
}

async function getExecutableVersion(exePath: string): Promise<string | null> {
  const cwd = dirname(exePath)
  try {
    const { stdout, stderr } = await execa(exePath, ['--version'], { cwd, timeout: 5000 })
    const output = (stdout || stderr || '').trim()
    if (output) {
      const commitMatch = output.match(/commit\s+([a-f0-9]+)/i)
      const versionMatch = output.match(/version\s+([^\s,]+)/i)
      if (versionMatch && versionMatch[1] !== 'unknown') return versionMatch[1]
      else if (commitMatch) return `commit ${commitMatch[1]}`
      else return output.length > 100 ? output.substring(0, 100) + '...' : output
    }
  } catch (error: any) {
    console.error(`[Main] Failed to get engine version for ${exePath}:`, error.message)
  }
  return null
}

export function registerSDCppHandlers({ getWindow, state }: SDCppDeps): void {
  // 初始化默认 SD.cpp 引擎文件夹
  ipcMain.handle('sdcpp:init-default-folder', async () => {
    const folder = await initDefaultSDCppFolder()
    state.sdcppFolderPath = folder
    return folder
  })

  // 获取 SD.cpp 引擎文件夹
  ipcMain.handle('sdcpp:get-folder', async () => {
    if (!state.sdcppFolderPath) {
      state.sdcppFolderPath = getDefaultSDCppFolder()
    }
    if (state.sdcppFolderPath) {
      console.log(`[Main] SD.cpp engine search path: ${state.sdcppFolderPath}`)
    }
    return state.sdcppFolderPath
  })

  // 设置设备类型
  ipcMain.handle('sdcpp:set-device', async (_, device: DeviceType) => {
    state.sdcppDeviceType = device
    return true
  })

  // 获取设备类型
  ipcMain.handle('sdcpp:get-device', async () => {
    return state.sdcppDeviceType
  })

  // 列出文件（根据设备类型）
  ipcMain.handle('sdcpp:list-files', async (_, folder: string, deviceType: DeviceType) => {
    const deviceFolder = join(folder, deviceType)
    if (!existsSync(deviceFolder)) return { files: [], version: null }

    const entries = await fs.readdir(deviceFolder, { withFileTypes: true })
    const files: Array<{ name: string; size: number; path: string; modified: number }> = []
    const engineExtensions = ['.exe', '.dll', '.bin', '.txt']

    let engineVersion: string | null = null
    const executableName = 'sd-cli.exe'
    const executablePath = join(deviceFolder, executableName)

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (engineExtensions.includes(ext)) {
          const filePath = join(deviceFolder, entry.name)
          const stats = await fs.stat(filePath)
          files.push({ name: entry.name, size: stats.size, path: filePath, modified: stats.mtimeMs })
        }
      }
    }

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

  // 下载文件
  ipcMain.handle('sdcpp:download-file', async (_, filePath: string) => {
    const window = getWindow()
    if (!window) throw new Error('没有可用的窗口')

    const fileName = basename(filePath)
    const result = await dialog.showSaveDialog(window, {
      title: '保存引擎文件',
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
  ipcMain.handle('sdcpp:delete-file', async (_, filePath: string) => {
    await fs.unlink(filePath)
    return true
  })

  // ─── 引擎下载相关 ──────────────────────────────────────────────────

  // 初始化自定义镜像持久化路径
  const mirrorsConfigPath = join(getRunPath(), 'config', 'custom-mirrors.json')
  setCustomMirrorsPath(mirrorsConfigPath)

  // 获取可用 Release 列表
  ipcMain.handle('sdcpp:fetch-releases', async (_, opts: { mirrorId?: string; count?: number }) => {
    const mirrors = await getAllMirrors()
    const mirror = mirrors.find((m) => m.id === (opts.mirrorId || 'github')) || mirrors[0]
    return await fetchReleases(mirror, opts.count || 10)
  })

  // 下载并安装引擎
  ipcMain.handle('sdcpp:download-engine', async (_, opts: { asset: any; release: any; mirrorId?: string }) => {
    try {
      const engineFolder = state.sdcppFolderPath || getDefaultSDCppFolder()
      const mirrors = await getAllMirrors()
      const mirror = mirrors.find((m) => m.id === (opts.mirrorId || 'github')) || mirrors[0]

      await downloadAndInstallEngine(opts.asset, opts.release, mirror, engineFolder, getWindow)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  // 取消下载
  ipcMain.handle('sdcpp:cancel-download', async () => {
    return cancelDownload()
  })

  // 获取所有镜像源
  ipcMain.handle('sdcpp:get-mirrors', async () => {
    return await getAllMirrors()
  })

  // 添加自定义镜像源
  ipcMain.handle('sdcpp:add-mirror', async (_, mirror: Omit<import('../../shared/types.js').MirrorSource, 'id' | 'builtin'>) => {
    return await addCustomMirror(mirror)
  })

  // 删除自定义镜像源
  ipcMain.handle('sdcpp:remove-mirror', async (_, mirrorId: string) => {
    return await removeCustomMirror(mirrorId)
  })

  // 测试所有镜像源
  ipcMain.handle('sdcpp:test-mirrors', async () => {
    const mirrors = await getAllMirrors()
    return await testAllMirrors(mirrors)
  })

  // 自动选择最快镜像源
  ipcMain.handle('sdcpp:auto-select-mirror', async () => {
    const mirrors = await getAllMirrors()
    return await autoSelectMirror(mirrors)
  })
}
