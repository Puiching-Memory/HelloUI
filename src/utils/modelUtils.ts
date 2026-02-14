import type { DeviceType, ModelGroup } from '../../shared/types'
import { getPathBaseName } from './tauriPath'

/**
 * 获取设备类型的显示标签
 */
export function getDeviceLabel(device: DeviceType): string {
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
