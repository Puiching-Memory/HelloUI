import type { DeviceType, MirrorSource, SDCppRelease, SDCppReleaseAsset } from '@shared/types'
import { ipcInvoke, ipcInvokeWithPayload } from '@/lib/tauriIpc'

async function getFolder() {
  return ipcInvoke('sdcpp:get-folder')
}

async function initDefaultFolder() {
  return ipcInvoke('sdcpp:init-default-folder')
}

async function checkFolder(path: string) {
  return ipcInvoke('sdcpp:check-folder', path)
}

async function setFolder(path: string) {
  return ipcInvoke('sdcpp:set-folder', path)
}

async function listFiles(folder: string, deviceType: DeviceType) {
  return ipcInvokeWithPayload('sdcpp:list-files', { folder, deviceType })
}

async function getMirrors() {
  return ipcInvoke('sdcpp:get-mirrors')
}

async function fetchReleases(options: { mirrorId?: string; count?: number }) {
  return ipcInvokeWithPayload('sdcpp:fetch-releases', options)
}

async function downloadEngine(asset: SDCppReleaseAsset, release: SDCppRelease, mirrorId?: string) {
  return ipcInvokeWithPayload('sdcpp:download-engine', { asset, release, mirrorId })
}

async function cancelDownload() {
  return ipcInvoke('sdcpp:cancel-download')
}

async function testMirrors() {
  return ipcInvoke('sdcpp:test-mirrors')
}

async function autoSelectMirror() {
  return ipcInvoke('sdcpp:auto-select-mirror')
}

async function addMirror(mirror: Omit<MirrorSource, 'id' | 'builtin'>) {
  return ipcInvokeWithPayload('sdcpp:add-mirror', mirror)
}

async function removeMirror(mirrorId: string) {
  return ipcInvoke('sdcpp:remove-mirror', mirrorId)
}

export const sdcppService = {
  getFolder,
  initDefaultFolder,
  checkFolder,
  setFolder,
  listFiles,
  getMirrors,
  fetchReleases,
  downloadEngine,
  cancelDownload,
  testMirrors,
  autoSelectMirror,
  addMirror,
  removeMirror,
}
