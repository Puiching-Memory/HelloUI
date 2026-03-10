import type { DownloadConfig } from '@shared/types'
import { ipcInvoke, ipcInvokeWithPayload } from '@/lib/tauriIpc'

async function getAppVersion() {
  return ipcInvoke('app:get-version')
}

async function toggleDevtools() {
  return ipcInvoke('devtools:toggle')
}

async function getDownloadConfig() {
  return ipcInvoke('models:get-download-config')
}

async function updateDownloadConfig(config: Partial<DownloadConfig>) {
  return ipcInvokeWithPayload('models:set-download-config', { config })
}

export const settingsService = {
  getAppVersion,
  toggleDevtools,
  getDownloadConfig,
  updateDownloadConfig,
}
