/**
 * 生成的图片元数据接口
 * 明确区分预览方法（previewMethod）和预览图片（previewImage）
 */

/**
 * 预览方法类型
 */
export type PreviewMethod = 'proj' | 'tae' | 'vae' | 'none';

/**
 * 生成类型
 */
export type GenerationType = 'generate' | 'edit' | 'video';

/**
 * 媒体类型
 */
export type MediaType = 'image' | 'video';

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
  
  // 类型信息
  type?: GenerationType;  // 生成类型：generate（图片生成）、edit（图片编辑）、video（视频生成）
  mediaType?: MediaType;  // 媒体类型：image（图片）、video（视频）
  
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
  diffusionFa?: boolean;  // 启用 diffusion-fa 选项
  controlNetCpu?: boolean;  // 将controlnet保持在CPU（低显存）
  clipOnCpu?: boolean;  // 将clip保持在CPU（低显存）
  vaeOnCpu?: boolean;  // 将VAE保持在CPU（低显存）
  diffusionConvDirect?: boolean;  // 在扩散模型中使用ggml_conv2d_direct
  vaeConvDirect?: boolean;  // 在VAE模型中使用ggml_conv2d_direct
  vaeTiling?: boolean;  // 分块处理VAE以减少内存使用
  
  // 元数据
  commandLine?: string;
  generatedAt?: string;
  duration?: number; // 生成耗时（毫秒）
}

/**
 * 生成的图片对象（包含元数据和预览图片）
 */
export interface GeneratedImage extends GeneratedImageMetadata {
  // previewImage 字段在 GeneratedImage 中是必需的（如果存在）
  // 但在 GeneratedImageMetadata 中是可选的，因为可能因为文件太大而不生成预览
}

