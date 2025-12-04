# HelloUI

一个基于 Electron + React 19 + TypeScript + Vite 的桌面应用程序。

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **React 19** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速的前端构建工具
- **Fluent UI React** - WinUI 3 风格的 UI 组件库

## 开始使用

### 安装依赖

使用 pnpm 安装项目依赖：

```bash
# 安装 pnpm（如果未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 开发模式

运行开发服务器和 Electron 应用：

```bash
pnpm run dev
```

这将启动 Vite 开发服务器，并自动打开 Electron 窗口。

### 构建应用

构建生产版本：

```bash
pnpm run build
```

构建 Electron 可执行文件：

```bash
pnpm run build:electron
```

构建产物将输出到 `release` 目录。

## 项目结构

```
.
├── electron/          # Electron 主进程和预加载脚本
│   ├── main.ts       # 主进程入口
│   └── preload.ts    # 预加载脚本
├── src/              # React 应用源代码
│   ├── App.tsx       # 主应用组件（包含 Fluent UI 主题提供者和路由）
│   ├── main.tsx      # React 入口文件
│   ├── components/   # 通用 React 组件
│   │   └── MainLayout.tsx  # 主布局组件（包含左侧导航栏）
│   ├── pages/        # 页面组件
│   │   ├── HomePage.tsx      # 主页
│   │   ├── ComponentsPage.tsx # 组件展示页面
│   │   └── SettingsPage.tsx  # 设置页面
│   └── ...
├── dist/             # Vite 构建输出（渲染进程）
├── dist-electron/    # Electron 构建输出（主进程）
└── release/          # 打包后的可执行文件
```

## UI 组件库

本项目集成了 **Fluent UI React** (@fluentui/react-components)，这是微软官方的 Fluent Design System React 实现，提供与 WinUI 3 一致的 UI 组件和设计语言。

### 已集成的组件示例

- ✅ 按钮（Button）- 支持多种外观样式
- ✅ 卡片（Card）- 内容容器组件
- ✅ 输入框（Input）- 文本输入控件
- ✅ 下拉选择（Dropdown）- 选择控件
- ✅ 复选框（Checkbox）- 选择控件
- ✅ 开关（Switch）- 开关控件
- ✅ 单选按钮（Radio）- 单选控件
- ✅ 进度条（ProgressBar）- 进度显示
- ✅ 滑块（Slider）- 数值选择控件

### 主题支持

应用会自动检测系统主题偏好（浅色/深色模式）并应用相应的 Fluent UI 主题。

### 查看组件文档

更多组件和用法请参考：
- [Fluent UI React 官方文档](https://react.fluentui.dev/)
- [组件库说明文档](./WINUI_COMPONENTS.md)

## 应用结构

应用采用左侧导航栏 + 主内容区的布局设计：

- **左侧导航栏**：提供快速页面切换功能
  - 主页：应用首页
  - 组件展示：查看所有 WinUI 3 风格组件
  - 设置：应用设置和配置

- **主内容区**：根据选中的导航项动态显示对应页面

## 开发说明

- 主进程代码位于 `electron/` 目录
- 渲染进程（React 应用）代码位于 `src/` 目录
- 布局组件位于 `src/components/` 目录
- 页面组件位于 `src/pages/` 目录
- 修改代码后，Vite 会自动热重载渲染进程
- Electron 主进程修改后需要重启应用

## 故障排除

如果遇到 Electron preload 脚本相关的问题，请参考 [Electron Preload 脚本配置修复指南](./docs/ELECTRON_PRELOAD_FIX.md)。

## 许可证

MIT
