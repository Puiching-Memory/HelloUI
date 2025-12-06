/**
 * 生成的图片元数据接口
 * 明确区分预览方法（previewMethod）和预览图片（previewImage）
 */

/**
 * 预览方法类型
 */
export type PreviewMethod = 'proj' | 'tae' | 'vae' | 'none';

/**
 * 生成的图片元数据
 */
export interface GeneratedImageMetadata {
  // 基本信息
  name: string;
  path: string;
  size: number;
  modified: number;
  width?: number;
  height?: number;
  
  // 提示词
  prompt?: string;
  negativePrompt?: string;
  
  // 生成参数
  steps?: number;
  cfgScale?: number;
  deviceType?: string;
  
  // 模型信息
  groupId?: string | null;
  groupName?: string | null;
  modelPath?: string;
  vaeModelPath?: string | null;
  llmModelPath?: string | null;
  
  // 采样参数
  samplingMethod?: string | null;
  scheduler?: string | null;
  seed?: number | null;
  batchCount?: number;
  threads?: number | null;
  
  // 预览相关
  preview?: string | null;  // 预览方法（向后兼容，等同于 previewMethod）
  previewMethod?: PreviewMethod | null;  // 预览方法（生成时使用的预览方法）
  previewInterval?: number | null;
  previewImage?: string;  // base64 编码的预览图片（用于在UI中显示）
  
  // 其他选项
  verbose?: boolean;
  color?: boolean;
  offloadToCpu?: boolean;
  
  // 元数据
  commandLine?: string;
  generatedAt?: string;
}

/**
 * 生成的图片对象（包含元数据和预览图片）
 */
export interface GeneratedImage extends GeneratedImageMetadata {
  // previewImage 字段在 GeneratedImage 中是必需的（如果存在）
  // 但在 GeneratedImageMetadata 中是可选的，因为可能因为文件太大而不生成预览
}

