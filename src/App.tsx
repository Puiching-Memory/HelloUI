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
import { GeneratedImagesPage } from './pages/GeneratedImagesPage';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 检测系统主题偏好
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'components':
        return <ComponentsPage />;
      case 'settings':
        return <SettingsPage />;
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
          ) : currentPage === 'images' ? (
            <GeneratedImagesPage />
          ) : (
            renderPage()
          )}
        </MainLayout>
      </PhotoProvider>
    </FluentProvider>
  );
}

export default App;

