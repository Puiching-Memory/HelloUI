import type { DeviceType } from '../../shared/types.js'
import type { ChildProcess } from 'child_process'

/**
 * 共享的应用状态（在 IPC handler 模块间共享）
 */
export interface AppState {
  weightsFolderPath: string | null
  sdcppFolderPath: string | null
  sdcppDeviceType: DeviceType
  currentGenerateProcess: ChildProcess | null
  currentGenerateKill: (() => void) | null
}

/**
 * 创建初始应用状态
 */
export function createAppState(): AppState {
  return {
    weightsFolderPath: null,
    sdcppFolderPath: null,
    sdcppDeviceType: 'cuda',
    currentGenerateProcess: null,
    currentGenerateKill: null,
  }
}
