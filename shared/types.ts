/**
 * 前后端共享类型定义
 */

// ─── 基础类型 ───────────────────────────────────────────────────────────

/**
 * 设备类型
 */
export type DeviceType = 'cpu' | 'vulkan' | 'cuda'

/**
 * 任务类型
 */
export type TaskType = 'generate' | 'edit' | 'video' | 'upscale'

/**
 * 生成类型
 */
export type GenerationType = 'generate' | 'edit' | 'video'

/**
 * 媒体类型
 */
export type MediaType = 'image' | 'video'

/**
 * 预览方法类型
 */
export type PreviewMethod = 'proj' | 'tae' | 'vae' | 'none'

// ─── 权重文件 ───────────────────────────────────────────────────────────

/**
 * 权重文件接口
 */
export interface WeightFile {
  name: string
  size: number
  path: string
  modified: number
}

// ─── 模型组 ─────────────────────────────────────────────────────────────

/**
 * 模型组接口
 */
export interface ModelGroup {
  id: string
  name: string
  taskType?: TaskType // 任务类型：generate（图片生成）、edit（图片编辑）、video（视频生成）、upscale（图像超分辨率）
  sdModel?: string // SD/基础模型路径（图片或视频）
  diffusionModel?: string // 独立扩散模型路径（如 Z-Image，使用 --diffusion-model 而非 -m）
  highNoiseSdModel?: string // 高噪声SD模型路径（视频生成用，可选）
  vaeModel?: string // VAE模型路径
  llmModel?: string // LLM/CLIP/T5 文本编码器模型路径
  clipLModel?: string // CLIP L模型路径（图片编辑任务用，可选）
  t5xxlModel?: string // T5XXL模型路径（图片编辑任务用，可选）
  clipVisionModel?: string // CLIP Vision模型路径（视频生成 I2V/FLF2V 用，可选）
  hfFiles?: HfFileRef[] // HuggingFace 待下载文件列表（预定义）
  defaultSteps?: number // 推荐的默认采样步数
  defaultCfgScale?: number // 推荐的默认CFG Scale值
  defaultWidth?: number // 推荐的默认图片宽度
  defaultHeight?: number // 推荐的默认图片高度
  defaultSamplingMethod?: string // 推荐的默认采样方法
  defaultScheduler?: string // 推荐的默认调度器
  defaultSeed?: number // 推荐的默认种子（-1表示随机）
  // 视频生成特有默认参数（Wan2.2等）
  defaultFlowShift?: number
  defaultHighNoiseSteps?: number
  defaultHighNoiseCfgScale?: number
  defaultHighNoiseSamplingMethod?: string
  createdAt: number
  updatedAt: number
}

// ─── 生成参数 ───────────────────────────────────────────────────────────

/**
 * 图片生成参数
 */
export interface GenerateImageParams {
  groupId?: string // 使用模型组ID
  sdModel?: string
  diffusionModel?: string // 独立扩散模型路径（如 Z-Image）
  vaeModel?: string
  llmModel?: string
  clipLModel?: string
  t5xxlModel?: string
  deviceType: DeviceType
  prompt: string
  negativePrompt?: string
  steps?: number // 采样步数，默认 20
  width?: number // 图片宽度，默认 512
  height?: number // 图片高度，默认 512
  cfgScale?: number // CFG scale，默认 7.0
  samplingMethod?: string // 采样方法
  scheduler?: string // 调度器
  seed?: number // 种子，undefined 表示随机
  batchCount?: number // 批次数量，默认 1
  threads?: number // 线程数，undefined 表示自动
  preview?: string // 预览方法
  previewInterval?: number // 预览间隔
  verbose?: boolean // 详细输出
  color?: boolean // 彩色日志
  offloadToCpu?: boolean // 卸载到CPU
  diffusionFa?: boolean // 启用 diffusion-fa 选项
  controlNetCpu?: boolean // 将controlnet保持在CPU（低显存）
  clipOnCpu?: boolean // 将clip保持在CPU（低显存）
  vaeOnCpu?: boolean // 将VAE保持在CPU（低显存）
  diffusionConvDirect?: boolean // 在扩散模型中使用ggml_conv2d_direct
  vaeConvDirect?: boolean // 在VAE模型中使用ggml_conv2d_direct
  vaeTiling?: boolean // 分块处理VAE以减少内存使用
  inputImage?: string // 输入图片路径（用于图片编辑和上采样）
  mode?: string // 生成模式（如 text2video, image2video）
  initImage?: string // 初始图片路径（用于视频生成等）
  // 视频/图片生成特有参数（Wan2.2, Qwen2511等）
  flowShift?: number
  qwenImageZeroCondT?: boolean
  highNoiseSteps?: number
  highNoiseCfgScale?: number
  highNoiseSamplingMethod?: string
}

// ─── 生成结果 ───────────────────────────────────────────────────────────

/**
 * 已生成图片/视频的元数据
 */
export interface GeneratedImageInfo {
  // 基本信息
  name: string
  path: string
  size: number
  modified: number
  width?: number
  height?: number

  // 类型信息
  type?: GenerationType // 生成类型
  mediaType?: MediaType // 媒体类型

  // 提示词
  prompt?: string
  negativePrompt?: string

  // 生成参数
  steps?: number
  cfgScale?: number
  deviceType?: string

  // 模型信息
  groupId?: string | null
  groupName?: string | null
  modelPath?: string
  vaeModelPath?: string | null
  llmModelPath?: string | null

  // 采样参数
  samplingMethod?: string | null
  scheduler?: string | null
  seed?: number | null
  batchCount?: number
  threads?: number | null

  // 预览相关
  preview?: string | null // 预览方法（向后兼容）
  previewMethod?: PreviewMethod | null // 预览方法
  previewInterval?: number | null
  previewImage?: string // base64 编码的预览图片

  // 其他选项
  verbose?: boolean
  color?: boolean
  offloadToCpu?: boolean
  diffusionFa?: boolean
  controlNetCpu?: boolean
  clipOnCpu?: boolean
  vaeOnCpu?: boolean
  diffusionConvDirect?: boolean
  vaeConvDirect?: boolean
  vaeTiling?: boolean

  // 元数据
  commandLine?: string
  generatedAt?: string
  duration?: number // 生成耗时（毫秒）
}

/**
 * 生成的图片对象（包含元数据和预览图片），用于前端显示
 */
export interface GeneratedImage extends GeneratedImageInfo {}

// ─── SD.cpp 引擎下载 ────────────────────────────────────────────────────

/**
 * 镜像源类型
 */
export type MirrorType = 'github' | 'proxy'

/**
 * 镜像源配置
 */
export interface MirrorSource {
  id: string
  name: string
  type: MirrorType
  /** proxy 类型: 前缀式代理 URL, 如 "https://ghfast.top" */
  url: string
  /** 是否也代理 API 请求 */
  proxyApi: boolean
  /** 是否为内置镜像（不可删除） */
  builtin: boolean
}

/**
 * GitHub Release 资产信息
 */
export interface SDCppReleaseAsset {
  name: string
  size: number
  downloadUrl: string
  /** 资产对应的设备类型 */
  deviceType: DeviceType | 'cudart' | 'unknown'
  /** CPU 子变体 */
  cpuVariant?: 'avx' | 'avx2' | 'avx512' | 'noavx'
}

/**
 * GitHub Release 信息
 */
export interface SDCppRelease {
  tagName: string
  name: string
  publishedAt: string
  assets: SDCppReleaseAsset[]
}

/**
 * 引擎下载进度
 */
export interface SDCppDownloadProgress {
  /** 当前阶段: downloading / extracting / done / error */
  stage: 'downloading' | 'extracting' | 'done' | 'error'
  /** 已下载字节数 */
  downloadedBytes: number
  /** 总字节数 */
  totalBytes: number
  /** 下载速度 bytes/s */
  speed: number
  /** 当前下载的文件名 */
  fileName: string
  /** 错误信息 */
  error?: string
}

/**
 * 镜像测速结果
 */
export interface MirrorTestResult {
  mirrorId: string
  latency: number | null
  success: boolean
  error?: string
}

// ─── HuggingFace 模型下载 ────────────────────────────────────────────────

/**
 * HuggingFace 镜像源
 */
export type HfMirrorId = 'huggingface' | 'hf-mirror'

/**
 * HuggingFace 镜像源配置
 */
export interface HfMirror {
  id: HfMirrorId
  name: string
  baseUrl: string
}

/**
 * HuggingFace 文件引用 — 模型组中预定义的待下载文件
 */
export interface HfFileRef {
  /** HuggingFace 仓库 ID，如 "user/repo" */
  repo: string
  /** 文件在仓库中的路径，如 "model.safetensors" */
  file: string
  /** 下载后保存到模型组子文件夹中的相对路径（可选，默认同 file） */
  savePath?: string
}

/**
 * 模型文件下载进度
 */
export interface ModelDownloadProgress {
  /** 当前阶段 */
  stage: 'downloading' | 'done' | 'error'
  /** 已下载字节数 */
  downloadedBytes: number
  /** 总字节数（-1 表示未知） */
  totalBytes: number
  /** 下载速度 bytes/s */
  speed: number
  /** 当前下载的文件名 */
  fileName: string
  /** 总文件数 */
  totalFiles: number
  /** 当前正在下载的文件序号 (1-based) */
  currentFileIndex: number
  /** 错误信息 */
  error?: string
}
