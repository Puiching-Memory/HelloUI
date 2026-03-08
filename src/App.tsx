import { useEffect, useMemo } from 'react';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
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
import { catppuccinDarkTheme, catppuccinLatteTheme } from './theme/catppuccinTheme';

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

  // 更新根元素的 data-theme / data-scheme 属性用于全局主题样式
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    if (colorScheme === 'default') {
      root.removeAttribute('data-scheme');
    } else {
      root.setAttribute('data-scheme', colorScheme);
    }
  }, [isDarkMode, colorScheme]);

  // Ant Design 主题配置
  const antTheme = useMemo(() => {
    const algorithm = isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm;

    // 根据 colorScheme 选择色板
    let colorPrimary = '#2563eb';
    let colorBgBase: string | undefined;
    let colorTextBase: string | undefined;
    let colorBorder: string | undefined;

    if (colorScheme === 'catppuccin') {
      const t = catppuccinDarkTheme;
      colorPrimary = t.colorBrandForeground1 as string;
      colorBgBase = t.colorNeutralBackground1 as string;
      colorTextBase = t.colorNeutralForeground1 as string;
      colorBorder = t.colorNeutralStroke1 as string;
    } else if (colorScheme === 'latte') {
      const t = catppuccinLatteTheme;
      colorPrimary = t.colorBrandForeground1 as string;
      colorBgBase = t.colorNeutralBackground1 as string;
      colorTextBase = t.colorNeutralForeground1 as string;
      colorBorder = t.colorNeutralStroke1 as string;
    }

    return {
      algorithm,
      token: {
        colorPrimary,
        borderRadius: 8,
        ...(colorBgBase ? { colorBgBase } : {}),
        ...(colorTextBase ? { colorTextBase } : {}),
        ...(colorBorder ? { colorBorder } : {}),
      },
    };
  }, [isDarkMode, colorScheme]);

  return (
    <ConfigProvider theme={antTheme} locale={zhCN}>
      <AntApp>
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
      </AntApp>
    </ConfigProvider>
  );
}

export default App;


