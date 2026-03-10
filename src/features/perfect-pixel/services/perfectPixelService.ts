import { ipcInvoke } from '@/lib/tauriIpc'

async function selectImage() {
  return ipcInvoke('perfect-pixel:select-image')
}

async function readImage(path: string) {
  return ipcInvoke('perfect-pixel:read-image', path)
}

async function saveImage(dataUrl: string) {
  return ipcInvoke('perfect-pixel:save', dataUrl)
}

export const perfectPixelService = {
  selectImage,
  readImage,
  saveImage,
}
