/**
 * 主进程类型定义（前后端共享）
 */

/**
 * 设备类型
 */
export type DeviceType = 'cpu' | 'vulkan' | 'cuda';

/**
 * 权重文件接口
 */
export interface WeightFile {
  name: string;
  size: number;
  path: string;
  modified: number;
}

/**
 * 任务类型
 * @deprecated 'all' 类型已废弃，不再支持。每个模型组必须明确指定其支持的任务类型。
 */
export type TaskType = 'generate' | 'edit' | 'video' | 'all';

/**
 * 模型组接口
 */
export interface ModelGroup {
  id: string;
  name: string;
  taskType?: TaskType;  // 任务类型：generate（图片生成）、edit（图片编辑）、video（视频生成）。注意：'all' 类型已废弃，不再支持。
  sdModel?: string;  // SD/基础模型路径（图片或视频）
  highNoiseSdModel?: string; // 高噪声SD模型路径（视频生成用，可选）
  vaeModel?: string;  // VAE模型路径
  llmModel?: string;  // LLM/CLIP/T5 文本编码器模型路径
  clipLModel?: string;  // CLIP L模型路径（图片编辑任务用，可选）
  t5xxlModel?: string;  // T5XXL模型路径（图片编辑任务用，可选）
  defaultSteps?: number;  // 推荐的默认采样步数
  defaultCfgScale?: number;  // 推荐的默认CFG Scale值
  defaultWidth?: number;  // 推荐的默认图片宽度
  defaultHeight?: number;  // 推荐的默认图片高度
  defaultSamplingMethod?: string;  // 推荐的默认采样方法
  defaultScheduler?: string;  // 推荐的默认调度器
  defaultSeed?: number;  // 推荐的默认种子（-1表示随机）
  createdAt: number;
  updatedAt: number;
}

/**
 * 图片生成参数
 */
export interface GenerateImageParams {
  groupId?: string;  // 使用模型组ID
  modelPath?: string;  // 兼容旧版本：直接使用模型路径
  deviceType: DeviceType;
  prompt: string;
  negativePrompt?: string;
  steps?: number;  // 采样步数，默认 20
  width?: number;  // 图片宽度，默认 512
  height?: number;  // 图片高度，默认 512
  cfgScale?: number;  // CFG scale，默认 7.0
  samplingMethod?: string;  // 采样方法
  scheduler?: string;  // 调度器
  seed?: number;  // 种子，undefined 表示随机
  batchCount?: number;  // 批次数量，默认 1
  threads?: number;  // 线程数，undefined 表示自动
  preview?: string;  // 预览方法
  previewInterval?: number;  // 预览间隔
  verbose?: boolean;  // 详细输出
  color?: boolean;  // 彩色日志
  offloadToCpu?: boolean;  // 卸载到CPU
  diffusionFa?: boolean;  // 启用 diffusion-fa 选项
  controlNetCpu?: boolean;  // 将controlnet保持在CPU（低显存）
  clipOnCpu?: boolean;  // 将clip保持在CPU（低显存）
  vaeOnCpu?: boolean;  // 将VAE保持在CPU（低显存）
  diffusionConvDirect?: boolean;  // 在扩散模型中使用ggml_conv2d_direct
  vaeConvDirect?: boolean;  // 在VAE模型中使用ggml_conv2d_direct
  vaeTiling?: boolean;  // 分块处理VAE以减少内存使用
  inputImage?: string;  // 输入图片路径（用于图片编辑和上采样）
}

/**
 * 生成类型
 */
export type GenerationType = 'generate' | 'edit' | 'video';

/**
 * 媒体类型
 */
export type MediaType = 'image' | 'video';

/**
 * 已生成图片信息
 */
export interface GeneratedImageInfo {
  name: string;
  path: string;
  size: number;
  modified: number;
  width?: number;
  height?: number;
  type?: GenerationType;  // 生成类型：generate（图片生成）、edit（图片编辑）、video（视频生成）
  mediaType?: MediaType;  // 媒体类型：image（图片）、video（视频）
  prompt?: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  deviceType?: string;
  groupId?: string | null;
  groupName?: string | null;
  modelPath?: string;
  vaeModelPath?: string | null;
  llmModelPath?: string | null;
  samplingMethod?: string | null;
  scheduler?: string | null;
  seed?: number | null;
  batchCount?: number;
  threads?: number | null;
  preview?: string | null;
  previewInterval?: number | null;
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
  commandLine?: string;
  generatedAt?: string;
  duration?: number; // 生成耗时（毫秒）
}

