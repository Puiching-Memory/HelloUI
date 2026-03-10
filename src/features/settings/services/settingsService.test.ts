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

import { settingsService } from './settingsService'

describe('settingsService', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ ok: true })
  })

  it('wraps download config payload under config', async () => {
    await settingsService.updateDownloadConfig({ chunkSizeMb: 20 })

    expect(invokeMock).toHaveBeenCalledWith('models_set_download_config', {
      config: { chunkSizeMb: 20 },
    })
  })
})
