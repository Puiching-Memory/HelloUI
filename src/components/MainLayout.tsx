import { ReactNode, ReactElement } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  HomeRegular,
  AppsRegular,
  SettingsRegular,
  DatabaseRegular,
  CodeRegular,
  ImageAddRegular,
  ImageRegular,
  EditRegular,
  VideoClipRegular,
  ZoomInRegular,
} from '@fluentui/react-icons';
import { useAppStore } from '../hooks/useAppStore';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    width: '240px',
    minWidth: '240px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingVerticalM,
    gap: tokens.spacingVerticalXS,
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    flexShrink: 0,
  },
  navButton: {
    justifyContent: 'flex-start',
    width: '100%',
    height: '40px',
    minHeight: '40px',
    flexShrink: 0,
    paddingLeft: tokens.spacingHorizontalM,
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  navGroupTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    padding: `0 ${tokens.spacingHorizontalS}`,
    marginBottom: tokens.spacingVerticalXS,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
});

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: ReactElement;
}

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { isUploading, isGenerating } = useAppStore();

  const navigationDisabled = isUploading || isGenerating;
  const navigationDisabledReason = isGenerating ? '正在生成图片，请稍候...' : isUploading ? '正在上传文件，请稍候...' : undefined;

  const navItems: NavItem[] = [
    { id: 'home', path: '/', label: '主页', icon: <HomeRegular /> },
    { id: 'weights', path: '/weights', label: '模型权重管理', icon: <DatabaseRegular /> },
    { id: 'sdcpp', path: '/sdcpp', label: 'SD.cpp 推理引擎', icon: <CodeRegular /> },
    { id: 'generate', path: '/generate', label: '图片生成', icon: <ImageAddRegular /> },
    { id: 'edit-image', path: '/edit-image', label: '图片编辑', icon: <EditRegular /> },
    { id: 'video-generate', path: '/video-generate', label: '视频生成', icon: <VideoClipRegular /> },
    { id: 'image-upscale', path: '/image-upscale', label: '图像超分辨率', icon: <ZoomInRegular /> },
    { id: 'aliyun-video', path: '/aliyun-video', label: '文生视频', icon: <VideoClipRegular /> },
    { id: 'images', path: '/images', label: '生成结果', icon: <ImageRegular /> },
    { id: 'components', path: '/components', label: '组件展示', icon: <AppsRegular /> },
    { id: 'settings', path: '/settings', label: '设置', icon: <SettingsRegular /> },
  ];

  const renderNavButton = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    return (
      <Button
        key={item.id}
        appearance={isActive ? 'primary' : 'subtle'}
        icon={item.icon}
        className={styles.navButton}
        onClick={() => navigate(item.path)}
        disabled={navigationDisabled && !isActive}
        title={navigationDisabled && !isActive ? (navigationDisabledReason || '操作进行中，请稍候...') : undefined}
      >
        {item.label}
      </Button>
    );
  };

  return (
    <div className={styles.container}>
      {/* 左侧导航栏 */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 style={{ margin: 0, fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold }}>
            HelloUI
          </h2>
        </div>
        
        {/* 主页按钮 */}
        {navItems.filter(item => item.id === 'home').map(renderNavButton)}

        {/* SD.cpp引擎功能页面组 */}
        <div className={styles.navGroup}>
          <div className={styles.navGroupTitle}>SD.cpp引擎</div>
          {navItems.filter(item => ['weights', 'sdcpp', 'generate', 'edit-image', 'video-generate', 'image-upscale', 'images'].includes(item.id)).map(renderNavButton)}
        </div>

        {/* 阿里通义API页面组 */}
        <div className={styles.navGroup}>
          <div className={styles.navGroupTitle}>阿里通义API</div>
          {navItems.filter(item => ['aliyun-video'].includes(item.id)).map(renderNavButton)}
        </div>

        {/* 其他页面按钮 */}
        {navItems.filter(item => !['home', 'weights', 'sdcpp', 'generate', 'edit-image', 'images', 'video-generate', 'image-upscale', 'aliyun-video'].includes(item.id)).map(renderNavButton)}
      </div>

      {/* 主内容区 */}
      <div className={styles.content}>
        <div className={styles.mainContent}>
          {children}
        </div>
      </div>
    </div>
  );
};


