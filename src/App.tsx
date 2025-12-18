import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { catppuccinLightTheme, catppuccinDarkTheme, catppuccinLatteTheme, catppuccinLatteDarkTheme } from './theme/catppuccinTheme';
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
import type { Theme } from '@fluentui/react-components';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'catppuccin' | 'latte' | 'default';

const THEME_STORAGE_KEY = 'app-theme-mode';
const COLOR_SCHEME_STORAGE_KEY = 'app-color-scheme';

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) as ColorScheme | null;
    return (saved === 'catppuccin' || saved === 'latte' || saved === 'default') ? saved : 'default';
  });
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

  // 处理主题模式切换
  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  // 处理颜色方案切换
  const handleColorSchemeChange = (scheme: ColorScheme) => {
    setColorScheme(scheme);
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handlePageChange} />;
      case 'components':
        return <ComponentsPage />;
      case 'settings':
        return <SettingsPage 
          themeMode={themeMode} 
          onThemeChange={handleThemeChange}
          colorScheme={colorScheme}
          onColorSchemeChange={handleColorSchemeChange}
        />;
      default:
        return <HomePage onNavigate={handlePageChange} />;
    }
  };

  const handlePageChange = (page: PageType) => {
    // 如果正在上传或正在生成，禁止切换页面
    if (isUploading || isGenerating) {
      return;
    }
    setCurrentPage(page);
  };

  // 更新根元素的 data-theme 属性以支持滚动条主题切换
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <FluentProvider theme={getCurrentTheme()}>
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

