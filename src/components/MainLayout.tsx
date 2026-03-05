import { type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  HomeRegular,
  FolderRegular,
  PlugConnectedRegular,
  ShareRegular,
  GridRegular,
  StarRegular,
  SettingsRegular,
} from '@/ui/icons';
import { useAppStore } from '../hooks/useAppStore';
import './MainLayout.css';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: ReactNode;
  group: 'core' | 'workflow' | 'engine' | 'pixel' | 'other';
}

type SidebarAnimationState = 'idle' | 'collapsing' | 'expanding';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_DEFAULT_WIDTH = 256;
const SIDEBAR_COLLAPSE_ANIMATION_MS = 280;
const SIDEBAR_EXPAND_ANIMATION_MS = 500;

const clampSidebarWidth = (width: number): number => {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
};

const getIsDesktop = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 961px)').matches;
};

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const sidebarAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarAnimationState, setSidebarAnimationState] = useState<SidebarAnimationState>('idle');
  const {
    isUploading,
    isGenerating,
    sidebarWidth,
    sidebarCollapsed,
    setSidebarWidth,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
  } = useAppStore();

  const navigationDisabled = isUploading || isGenerating;
  const navigationDisabledReason = isGenerating ? '正在生成图片，请稍候...' : isUploading ? '正在上传文件，请稍候...' : undefined;
  const effectiveSidebarCollapsed = isDesktop ? sidebarCollapsed : false;
  const effectiveSidebarWidth = isDesktop
    ? effectiveSidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : clampSidebarWidth(sidebarWidth)
    : undefined;

  const navItems: NavItem[] = [
    { id: 'home', path: '/', label: '主页', icon: <HomeRegular />, group: 'core' },
    { id: 'studio', path: '/studio', label: '节点工作台', icon: <ShareRegular />, group: 'workflow' },
    { id: 'weights', path: '/weights', label: '模型权重管理', icon: <FolderRegular />, group: 'engine' },
    { id: 'sdcpp', path: '/sdcpp', label: '引擎管理', icon: <PlugConnectedRegular />, group: 'engine' },
    { id: 'images', path: '/images', label: '生成结果', icon: <GridRegular />, group: 'engine' },
    { id: 'perfect-pixel', path: '/perfect-pixel', label: '像素画精修', icon: <StarRegular />, group: 'pixel' },
    { id: 'settings', path: '/settings', label: '设置', icon: <SettingsRegular />, group: 'other' },
  ];

  const navGroups: Array<{ id: NavItem['group']; title: string }> = [
    { id: 'core', title: '总览' },
    { id: 'workflow', title: '工作流' },
    { id: 'engine', title: 'SD.cpp 引擎' },
    { id: 'pixel', title: '像素工具' },
    { id: 'other', title: '其他' },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(min-width: 961px)');
    const handleMediaChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener('change', handleMediaChange);
    return () => media.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarAnimationTimerRef.current) {
        clearTimeout(sidebarAnimationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMove = (event: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const nextWidth = clampSidebarWidth(state.startWidth + (event.clientX - state.startX));
      setSidebarWidth(nextWidth);
    };

    const handleUp = () => {
      setIsResizing(false);
      resizeStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, setSidebarWidth]);

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isDesktop || effectiveSidebarCollapsed) return;
    resizeStateRef.current = { startX: event.clientX, startWidth: clampSidebarWidth(sidebarWidth) };
    setIsResizing(true);
    event.preventDefault();
  };

  const beginSidebarAnimation = (nextCollapsed: boolean) => {
    if (sidebarAnimationTimerRef.current) {
      clearTimeout(sidebarAnimationTimerRef.current);
    }
    setSidebarAnimationState(nextCollapsed ? 'collapsing' : 'expanding');
    sidebarAnimationTimerRef.current = setTimeout(() => {
      setSidebarAnimationState('idle');
    }, nextCollapsed ? SIDEBAR_COLLAPSE_ANIMATION_MS : SIDEBAR_EXPAND_ANIMATION_MS);
  };

  const handleSidebarToggle = () => {
    if (!isDesktop) return;
    const nextCollapsed = !sidebarCollapsed;
    beginSidebarAnimation(nextCollapsed);
    toggleSidebarCollapsed();
  };

  const handleResizeReset = () => {
    if (!isDesktop) return;
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    if (effectiveSidebarCollapsed) {
      beginSidebarAnimation(false);
      setSidebarCollapsed(false);
    }
    setIsResizing(false);
    resizeStateRef.current = null;
  };

  const renderNavButton = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const title = navigationDisabled && !isActive ? (navigationDisabledReason || '操作进行中，请稍候...') : effectiveSidebarCollapsed ? item.label : undefined;
    return (
      <button
        key={item.id}
        className={`main-nav-item ${isActive ? 'is-active' : ''} ${effectiveSidebarCollapsed ? 'is-collapsed' : ''}`}
        onClick={() => navigate(item.path)}
        disabled={navigationDisabled && !isActive}
        title={title}
        type="button"
      >
        <span className="main-nav-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span className="main-nav-label">{item.label}</span>
      </button>
    );
  };

  const sidebarStyle: CSSProperties = isDesktop && effectiveSidebarWidth
    ? { width: effectiveSidebarWidth, minWidth: effectiveSidebarWidth }
    : {};
  const sidebarAnimationClass = sidebarAnimationState === 'idle' ? '' : `is-${sidebarAnimationState}`;

  return (
    <div className="main-shell">
      <div className={`main-surface ${isResizing ? 'is-resizing' : ''}`}>
        <div className={`main-sidebar ${effectiveSidebarCollapsed ? 'is-collapsed' : ''} ${sidebarAnimationClass}`} style={sidebarStyle}>
          <div className={`main-brand-row ${effectiveSidebarCollapsed ? 'is-collapsed' : ''}`}>
            <button className="main-brand" onClick={() => navigate('/')} type="button">
              <span className="main-brand-mark" aria-hidden="true">
                H
              </span>
              <span className="main-brand-copy">
                <span className="main-brand-title">HelloUI</span>
                <span className="main-brand-subtitle">AI Studio</span>
              </span>
            </button>
            {isDesktop ? (
              <button
                className="main-brand-toggle"
                type="button"
                onClick={handleSidebarToggle}
                title={effectiveSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
                aria-label={effectiveSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
              >
                {effectiveSidebarCollapsed ? <ChevronRightRegular /> : <ChevronLeftRegular />}
              </button>
            ) : null}
          </div>

          <div className="main-nav-scroll">
            {navGroups.map((group) => {
              const groupItems = navItems.filter((item) => item.group === group.id);
              if (groupItems.length === 0) {
                return null;
              }

              return (
                <section className="main-nav-group" key={group.id}>
                  {effectiveSidebarCollapsed ? (
                    <div className="main-nav-group-divider" aria-hidden="true" />
                  ) : (
                    <h3 className="main-nav-group-title">{group.title}</h3>
                  )}
                  <div className="main-nav-group-items">{groupItems.map(renderNavButton)}</div>
                </section>
              );
            })}
          </div>

          <div className="main-sidebar-footer">
            <div className="main-avatar" aria-hidden="true">
              PJ
            </div>
            <div className="main-footer-copy">
              <p>Control Center</p>
              <p>hello@local</p>
            </div>
          </div>
        </div>
        {isDesktop ? (
          <div
            className={`main-sidebar-resizer ${effectiveSidebarCollapsed ? 'is-disabled' : ''}`}
            onMouseDown={handleResizeStart}
            onDoubleClick={handleResizeReset}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整侧边栏宽度，双击恢复默认宽度"
            title="拖拽调整宽度，双击恢复默认宽度"
          />
        ) : null}

        <main className="main-content">
          <div className="main-content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
};


