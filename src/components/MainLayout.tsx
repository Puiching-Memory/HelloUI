import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from 'antd';
import { sidebarRouteGroups } from '@/app/routes';
import { useAppStore } from '../hooks/useAppStore';
import './MainLayout.css';

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 961px)').matches : true,
  );
  const { sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();
  const collapsed = isDesktop && sidebarCollapsed;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(min-width: 961px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const handleNav = (key: string) => {
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
          {sidebarRouteGroups.map((g) => (
            <div className="sidebar-group" key={g.label}>
              {!collapsed && <div className="sidebar-group-label">{g.label}</div>}
              {g.items.map((item) => {
                const active = location.pathname === item.path;
                const Icon = item.icon;
                const btn = (
                  <button
                    key={item.path}
                    className={`sidebar-item${active ? ' is-active' : ''}`}
                    onClick={() => handleNav(item.path)}
                  >
                    <span className="sidebar-item-icon"><Icon fontSize={18} /></span>
                    {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                  </button>
                );
                return collapsed ? (
                  <Tooltip key={item.path} title={item.label} placement="right">
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

