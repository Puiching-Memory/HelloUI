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

import { modelWeightsService } from './modelWeightsService'

describe('modelWeightsService', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ success: true })
  })

  it('maps download group payload to named fields', async () => {
    await modelWeightsService.downloadModelGroupFiles('group-1', 'hf-mirror')

    expect(invokeMock).toHaveBeenCalledWith('models_download_group_files', {
      groupId: 'group-1',
      mirrorId: 'hf-mirror',
    })
  })
})
