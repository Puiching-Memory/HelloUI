import { useEffect } from 'react';
import { PhotoProvider } from 'react-photo-view';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { ModelWeightsPage } from './pages/ModelWeightsPage';
import { SDCppPage } from './pages/SDCppPage';
import { GeneratedImagesPage } from './pages/GeneratedImagesPage';
import { PerfectPixelPage } from './pages/PerfectPixelPage';
import { WorkflowStudioPage } from './pages/WorkflowStudioPage';
import { useAppStore } from './hooks/useAppStore';

function App() {
  const { themeMode, systemIsDark, setSystemIsDark } = useAppStore();

  // 检测系统主题偏好
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [setSystemIsDark]);

  // 根据主题模式计算实际的主题
  const isDarkMode = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  // 更新根元素的 data-theme 属性用于全局主题样式
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <PhotoProvider>
      <HashRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/studio" element={<WorkflowStudioPage />} />
            <Route path="/weights" element={<ModelWeightsPage />} />
            <Route path="/sdcpp" element={<SDCppPage />} />
            <Route path="/perfect-pixel" element={<PerfectPixelPage />} />
            <Route path="/images" element={<GeneratedImagesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </MainLayout>
      </HashRouter>
    </PhotoProvider>
  );
}

export default App;


