/**
 * IPC 通信类型定义（前后端共享）
 */

import type { DeviceType, ModelGroup, WeightFile, GenerateImageParams, GeneratedImageInfo } from './models';

// 重新导出主进程类型，供渲染进程使用
export type { DeviceType, ModelGroup, WeightFile, GenerateImageParams, GeneratedImageInfo };

/**
 * IPC 通道名称类型定义
 */
export type IPCChannel = 
  // 权重管理
  | 'weights:init-default-folder'
  | 'weights:check-folder'
  | 'weights:set-folder'
  | 'weights:get-folder'
  | 'weights:list-files'
  | 'weights:select-file'
  | 'weights:upload-file'
  | 'weights:cancel-upload'
  | 'weights:download-file'
  | 'weights:delete-file'
  | 'weights:upload-progress'
  // SD.cpp 引擎
  | 'sdcpp:init-default-folder'
  | 'sdcpp:get-folder'
  | 'sdcpp:set-device'
  | 'sdcpp:get-device'
  | 'sdcpp:list-files'
  | 'sdcpp:download-file'
  | 'sdcpp:delete-file'
  // 模型组管理
  | 'model-groups:list'
  | 'model-groups:create'
  | 'model-groups:update'
  | 'model-groups:delete'
  | 'model-groups:get'
  // 图片生成
  | 'generate:start'
  | 'generate:progress'
  | 'generate:cli-output'
  | 'generate:preview-update'
  // 已生成图片
  | 'generated-images:list'
  | 'generated-images:download'
  | 'generated-images:delete'
  | 'generated-images:get-preview'
  | 'generated-images:batch-download';

/**
 * IPC 请求/响应类型映射
 */
export interface IPCRequestMap {
  'weights:init-default-folder': { request: void; response: string };
  'weights:check-folder': { request: string; response: boolean };
  'weights:set-folder': { request: string; response: boolean };
  'weights:get-folder': { request: void; response: string | null };
  'weights:list-files': { request: string; response: WeightFile[] };
  'weights:select-file': { request: void; response: string | null };
  'weights:upload-file': { request: { sourcePath: string; targetFolder: string }; response: { success: boolean; targetPath?: string; skipped?: boolean; reason?: string; existingFile?: string; message?: string; cancelled?: boolean } };
  'weights:cancel-upload': { request: void; response: { success: boolean; message?: string } };
  'weights:download-file': { request: string; response: boolean };
  'weights:delete-file': { request: string; response: boolean };
  'sdcpp:init-default-folder': { request: void; response: string };
  'sdcpp:get-folder': { request: void; response: string | null };
  'sdcpp:set-device': { request: DeviceType; response: boolean };
  'sdcpp:get-device': { request: void; response: DeviceType };
  'sdcpp:list-files': { request: { folder: string; deviceType: DeviceType }; response: WeightFile[] };
  'sdcpp:download-file': { request: string; response: boolean };
  'sdcpp:delete-file': { request: string; response: boolean };
  'model-groups:list': { request: void; response: ModelGroup[] };
  'model-groups:create': { request: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>; response: ModelGroup };
  'model-groups:update': { request: { id: string; updates: Partial<Omit<ModelGroup, 'id' | 'createdAt'>> }; response: ModelGroup };
  'model-groups:delete': { request: string; response: boolean };
  'model-groups:get': { request: string; response: ModelGroup | null };
  'generate:start': { request: GenerateImageParams; response: { success: boolean; image?: string; imagePath?: string } };
  'generated-images:list': { request: void; response: GeneratedImageInfo[] };
  'generated-images:download': { request: string; response: boolean };
  'generated-images:delete': { request: string; response: boolean };
  'generated-images:get-preview': { request: string; response: string };
  'generated-images:batch-download': { request: string[]; response: { success: boolean; zipPath?: string; size?: number; canceled?: boolean } };
}

/**
 * IPC 事件类型映射
 */
export interface IPCEventMap {
  'weights:upload-progress': { progress: number; copied: number; total: number; fileName: string };
  'generate:progress': { progress: string | number; image?: string };
  'generate:cli-output': { type: 'stdout' | 'stderr'; text: string };
  'generate:preview-update': { previewImage: string };
}

