import type { ReactNode } from 'react'
import {
  ArrowDownloadRegular,
  CheckmarkCircleFilled,
  EditRegular,
  ImageAddRegular,
  PlugConnectedRegular,
  SettingsRegular,
  StarRegular,
  TopSpeedRegular,
  VideoClipRegular,
  ZoomInRegular,
} from '@/ui/icons'
import type { MediaFormat, WorkflowNodeStatus, WorkflowNodeType } from '@/features/workflow-studio/types'

export const nodeTypeIcon: Record<WorkflowNodeType, ReactNode> = {
  checkpoint: <ArrowDownloadRegular />,
  lora: <StarRegular />,
  prompt: <EditRegular />,
  imageInput: <ImageAddRegular />,
  generate: <TopSpeedRegular />,
  videoGen: <VideoClipRegular />,
  upscale: <ZoomInRegular />,
  controlNet: <PlugConnectedRegular />,
  output: <CheckmarkCircleFilled />,
  performance: <SettingsRegular />,
}

export const statusText: Record<WorkflowNodeStatus, string> = {
  ready: '就绪',
  running: '运行中',
  idle: '待配置',
}

export const nodeTypeColor: Record<WorkflowNodeType, string> = {
  checkpoint: 'var(--app-node-checkpoint)',
  lora: 'var(--app-node-lora)',
  prompt: 'var(--app-node-prompt)',
  imageInput: 'var(--app-node-image-input)',
  generate: 'var(--app-node-generate)',
  videoGen: 'var(--app-node-video-gen)',
  upscale: 'var(--app-node-upscale)',
  controlNet: 'var(--app-node-control-net)',
  output: 'var(--app-node-output)',
  performance: 'var(--app-node-performance)',
}

export const mediaFormatLabel: Record<MediaFormat, string> = {
  model: 'MODEL',
  prompt: 'PROMPT',
  image: 'IMAGE',
  control: 'CTRL',
  result: 'RESULT',
  config: 'CONFIG',
}

export const mediaFormatColor: Record<MediaFormat, string> = {
  model: 'var(--app-media-model)',
  prompt: 'var(--app-media-prompt)',
  image: 'var(--app-media-image)',
  control: 'var(--app-media-control)',
  result: 'var(--app-media-result)',
  config: 'var(--app-media-config)',
}
