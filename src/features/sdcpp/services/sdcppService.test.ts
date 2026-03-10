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

import { sdcppService } from './sdcppService'

describe('sdcppService', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue([])
  })

  it('maps listFiles to named tauri payload fields', async () => {
    await sdcppService.listFiles('C:/engines', 'cuda')

    expect(invokeMock).toHaveBeenCalledWith('sdcpp_list_files', {
      folder: 'C:/engines',
      deviceType: 'cuda',
    })
  })

  it('passes release fetch options without transport special cases', async () => {
    await sdcppService.fetchReleases({ mirrorId: 'github', count: 10 })

    expect(invokeMock).toHaveBeenCalledWith('sdcpp_fetch_releases', {
      mirrorId: 'github',
      count: 10,
    })
  })
})
