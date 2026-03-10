import { theme as antdTheme } from 'antd'
import { applyDocumentThemeAttributes, buildAntdThemeConfig, resolveIsDarkMode } from './theme'

describe('app theme helpers', () => {
  it('resolves light and dark theme modes correctly', () => {
    expect(resolveIsDarkMode('dark')).toBe(true)
    expect(resolveIsDarkMode('light')).toBe(false)
  })

  it('applies document theme attributes', () => {
    const root = document.documentElement
    root.setAttribute('data-scheme', 'catppuccin')

    applyDocumentThemeAttributes(root, true)
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.hasAttribute('data-scheme')).toBe(false)

    applyDocumentThemeAttributes(root, false)
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(root.hasAttribute('data-scheme')).toBe(false)
  })

  it('builds themed antd token overrides', () => {
    const darkConfig = buildAntdThemeConfig(true)
    const lightConfig = buildAntdThemeConfig(false)
    const darkToken = antdTheme.getDesignToken(darkConfig)
    const lightToken = antdTheme.getDesignToken(lightConfig)

    expect(darkConfig.algorithm).toBeDefined()
    expect(lightConfig.token?.borderRadius).toBe(12)
    expect(lightToken.colorPrimary).toBe('#1677ff')
    expect(darkToken.colorPrimary).toBe('#1668dc')
  })
})
