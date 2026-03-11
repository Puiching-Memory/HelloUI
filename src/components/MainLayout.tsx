import type { ReactNode } from 'react'
import { Tooltip } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { sidebarRouteGroups } from '@/app/routes'
import { useResponsiveSidebar } from '@/hooks/useResponsiveSidebar'
import './MainLayout.css'

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { collapsed, isDesktop, toggleSidebarCollapsed } = useResponsiveSidebar()

  const handleNav = (key: string) => {
    navigate(key)
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="sidebar-brand" onClick={() => handleNav('/')}>
          <div className="sidebar-logo">H</div>
          {!collapsed ? (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">HelloUI</span>
              <span className="sidebar-brand-sub">AI Studio</span>
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {sidebarRouteGroups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              {!collapsed ? <div className="sidebar-group-label">{group.label}</div> : null}
              {group.items.map((item) => {
                const active = location.pathname === item.path
                const Icon = item.icon
                const button = (
                  <button
                    key={item.path}
                    className={`sidebar-item${active ? ' is-active' : ''}`}
                    onClick={() => handleNav(item.path)}
                  >
                    <span className="sidebar-item-icon">
                      <Icon fontSize={18} />
                    </span>
                    {!collapsed ? <span className="sidebar-item-label">{item.label}</span> : null}
                  </button>
                )

                return collapsed ? (
                  <Tooltip key={item.path} title={item.label} placement="right">
                    {button}
                  </Tooltip>
                ) : button
              })}
            </div>
          ))}
        </nav>

        {isDesktop ? (
          <button className="sidebar-toggle" onClick={toggleSidebarCollapsed}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              {collapsed ? (
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        ) : null}
      </aside>

      <main className="app-content">
        <div style={{ padding: 24, minHeight: '100%' }}>{children}</div>
      </main>
    </div>
  )
}
