import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { useState, useEffect } from 'react';
import { PhotoProvider } from 'react-photo-view';
import { MainLayout, PageType } from './components/MainLayout';
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

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'app-theme-mode';

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 从 localStorage 加载保存的主题设置
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
      setThemeMode(savedTheme);
    }
  }, []);

  // 检测系统主题偏好
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 根据主题模式计算实际的主题
  const isDarkMode = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  // 处理主题切换
  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'components':
        return <ComponentsPage />;
      case 'settings':
        return <SettingsPage themeMode={themeMode} onThemeChange={handleThemeChange} />;
      default:
        return <HomePage />;
    }
  };

  const handlePageChange = (page: PageType) => {
    // 如果正在上传或正在生成，禁止切换页面
    if (isUploading || isGenerating) {
      return;
    }
    setCurrentPage(page);
  };

  return (
    <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
      <PhotoProvider>
        <MainLayout 
          currentPage={currentPage} 
          onPageChange={handlePageChange}
          navigationDisabled={isUploading || isGenerating}
          navigationDisabledReason={isGenerating ? '正在生成图片，请稍候...' : isUploading ? '正在上传文件，请稍候...' : undefined}
        >
          {currentPage === 'weights' ? (
            <ModelWeightsPage onUploadStateChange={setIsUploading} />
          ) : currentPage === 'sdcpp' ? (
            <SDCppPage />
          ) : currentPage === 'generate' ? (
            <GeneratePage onGeneratingStateChange={setIsGenerating} />
          ) : currentPage === 'edit-image' ? (
            <EditImagePage onGeneratingStateChange={setIsGenerating} />
          ) : currentPage === 'images' ? (
            <GeneratedImagesPage />
          ) : currentPage === 'video-generate' ? (
            <VideoGeneratePage />
          ) : currentPage === 'image-upscale' ? (
            <ImageUpscalePage />
          ) : (
            renderPage()
          )}
        </MainLayout>
      </PhotoProvider>
    </FluentProvider>
  );
}

export default App;

