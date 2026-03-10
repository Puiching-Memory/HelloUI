import { vi } from 'vitest'

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

import { generatedImagesService } from './generatedImagesService'

describe('generatedImagesService', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ success: true })
  })

  it('sends batch download payload via value', async () => {
    await generatedImagesService.batchDownloadGeneratedImages(['a.png', 'b.png'])

    expect(invokeMock).toHaveBeenCalledWith('generated_images_batch_download', {
      value: ['a.png', 'b.png'],
    })
  })
})
