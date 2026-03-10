import { theme } from 'antd'
import type { ThemeConfig } from 'antd'
import type { ThemeMode } from '@/hooks/useAppStore'

export function resolveIsDarkMode(themeMode: ThemeMode): boolean {
  return themeMode === 'dark'
}

export function applyDocumentThemeAttributes(root: HTMLElement, isDarkMode: boolean): void {
  root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  root.removeAttribute('data-scheme')
}

export function buildAntdThemeConfig(isDarkMode: boolean): ThemeConfig {
  const algorithm = isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm

  return {
    algorithm,
    token: {
      borderRadius: 12,
    },
  }
}
