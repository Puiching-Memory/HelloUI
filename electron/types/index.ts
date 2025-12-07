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
 * 模型组接口
 */
export interface ModelGroup {
  id: string;
  name: string;
  sdModel?: string;  // SD模型路径
  vaeModel?: string;  // VAE模型路径
  llmModel?: string;  // LLM/CLIP模型路径
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
}

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
  commandLine?: string;
  generatedAt?: string;
}

