import { Suspense, useEffect, useMemo } from 'react'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { PhotoProvider } from 'react-photo-view'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { appRoutes } from './app/routes'
import { applyDocumentThemeAttributes, buildAntdThemeConfig, resolveIsDarkMode } from './app/theme'
import { MainLayout } from './components/MainLayout'
import { useAppStore } from './hooks/useAppStore'

function App() {
  const { themeMode } = useAppStore()
  const isDarkMode = resolveIsDarkMode(themeMode)

  useEffect(() => {
    applyDocumentThemeAttributes(document.documentElement, isDarkMode)
  }, [isDarkMode])

  const antTheme = useMemo(() => buildAntdThemeConfig(isDarkMode), [isDarkMode])

  return (
    <ConfigProvider locale={zhCN} theme={antTheme}>
      <AntApp>
        <PhotoProvider>
          <HashRouter>
            <MainLayout>
              <Suspense
                fallback={
                  <div style={{ display: 'grid', minHeight: '50vh', placeItems: 'center' }}>
                    <Spin size="large" />
                  </div>
                }
              >
                <Routes>
                  {appRoutes.map((route) => (
                    <Route element={<route.element />} key={route.path} path={route.path} />
                  ))}
                </Routes>
              </Suspense>
            </MainLayout>
          </HashRouter>
        </PhotoProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
