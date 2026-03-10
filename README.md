# HelloUI

> 一个尽量不打扰创作的桌面 AI 工作台。

HelloUI 关心两件事：`稳定` 和 `纯粹`。

- 稳定：从打开应用到拿到结果，尽量少折腾环境、路径和流程
- 纯粹：功能只服务创作闭环，不把工具本身变成负担

如果你只是想直接开始使用，**不需要了解 `pnpm`，也不需要自己跑开发环境**。

## 下载

请直接前往 GitHub Releases 下载：

- 最新版本：`https://github.com/Puiching-Memory/HelloUI/releases/latest`
- 所有版本：`https://github.com/Puiching-Memory/HelloUI/releases`

下载对应你系统的安装包或压缩包，安装后直接打开即可。

## 你可以用它做什么

- 管理模型权重和 `SD.cpp` 引擎
- 用节点工作台组织生成流程
- 浏览、导出和清理生成结果
- 在同一个应用里完成从准备到产出的基本闭环

## 三步开始使用

1. 打开 `引擎管理`，准备 `SD.cpp`
2. 打开 `模型权重管理`，设置模型目录或导入模型组
3. 打开 `节点工作台`，开始组织你的生成流程

## 常用页面

- `首页`：看总览和最近结果
- `节点工作台`：搭工作流
- `模型权重管理`：管模型和模型组
- `引擎管理`：管引擎和运行资源
- `生成结果`：看图、导出、删除
- `Perfect Pixel`：做图像精修

## 默认目录

应用默认会在运行目录下使用这些路径：

- `models/`：模型与 `model-groups.json`
- `engines/sdcpp/`：`SD.cpp` 引擎
- `engines/ffmpeg/`：视频相关资源
- `outputs/`：生成结果与元数据

## 给开发者

如果你是开发者，项目结构和本地开发说明见 `docs/DEVELOPER.md:1`。

## License

`MIT`
