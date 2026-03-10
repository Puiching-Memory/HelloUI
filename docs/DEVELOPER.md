# HelloUI 开发者文档

本文档面向项目维护者与贡献者。

默认用户文档见 `README.md:1`。

## 项目目标

HelloUI 是一个桌面 AI 工作台，目标不是堆更多概念，而是把创作链路里最常用的几个环节放进一个相对稳定的桌面应用里：

- 模型管理
- 引擎管理
- 可视化工作流
- 生成结果归档与回看

核心原则：

- `稳定性优先`：端到端可用，降低环境和目录维护成本
- `纯粹性优先`：功能围绕创作闭环，不做无边界扩张

## 技术栈

- 桌面层：`Tauri 2`
- 前端：`React 19` + `TypeScript` + `Vite`
- UI：`Ant Design 6`
- 路由：`React Router 7`
- 状态管理：`Zustand`
- 后端：`Rust`
- 测试：`Vitest`

## 本地开发

### 环境要求

- `Node.js >= 18`
- `pnpm >= 8`
- `Rust >= 1.77`
- 已安装 Tauri 所需桌面构建依赖

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm run dev
```

### 常用脚本

```bash
pnpm run dev
pnpm run dev:frontend
pnpm run build
pnpm run build:frontend
pnpm run preview
pnpm run typecheck
pnpm run lint
pnpm run lint:fix
pnpm run format
pnpm run format:check
pnpm run test
pnpm run test:watch
pnpm run test:coverage
```

## 项目结构

```text
HelloUI/
├─ src/                     # React 前端
│  ├─ components/           # 通用布局和组件
│  ├─ hooks/                # Zustand store 与交互逻辑
│  ├─ pages/                # 页面入口
│  ├─ theme/                # 主题配置
│  ├─ types/                # 前端类型
│  └─ utils/                # 前端工具函数
├─ src-tauri/               # Tauri / Rust 后端
│  └─ src/
│     ├─ commands/          # Tauri commands
│     ├─ lib.rs             # 插件注册与 invoke handler
│     └─ state.rs           # 全局状态与默认目录
├─ shared/                  # 前后端共享 IPC 与类型
├─ models/                  # 默认模型目录
├─ engines/                 # 默认引擎目录
└─ outputs/                 # 默认输出目录
```

## 前端结构说明

### 路由入口

- `src/App.tsx:1` 负责主题、全局 Provider 和页面路由
- 当前主要页面：
  - `src/pages/HomePage.tsx:1`
  - `src/pages/WorkflowStudioPage.tsx:1`
  - `src/pages/ModelWeightsPage.tsx:1`
  - `src/pages/SDCppPage.tsx:1`
  - `src/pages/GeneratedImagesPage.tsx:1`
  - `src/pages/PerfectPixelPage.tsx:1`
  - `src/pages/SettingsPage.tsx:1`

### 布局

- `src/components/MainLayout.tsx:1` 提供侧边导航与主内容区
- 侧边栏入口与信息架构目前集中定义在该文件内

### 状态管理

- 前端状态主要通过 `Zustand` 管理
- 应优先把跨页面共享的运行状态放进 store，而不是散落在页面内

## 后端结构说明

### 命令注册

- `src-tauri/src/lib.rs:1` 注册所有 Tauri plugins 和 commands
- 当前命令分组包括：
  - `system`
  - `dialog`
  - `weights`
  - `sdcpp`
  - `model_groups`
  - `model_download`
  - `generate`
  - `video_generate`
  - `generated_images`
  - `perfect_pixel`

### 全局状态与默认目录

- `src-tauri/src/state.rs:1` 定义运行期全局状态
- 默认目录策略：
  - `models/`
  - `engines/sdcpp/`
  - `engines/ffmpeg/`
  - `outputs/`

这些目录默认相对于应用运行目录生成。

## 数据约定

- 模型组配置默认保存在 `models/model-groups.json`
- 生成结果默认保存在 `outputs/`
- 结果元数据与媒体文件一起保留，便于回看参数

## 开发建议

- 新功能优先沿现有页面和命令分组扩展，避免新建含义重复的入口
- 先判断功能是否真的服务“创作闭环”，再决定是否加入
- 改动页面时，尽量保持导航和信息结构稳定
- 改动命令时，优先保持前后端 IPC 结构清晰、一致、可回溯
- 文案优先简洁直接，减少术语堆叠

## 文档分工

- `README.md:1`：给用户，默认入口，强调快速上手
- `docs/DEVELOPER.md:1`：给开发者，说明结构、脚本和维护要点

## License

`MIT`
