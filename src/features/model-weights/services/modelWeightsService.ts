import type { HfMirrorId, ModelGroup } from '@shared/types'
import { ipcInvoke, ipcInvokeWithPayload } from '@/lib/tauriIpc'

async function getWeightsFolder() {
  return ipcInvoke('weights:get-folder')
}

async function initDefaultWeightsFolder() {
  return ipcInvoke('weights:init-default-folder')
}

async function checkWeightsFolder(path: string) {
  return ipcInvoke('weights:check-folder', path)
}

async function setWeightsFolder(path: string) {
  return ipcInvoke('weights:set-folder', path)
}

async function listModelGroups() {
  return ipcInvoke('model-groups:list')
}

async function createModelGroup(group: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>) {
  return ipcInvoke('model-groups:create', group)
}

async function updateModelGroup(id: string, updates: Partial<Omit<ModelGroup, 'id' | 'createdAt'>>) {
  return ipcInvokeWithPayload('model-groups:update', { id, updates })
}

async function deleteModelGroup(id: string, deleteFiles?: boolean) {
  return ipcInvokeWithPayload('model-groups:delete', { id, deleteFiles })
}

async function checkModelGroupFiles(groupId: string) {
  return ipcInvokeWithPayload('models:check-files', { groupId })
}

async function getHfMirror() {
  return ipcInvoke('models:get-hf-mirror')
}

async function setHfMirror(mirrorId: HfMirrorId) {
  return ipcInvoke('models:set-hf-mirror', mirrorId)
}

async function downloadModelGroupFiles(groupId: string, mirrorId?: HfMirrorId) {
  return ipcInvokeWithPayload('models:download-group-files', { groupId, mirrorId })
}

async function verifyModelFile(groupId: string, filePath: string) {
  return ipcInvokeWithPayload('models:verify-file', { groupId, filePath })
}

async function clearVerifiedFiles(groupId: string) {
  return ipcInvokeWithPayload('models:clear-verified', { groupId })
}

async function cancelModelDownload() {
  return ipcInvoke('models:cancel-download')
}

async function deleteModelFile(groupId: string, filePath: string) {
  return ipcInvokeWithPayload('models:delete-file', { groupId, filePath })
}

export const modelWeightsService = {
  getWeightsFolder,
  initDefaultWeightsFolder,
  checkWeightsFolder,
  setWeightsFolder,
  listModelGroups,
  createModelGroup,
  updateModelGroup,
  deleteModelGroup,
  checkModelGroupFiles,
  getHfMirror,
  setHfMirror,
  downloadModelGroupFiles,
  verifyModelFile,
  clearVerifiedFiles,
  cancelModelDownload,
  deleteModelFile,
}
