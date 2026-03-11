import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { MainLayout } from './MainLayout'
import { renderIntoDocument } from '@/test/render'
import { useAppStore } from '@/hooks/useAppStore'

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches,
      media: '(min-width: 961px)',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

describe('MainLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({ sidebarCollapsed: false, themeMode: 'light' })
  })

  it('toggles the desktop sidebar', () => {
    mockMatchMedia(true)
    const view = renderIntoDocument(
      <MemoryRouter initialEntries={['/']}>
        <MainLayout>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('.sidebar')
    const toggle = document.querySelector<HTMLButtonElement>('.sidebar-toggle')

    expect(sidebar).not.toHaveClass('is-collapsed')
    expect(toggle).not.toBeNull()

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(sidebar).toHaveClass('is-collapsed')
    view.unmount()
  })

  it('keeps the mobile sidebar expanded even when collapse is persisted', () => {
    mockMatchMedia(false)
    useAppStore.setState({ sidebarCollapsed: true })

    const view = renderIntoDocument(
      <MemoryRouter initialEntries={['/studio']}>
        <MainLayout>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>,
    )

    expect(document.querySelector('.sidebar')).not.toHaveClass('is-collapsed')
    expect(document.querySelector('.sidebar-toggle')).toBeNull()
    view.unmount()
  })
})
