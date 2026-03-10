import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import {
  FolderRegular,
  GridRegular,
  HomeRegular,
  PlugConnectedRegular,
  SettingsRegular,
  ShareRegular,
  StarRegular,
} from '@/ui/icons'

type PageComponent = ComponentType<Record<string, never>>
type PageLoader = () => Promise<{ default: PageComponent }>
type IconComponent = ComponentType<{ fontSize?: number | string }>

export interface RouteMeta {
  path: string
  label: string
  group: string
  icon: IconComponent
  element: LazyExoticComponent<PageComponent>
  lazy: PageLoader
  showInSidebar: boolean
}

type NamedPageModule = Record<string, unknown>

function lazyNamedPage(moduleLoader: () => Promise<NamedPageModule>, exportName: string): PageLoader {
  return async () => {
    const module = await moduleLoader()
    return { default: module[exportName] as PageComponent }
  }
}

function defineRoute(config: Omit<RouteMeta, 'element'>): RouteMeta {
  return {
    ...config,
    element: lazy(config.lazy),
  }
}

export const appRoutes: RouteMeta[] = [
  defineRoute({
    path: '/',
    label: '主页',
    group: '总览',
    icon: HomeRegular,
    lazy: lazyNamedPage(() => import('@/pages/HomePage'), 'HomePage'),
    showInSidebar: true,
  }),
  defineRoute({
    path: '/studio',
    label: '节点工作台',
    group: '工作流',
    icon: ShareRegular,
    lazy: lazyNamedPage(() => import('@/pages/WorkflowStudioPage'), 'WorkflowStudioPage'),
    showInSidebar: true,
  }),
  defineRoute({
    path: '/weights',
    label: '模型权重管理',
    group: 'SD.cpp 引擎',
    icon: FolderRegular,
    lazy: lazyNamedPage(() => import('@/pages/ModelWeightsPage'), 'ModelWeightsPage'),
    showInSidebar: true,
  }),
  defineRoute({
    path: '/sdcpp',
    label: '引擎管理',
    group: 'SD.cpp 引擎',
    icon: PlugConnectedRegular,
    lazy: lazyNamedPage(() => import('@/pages/SDCppPage'), 'SDCppPage'),
    showInSidebar: true,
  }),
  defineRoute({
    path: '/images',
    label: '生成结果',
    group: 'SD.cpp 引擎',
    icon: GridRegular,
    lazy: lazyNamedPage(() => import('@/pages/GeneratedImagesPage'), 'GeneratedImagesPage'),
    showInSidebar: true,
  }),
  defineRoute({
    path: '/perfect-pixel',
    label: '像素画精修',
    group: '像素工具',
    icon: StarRegular,
    lazy: lazyNamedPage(() => import('@/pages/PerfectPixelPage'), 'PerfectPixelPage'),
    showInSidebar: true,
  }),
  defineRoute({
    path: '/settings',
    label: '设置',
    group: '其他',
    icon: SettingsRegular,
    lazy: lazyNamedPage(() => import('@/pages/SettingsPage'), 'SettingsPage'),
    showInSidebar: true,
  }),
]

export function getSidebarRoutes(): RouteMeta[] {
  return appRoutes.filter((route) => route.showInSidebar)
}

export function groupRoutesByGroup(routes: RouteMeta[]): Array<{ label: string; items: RouteMeta[] }> {
  const groups: Array<{ label: string; items: RouteMeta[] }> = []
  let current: (typeof groups)[number] | null = null

  for (const route of routes) {
    if (!current || current.label !== route.group) {
      current = { label: route.group, items: [] }
      groups.push(current)
    }

    current.items.push(route)
  }

  return groups
}

export const sidebarRouteGroups = groupRoutesByGroup(getSidebarRoutes())
