export type WorkflowNodeType =
  | 'checkpoint'
  | 'lora'
  | 'prompt'
  | 'imageInput'
  | 'generate'
  | 'videoGen'
  | 'upscale'
  | 'controlNet'
  | 'output'
  | 'performance'

export type MediaFormat = 'model' | 'prompt' | 'image' | 'control' | 'result' | 'config'

export type WorkflowNodeStatus = 'ready' | 'running' | 'idle'

export type WorkflowNodeConfig = {
  modelPath?: string
  diffusionModel?: string
  vaePath?: string
  clipL?: string
  clipG?: string
  t5xxl?: string
  weightType?: string
  loraModelDir?: string
  prompt?: string
  negativePrompt?: string
  clipSkip?: number
  initImage?: string
  maskImage?: string
  strength?: number
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  seed?: number
  samplingMethod?: string
  scheduler?: string
  batchCount?: number
  guidance?: number
  videoFrames?: number
  fps?: number
  upscaleModel?: string
  upscaleRepeats?: number
  upscaleTileSize?: number
  controlNetPath?: string
  controlImage?: string
  controlStrength?: number
  outputPath?: string
  previewPath?: string
  threads?: number
  vaeTiling?: boolean
  offloadToCpu?: boolean
  flashAttention?: boolean
}

export type WorkflowNode = {
  id: string
  title: string
  type: WorkflowNodeType
  x: number
  y: number
  description: string
  config: WorkflowNodeConfig
}

export type WorkflowEdge = {
  from: string
  to: string
}

export type WorkflowDocument = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowLoadResult = WorkflowDocument & {
  restored: boolean
}

export type NodeValidation = {
  ready: boolean
  issues: string[]
}

export type NodeTemplate = {
  type: WorkflowNodeType
  title: string
  description: string
  config: WorkflowNodeConfig
}

export type InspectorDraft = {
  title: string
  description: string
  modelPath: string
  diffusionModel: string
  vaePath: string
  clipL: string
  clipG: string
  t5xxl: string
  weightType: string
  loraModelDir: string
  prompt: string
  negativePrompt: string
  clipSkip: string
  initImage: string
  maskImage: string
  strength: string
  width: string
  height: string
  steps: string
  cfgScale: string
  seed: string
  samplingMethod: string
  scheduler: string
  batchCount: string
  guidance: string
  videoFrames: string
  fps: string
  upscaleModel: string
  upscaleRepeats: string
  upscaleTileSize: string
  controlNetPath: string
  controlImage: string
  controlStrength: string
  outputPath: string
  previewPath: string
  threads: string
  vaeTiling: boolean
  offloadToCpu: boolean
  flashAttention: boolean
}
