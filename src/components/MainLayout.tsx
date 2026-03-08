import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from 'antd';
import {
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
  key: string;
  icon: React.ReactNode;
  label: string;
  group: string;
}

const navItems: NavItem[] = [
  { key: '/', icon: <HomeRegular fontSize={18} />, label: '主页', group: '总览' },
  { key: '/studio', icon: <ShareRegular fontSize={18} />, label: '节点工作台', group: '工作流' },
  { key: '/weights', icon: <FolderRegular fontSize={18} />, label: '模型权重管理', group: 'SD.cpp 引擎' },
  { key: '/sdcpp', icon: <PlugConnectedRegular fontSize={18} />, label: '引擎管理', group: 'SD.cpp 引擎' },
  { key: '/images', icon: <GridRegular fontSize={18} />, label: '生成结果', group: 'SD.cpp 引擎' },
  { key: '/perfect-pixel', icon: <StarRegular fontSize={18} />, label: '像素画精修', group: '像素工具' },
  { key: '/settings', icon: <SettingsRegular fontSize={18} />, label: '设置', group: '其他' },
];

// 按 group 分组，保留插入顺序
function groupedNav() {
  const groups: { label: string; items: NavItem[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const item of navItems) {
    if (!current || current.label !== item.group) {
      current = { label: item.group, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

const groups = groupedNav();

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 961px)').matches : true,
  );
  const {
    isUploading,
    isGenerating,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useAppStore();

  const navigationDisabled = isUploading || isGenerating;
  const collapsed = isDesktop && sidebarCollapsed;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(min-width: 961px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const handleNav = (key: string) => {
    if (navigationDisabled) return;
    navigate(key);
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand" onClick={() => handleNav('/')}>
          <div className="sidebar-logo">H</div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">HelloUI</span>
              <span className="sidebar-brand-sub">AI Studio</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {groups.map((g) => (
            <div className="sidebar-group" key={g.label}>
              {!collapsed && <div className="sidebar-group-label">{g.label}</div>}
              {g.items.map((item) => {
                const active = location.pathname === item.key;
                const btn = (
                  <button
                    key={item.key}
                    className={`sidebar-item${active ? ' is-active' : ''}`}
                    onClick={() => handleNav(item.key)}
                    disabled={navigationDisabled}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>
                    {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                  </button>
                );
                return collapsed ? (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    {btn}
                  </Tooltip>
                ) : btn;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        {isDesktop && (
          <button className="sidebar-toggle" onClick={toggleSidebarCollapsed}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              {collapsed ? (
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        )}
      </aside>

      <main className="app-content">
        <div style={{ padding: 24, minHeight: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  );
};


