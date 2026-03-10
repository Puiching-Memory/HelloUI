import { appRoutes, getSidebarRoutes, sidebarRouteGroups } from './routes'

describe('app routes', () => {
  it('uses one manifest for routes and sidebar groups', () => {
    const sidebarPaths = getSidebarRoutes().map((route) => route.path)
    const groupedPaths = sidebarRouteGroups.flatMap((group) => group.items.map((route) => route.path))

    expect(groupedPaths).toEqual(sidebarPaths)
    expect(new Set(appRoutes.map((route) => route.path)).size).toBe(appRoutes.length)
  })

  it('keeps sidebar order stable by group', () => {
    expect(sidebarRouteGroups.map((group) => group.label)).toEqual(['总览', '工作流', 'SD.cpp 引擎', '像素工具', '其他'])
  })
})
