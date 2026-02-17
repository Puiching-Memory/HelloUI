import type { DeviceType, CpuVariant, ModelGroup, AvailableEngine } from '../../shared/types'
import { getPathBaseName } from './tauriPath'

/**
 * 获取设备类型的显示标签
 */
export function getDeviceLabel(device: DeviceType, cpuVariant?: CpuVariant): string {
  if (device === 'cpu' && cpuVariant) {
    switch (cpuVariant) {
      case 'avx2':
        return 'CPU (AVX2)'
      case 'avx512':
        return 'CPU (AVX-512)'
      case 'avx':
        return 'CPU (AVX)'
      case 'noavx':
        return 'CPU (无AVX)'
      default:
        return 'CPU'
    }
  }
  switch (device) {
    case 'cpu':
      return 'CPU'
    case 'vulkan':
      return 'Vulkan'
    case 'cuda':
      return 'CUDA'
    case 'rocm':
      return 'ROCm'
    default:
      return device
  }
}

/**
 * 获取引擎的唯一标识符（用于下拉菜单选项值）
 */
export function getEngineValue(engine: AvailableEngine): string {
  if (engine.deviceType === 'cpu' && engine.cpuVariant) {
    return `cpu-${engine.cpuVariant}`
  }
  return engine.deviceType
}

/**
 * 获取模型组的简要信息描述
 */
export function getModelInfo(group: ModelGroup | undefined): string {
  if (!group) return ''
  const parts: string[] = []
  if (group.sdModel) parts.push(`SD: ${getPathBaseName(group.sdModel, group.sdModel)}`)
  if (group.diffusionModel) parts.push(`Diffusion: ${getPathBaseName(group.diffusionModel, group.diffusionModel)}`)
  if (group.vaeModel) parts.push(`VAE: ${getPathBaseName(group.vaeModel, group.vaeModel)}`)
  if (group.llmModel) parts.push(`LLM: ${getPathBaseName(group.llmModel, group.llmModel)}`)
  if (group.clipVisionModel) parts.push(`CLIP: ${getPathBaseName(group.clipVisionModel, group.clipVisionModel)}`)
  return parts.join(' | ')
}

/**
 * 默认负面提示词（图片生成/编辑用）
 */
export const DEFAULT_NEGATIVE_PROMPT =
  '低质量, 最差质量, 模糊, 低分辨率, 手部错误, 脚部错误, 比例错误, 多余肢体, 缺失肢体, 水印'
