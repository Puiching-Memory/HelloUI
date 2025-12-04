# Electron Preload 脚本配置修复指南

## 问题描述

在使用 Electron + Vite + React 开发时，遇到以下问题：

- `window.ipcRenderer` 在渲染进程中为 `undefined`
- 渲染进程无法与主进程进行 IPC 通信
- 控制台错误：`SyntaxError: Cannot use import statement outside a module`

## 错误信息

```
VM4 sandbox_bundle:2 Unable to load preload script: C:\workspace\github\HelloUI\dist-electron\preload.js
VM4 sandbox_bundle:2 SyntaxError: Cannot use import statement outside a module
```

## 根本原因

构建后的 `dist-electron/preload.js` 文件使用了 ES6 模块语法：

```javascript
import { contextBridge, ipcRenderer } from "electron";
```

但 Electron 的 preload 脚本在沙箱环境中**必须使用 CommonJS 格式**：

```javascript
const { contextBridge, ipcRenderer } = require("electron");
```

## 解决方案

### 1. 修改 `vite.config.ts`

在 `vite-plugin-electron` 的配置中，为 preload 脚本指定 CommonJS 输出格式：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file
        entry: 'electron/main.ts',
        onstart(options: any) {
          options.reload()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: process.env.NODE_ENV === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              external: Object.keys('dependencies' in {} ? {} : {}),
            },
          },
        },
      },
      {
        // Preload script - 关键配置
        entry: 'electron/preload.ts',
        onstart(options: any) {
          options.reload()
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: process.env.NODE_ENV === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'], // Electron 模块保持 external
              output: [
                {
                  format: 'cjs', // 关键：使用 CommonJS 格式
                  entryFileNames: 'preload.js',
                },
              ],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  // ... 其他配置
})
```

### 2. 关键配置说明

#### `format: 'cjs'`
- **作用**：将输出格式设置为 CommonJS
- **位置**：`rollupOptions.output[0].format`
- **必需**：是，这是修复问题的核心配置

#### `external: ['electron']`
- **作用**：将 `electron` 模块标记为外部依赖，不打包进输出文件
- **原因**：`electron` 模块在运行时由 Electron 环境提供，不需要打包

#### `output` 数组格式
- **作用**：明确指定输出配置
- **注意**：必须使用数组格式 `[{ ... }]`，而不是对象格式

### 3. 清理构建文件

修改配置后，需要清理旧的构建文件：

```bash
# Windows PowerShell
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue

# Linux/Mac
rm -rf dist-electron
```

### 4. 重启开发服务器

```bash
pnpm run dev
```

## 验证修复

修复成功后，控制台应该显示：

```
[Preload] 开始初始化 IPC 渲染器...
[Preload] IPC 渲染器已成功暴露到 window.ipcRenderer
[Renderer] 检查 window.ipcRenderer: {on: ƒ, off: ƒ, send: ƒ, invoke: ƒ}
[Renderer] window.ipcRenderer 已可用
```

检查构建后的文件 `dist-electron/preload.js`，应该看到：

```javascript
const { contextBridge, ipcRenderer } = require("electron");
// 而不是
// import { contextBridge, ipcRenderer } from "electron";
```

## 技术背景

### 为什么 Preload 脚本必须使用 CommonJS？

1. **沙箱环境限制**：Electron 的 preload 脚本运行在特殊的沙箱环境中
2. **模块系统**：沙箱环境默认使用 Node.js 的 CommonJS 模块系统
3. **ES6 模块支持**：虽然 Node.js 支持 ES6 模块，但 Electron 的 preload 脚本环境有特殊限制

### Vite 构建配置

- Vite 默认将 TypeScript/JavaScript 文件构建为 ES6 模块
- 需要显式配置 `rollupOptions.output.format` 来改变输出格式
- `vite-plugin-electron` 插件需要正确的配置才能生成 CommonJS 格式的 preload 脚本

## 常见问题

### Q: 为什么主进程不需要这个配置？

A: 主进程（`main.ts`）运行在完整的 Node.js 环境中，支持 ES6 模块（因为 `package.json` 中有 `"type": "module"`）。只有 preload 脚本需要 CommonJS 格式。

### Q: 生产环境也需要这个配置吗？

A: 是的，这个配置在开发和生产环境中都需要。确保 `vite.config.ts` 中的配置同时适用于两种环境。

### Q: 如果仍然看到 `import` 语句怎么办？

A: 
1. 确认配置已保存
2. 清理 `dist-electron` 目录
3. 重启开发服务器
4. 检查 `dist-electron/preload.js` 文件内容

## 相关文件

- `electron/preload.ts` - Preload 脚本源文件
- `electron/main.ts` - 主进程文件
- `vite.config.ts` - Vite 构建配置
- `dist-electron/preload.js` - 构建后的 preload 脚本（应使用 CommonJS）

## 参考资源

- [Electron Preload Scripts 官方文档](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload)
- [Vite Rollup Options](https://vitejs.dev/config/build-options.html#build-rollupoptions)
- [vite-plugin-electron 文档](https://github.com/electron-vite/vite-plugin-electron)

## 总结

修复 Electron preload 脚本问题的核心是：

1. ✅ 在 `vite.config.ts` 中配置 `format: 'cjs'`
2. ✅ 将 `electron` 模块标记为 `external`
3. ✅ 使用数组格式的 `output` 配置
4. ✅ 清理旧的构建文件并重启

这样就能确保 preload 脚本以 CommonJS 格式构建，在 Electron 的沙箱环境中正常运行。

