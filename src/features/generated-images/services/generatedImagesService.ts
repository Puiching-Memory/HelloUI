import { ipcInvoke, ipcInvokeWithPayload } from '@/lib/tauriIpc'

async function listGeneratedImages() {
  return ipcInvoke('generated-images:list')
}

async function downloadGeneratedImage(path: string) {
  return ipcInvoke('generated-images:download', path)
}

async function deleteGeneratedImage(path: string) {
  return ipcInvoke('generated-images:delete', path)
}

async function getGeneratedImagePreview(path: string) {
  return ipcInvoke('generated-images:get-preview', path)
}

async function batchDownloadGeneratedImages(paths: string[]) {
  return ipcInvokeWithPayload('generated-images:batch-download', { value: paths })
}

export const generatedImagesService = {
  listGeneratedImages,
  downloadGeneratedImage,
  deleteGeneratedImage,
  getGeneratedImagePreview,
  batchDownloadGeneratedImages,
}
