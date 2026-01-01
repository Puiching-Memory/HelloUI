import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { catppuccinLightTheme, catppuccinDarkTheme, catppuccinLatteTheme, catppuccinLatteDarkTheme } from './theme/catppuccinTheme';
import { useEffect } from 'react';
import { PhotoProvider } from 'react-photo-view';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { HomePage } from './pages/HomePage';
import { ComponentsPage } from './pages/ComponentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ModelWeightsPage } from './pages/ModelWeightsPage';
import { SDCppPage } from './pages/SDCppPage';
import { GeneratePage } from './pages/GeneratePage';
import { EditImagePage } from './pages/EditImagePage';
import { GeneratedImagesPage } from './pages/GeneratedImagesPage';
import { VideoGeneratePage } from './pages/VideoGeneratePage';
import { ImageUpscalePage } from './pages/ImageUpscalePage';
import { AliyunTongyiVideoPage } from './pages/AliyunTongyiVideoPage';
import type { Theme } from '@fluentui/react-components';
import { useAppStore } from './hooks/useAppStore';

function App() {
  const { themeMode, colorScheme, systemIsDark, setSystemIsDark } = useAppStore();

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

  // 获取当前使用的主题
  const getCurrentTheme = (): Theme => {
    if (colorScheme === 'catppuccin') {
      return isDarkMode ? catppuccinDarkTheme : catppuccinLightTheme;
    } else if (colorScheme === 'latte') {
      return isDarkMode ? catppuccinLatteDarkTheme : catppuccinLatteTheme;
    } else {
      return isDarkMode ? webDarkTheme : webLightTheme;
    }
  };

  // 更新根元素的 data-theme 属性以支持滚动条主题切换
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <FluentProvider theme={getCurrentTheme()}>
      <PhotoProvider>
        <HashRouter>
          <MainLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/weights" element={<ModelWeightsPage />} />
              <Route path="/sdcpp" element={<SDCppPage />} />
              <Route path="/generate" element={<GeneratePage />} />
              <Route path="/edit-image" element={<EditImagePage />} />
              <Route path="/video-generate" element={<VideoGeneratePage />} />
              <Route path="/image-upscale" element={<ImageUpscalePage />} />
              <Route path="/aliyun-video" element={<AliyunTongyiVideoPage />} />
              <Route path="/images" element={<GeneratedImagesPage />} />
              <Route path="/components" element={<ComponentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </MainLayout>
        </HashRouter>
      </PhotoProvider>
    </FluentProvider>
  );
}

export default App;


