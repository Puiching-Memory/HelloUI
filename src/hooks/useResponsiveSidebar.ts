import { useEffect, useState } from 'react'
import { useAppStore } from './useAppStore'

const DESKTOP_MEDIA_QUERY = '(min-width: 961px)'

function getDesktopMatch() {
  return typeof window === 'undefined' ? true : window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

export function useResponsiveSidebar() {
  const [isDesktop, setIsDesktop] = useState(getDesktopMatch)
  const { sidebarCollapsed, toggleSidebarCollapsed } = useAppStore()

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return {
    collapsed: isDesktop && sidebarCollapsed,
    isDesktop,
    toggleSidebarCollapsed,
  }
}
