import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { Button, Input, Select, Switch, Tag, Tooltip } from 'antd'
import {
  ArrowRightRegular,
  ArrowDownloadRegular,
  CheckmarkCircleFilled,
  ChevronLeftRegular,
  ChevronRightRegular,
  CopyRegular,
  DeleteRegular,
  EditRegular,
  GridRegular,
  ImageAddRegular,
  PlugConnectedRegular,
  SearchRegular,
  SettingsRegular,
  StarRegular,
  TopSpeedRegular,
  VideoClipRegular,
  ZoomInRegular,
} from '@/ui/icons'
import './WorkflowStudioPage.css'

type WorkflowNodeType =
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

type MediaFormat = 'model' | 'prompt' | 'image' | 'control' | 'result' | 'config'

type WorkflowNodeStatus = 'ready' | 'running' | 'idle'

type WorkflowNodeConfig = {
  // Checkpoint —— --model, --diffusion-model, --vae, --clip_l/g, --t5xxl, --type
  modelPath?: string
  diffusionModel?: string
  vaePath?: string
  clipL?: string
  clipG?: string
  t5xxl?: string
  weightType?: string
  // LoRA —— --lora-model-dir
  loraModelDir?: string
  // Prompt —— --prompt, --negative-prompt, --clip-skip
  prompt?: string
  negativePrompt?: string
  clipSkip?: number
  // Image Input —— --init-img, --mask, --strength
  initImage?: string
  maskImage?: string
  strength?: number
  // Generation —— --width, --height, --steps, --cfg-scale, --seed, --sampling-method, --scheduler, --batch-count, --guidance
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  seed?: number
  samplingMethod?: string
  scheduler?: string
  batchCount?: number
  guidance?: number
  // Video —— --video-frames, --fps
  videoFrames?: number
  fps?: number
  // Upscale —— --upscale-model, --upscale-repeats, --upscale-tile-size
  upscaleModel?: string
  upscaleRepeats?: number
  upscaleTileSize?: number
  // ControlNet —— --control-net, --control-image, --control-strength
  controlNetPath?: string
  controlImage?: string
  controlStrength?: number
  // Output —— --output, --preview-path
  outputPath?: string
  previewPath?: string
  // Performance —— --threads, --vae-tiling, --offload-to-cpu, --fa
  threads?: number
  vaeTiling?: boolean
  offloadToCpu?: boolean
  flashAttention?: boolean
}

type WorkflowNode = {
  id: string
  title: string
  type: WorkflowNodeType
  x: number
  y: number
  description: string
  config: WorkflowNodeConfig
}

type WorkflowEdge = {
  from: string
  to: string
}

type WorkflowDocument = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

type WorkflowLoadResult = WorkflowDocument & {
  restored: boolean
}

type NodeValidation = {
  ready: boolean
  issues: string[]
}

type NodeTemplate = {
  type: WorkflowNodeType
  title: string
  description: string
  config: WorkflowNodeConfig
}

type InspectorDraft = {
  title: string
  description: string
  // Checkpoint
  modelPath: string
  diffusionModel: string
  vaePath: string
  clipL: string
  clipG: string
  t5xxl: string
  weightType: string
  // LoRA
  loraModelDir: string
  // Prompt
  prompt: string
  negativePrompt: string
  clipSkip: string
  // Image Input
  initImage: string
  maskImage: string
  strength: string
  // Generation
  width: string
  height: string
  steps: string
  cfgScale: string
  seed: string
  samplingMethod: string
  scheduler: string
  batchCount: string
  guidance: string
  // Video
  videoFrames: string
  fps: string
  // Upscale
  upscaleModel: string
  upscaleRepeats: string
  upscaleTileSize: string
  // ControlNet
  controlNetPath: string
  controlImage: string
  controlStrength: string
  // Output
  outputPath: string
  previewPath: string
  // Performance
  threads: string
  vaeTiling: boolean
  offloadToCpu: boolean
  flashAttention: boolean
}

const STORAGE_KEY = 'hello-ui-workflow-studio-v1'
const NODE_WIDTH = 228
const NODE_HEIGHT = 132
const WORLD_MIN = -2400
const WORLD_MAX = 3200
const TEMPLATE_DRAG_MIME = 'application/x-hello-ui-node-template'
const ZOOM_MIN = 0.25
const ZOOM_MAX = 2.0
const ZOOM_STEP = 0.1

const EMPTY_DRAFT: InspectorDraft = {
  title: '',
  description: '',
  modelPath: '',
  diffusionModel: '',
  vaePath: '',
  clipL: '',
  clipG: '',
  t5xxl: '',
  weightType: '',
  loraModelDir: '',
  prompt: '',
  negativePrompt: '',
  clipSkip: '',
  initImage: '',
  maskImage: '',
  strength: '0.75',
  width: '512',
  height: '512',
  steps: '20',
  cfgScale: '7',
  seed: '',
  samplingMethod: 'euler_a',
  scheduler: 'discrete',
  batchCount: '1',
  guidance: '3.5',
  videoFrames: '25',
  fps: '8',
  upscaleModel: '',
  upscaleRepeats: '1',
  upscaleTileSize: '128',
  controlNetPath: '',
  controlImage: '',
  controlStrength: '0.9',
  outputPath: '',
  previewPath: '',
  threads: '',
  vaeTiling: false,
  offloadToCpu: false,
  flashAttention: false,
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'checkpoint',
    title: '模型加载',
    description: '加载 Stable Diffusion 模型权重文件。',
    config: { modelPath: '' },
  },
  {
    type: 'lora',
    title: 'LoRA',
    description: '指定 LoRA 模型目录，应用微调权重。',
    config: { loraModelDir: '' },
  },
  {
    type: 'prompt',
    title: '提示词',
    description: '配置正向和反向提示词。',
    config: { prompt: '', negativePrompt: '' },
  },
  {
    type: 'imageInput',
    title: '图像输入',
    description: '加载初始图像或遮罩，用于图生图。',
    config: { initImage: '', strength: 0.75 },
  },
  {
    type: 'generate',
    title: '图像生成',
    description: '配置采样参数并执行文生图或图生图。',
    config: { width: 512, height: 512, steps: 20, cfgScale: 7, seed: -1, samplingMethod: 'euler_a', scheduler: 'discrete', batchCount: 1 },
  },
  {
    type: 'videoGen',
    title: '视频生成',
    description: '从图像生成短视频片段。',
    config: { videoFrames: 25, fps: 8, steps: 20, cfgScale: 7, samplingMethod: 'euler', scheduler: 'discrete' },
  },
  {
    type: 'upscale',
    title: '图像放大',
    description: '使用 ESRGAN 模型放大图像分辨率。',
    config: { upscaleModel: '', upscaleRepeats: 1, upscaleTileSize: 128 },
  },
  {
    type: 'controlNet',
    title: 'ControlNet',
    description: '使用 ControlNet 控制生成结构。',
    config: { controlNetPath: '', controlImage: '', controlStrength: 0.9 },
  },
  {
    type: 'output',
    title: '输出保存',
    description: '设置输出文件路径和预览路径。',
    config: { outputPath: './output.png' },
  },
  {
    type: 'performance',
    title: '性能设置',
    description: '配置线程数、显存优化和加速选项。',
    config: { threads: -1, vaeTiling: false, offloadToCpu: false, flashAttention: false },
  },
]

const templateMap = Object.fromEntries(nodeTemplates.map((template) => [template.type, template])) as Record<
  WorkflowNodeType,
  NodeTemplate
>

const nodeTypeLabel: Record<WorkflowNodeType, string> = {
  checkpoint: '模型加载',
  lora: 'LoRA',
  prompt: '提示词',
  imageInput: '图像输入',
  generate: '图像生成',
  videoGen: '视频生成',
  upscale: '图像放大',
  controlNet: 'ControlNet',
  output: '输出保存',
  performance: '性能设置',
}

const nodeTypeIcon: Record<WorkflowNodeType, ReactNode> = {
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

const statusText: Record<WorkflowNodeStatus, string> = {
  ready: '就绪',
  running: '运行中',
  idle: '待配置',
}

const nodeTypeColor: Record<WorkflowNodeType, string> = {
  checkpoint: '#5B61B4',
  lora: '#7E57C2',
  prompt: '#43A047',
  imageInput: '#00897B',
  generate: '#E65100',
  videoGen: '#AD1457',
  upscale: '#2E7D32',
  controlNet: '#6A1B9A',
  output: '#00695C',
  performance: '#546E7A',
}

const mediaFormatLabel: Record<MediaFormat, string> = {
  model: 'MODEL',
  prompt: 'PROMPT',
  image: 'IMAGE',
  control: 'CTRL',
  result: 'RESULT',
  config: 'CONFIG',
}

const mediaFormatColor: Record<MediaFormat, string> = {
  model: '#B39DDB',
  prompt: '#A5D6A7',
  image: '#80CBC4',
  control: '#FFCC80',
  result: '#90CAF9',
  config: '#BDBDBD',
}

const nodeIOMap: Record<WorkflowNodeType, { inputs: MediaFormat[]; outputs: MediaFormat[] }> = {
  checkpoint: { inputs: [], outputs: ['model'] },
  lora: { inputs: ['model'], outputs: ['model'] },
  prompt: { inputs: [], outputs: ['prompt'] },
  imageInput: { inputs: [], outputs: ['image'] },
  generate: { inputs: ['model', 'prompt', 'image', 'control', 'config'], outputs: ['result'] },
  videoGen: { inputs: ['model', 'prompt', 'image', 'config'], outputs: ['result'] },
  upscale: { inputs: ['image', 'config'], outputs: ['result'] },
  controlNet: { inputs: ['image'], outputs: ['control'] },
  output: { inputs: ['result'], outputs: [] },
  performance: { inputs: [], outputs: ['config'] },
}

const validNodeTypes = new Set<WorkflowNodeType>([
  'checkpoint',
  'lora',
  'prompt',
  'imageInput',
  'generate',
  'videoGen',
  'upscale',
  'controlNet',
  'output',
  'performance',
])

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const shortText = (value: string | undefined, max = 32) => {
  if (!value) return '未填写'
  return value.length > max ? `${value.slice(0, max)}…` : value
}

const parseOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

const createNodeFromTemplate = (
  id: string,
  type: WorkflowNodeType,
  x: number,
  y: number,
  overrides: Partial<Omit<WorkflowNode, 'id' | 'type' | 'x' | 'y'>> = {},
): WorkflowNode => {
  const template = templateMap[type]
  return {
    id,
    type,
    x,
    y,
    title: overrides.title ?? template.title,
    description: overrides.description ?? template.description,
    config: { ...template.config, ...(overrides.config ?? {}) },
  }
}

const buildDefaultWorkflow = (): WorkflowDocument => {
  return {
    nodes: [
      createNodeFromTemplate('node-1', 'checkpoint', 60, 140),
      createNodeFromTemplate('node-2', 'prompt', 60, 340),
      createNodeFromTemplate('node-3', 'generate', 400, 200),
      createNodeFromTemplate('node-4', 'output', 740, 200),
    ],
    edges: [
      { from: 'node-1', to: 'node-3' },   // model → generate ✅
      { from: 'node-2', to: 'node-3' },   // prompt → generate ✅
      { from: 'node-3', to: 'node-4' },   // result → output ✅
    ],
  }
}

const sanitizeNode = (value: unknown, index: number): WorkflowNode | null => {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.type !== 'string') return null
  if (!validNodeTypes.has(value.type as WorkflowNodeType)) return null

  return {
    id: value.id,
    title: value.title,
    type: value.type as WorkflowNodeType,
    x: typeof value.x === 'number' ? value.x : 48 + (index % 3) * 272,
    y: typeof value.y === 'number' ? value.y : 72 + Math.floor(index / 3) * 176,
    description: typeof value.description === 'string' ? value.description : '',
    config: isRecord(value.config) ? ({ ...value.config } as WorkflowNodeConfig) : {},
  }
}

const sanitizeEdges = (nodes: WorkflowNode[], values: unknown[]): WorkflowEdge[] => {
  const ids = new Set(nodes.map((node) => node.id))
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()

  return values.flatMap((value) => {
    if (!isRecord(value) || typeof value.from !== 'string' || typeof value.to !== 'string') return []
    if (!ids.has(value.from) || !ids.has(value.to) || value.from === value.to) return []

    const fromNode = nodeById.get(value.from)
    const toNode = nodeById.get(value.to)
    if (fromNode && toNode && !canConnect(fromNode.type, toNode.type)) return []

    const key = `${value.from}->${value.to}`
    if (seen.has(key)) return []
    seen.add(key)

    return [{ from: value.from, to: value.to }]
  })
}

const loadWorkflowDocument = (): WorkflowLoadResult => {
  const fallback = buildDefaultWorkflow()
  if (typeof window === 'undefined') return { ...fallback, restored: false }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...fallback, restored: false }

    const parsed = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return { ...fallback, restored: false }
    }

    const nodes = parsed.nodes
      .map((value, index) => sanitizeNode(value, index))
      .filter((node): node is WorkflowNode => !!node)
    if (nodes.length === 0) return { ...fallback, restored: false }

    return {
      nodes,
      edges: sanitizeEdges(nodes, parsed.edges),
      restored: true,
    }
  } catch {
    return { ...fallback, restored: false }
  }
}

const getNextNodeSeed = (nodes: WorkflowNode[]) => {
  return (
    nodes.reduce((maxValue, node) => {
      const matched = node.id.match(/(?:node-|n)(\d+)$/)
      const nextValue = matched ? Number(matched[1]) : 0
      return Number.isFinite(nextValue) ? Math.max(maxValue, nextValue) : maxValue
    }, 0) + 1
  )
}

const nodeToDraft = (node: WorkflowNode | null): InspectorDraft => {
  if (!node) return { ...EMPTY_DRAFT }

  return {
    title: node.title,
    description: node.description,
    modelPath: node.config.modelPath ?? '',
    diffusionModel: node.config.diffusionModel ?? '',
    vaePath: node.config.vaePath ?? '',
    clipL: node.config.clipL ?? '',
    clipG: node.config.clipG ?? '',
    t5xxl: node.config.t5xxl ?? '',
    weightType: node.config.weightType ?? '',
    loraModelDir: node.config.loraModelDir ?? '',
    prompt: node.config.prompt ?? '',
    negativePrompt: node.config.negativePrompt ?? '',
    clipSkip: node.config.clipSkip?.toString() ?? '',
    initImage: node.config.initImage ?? '',
    maskImage: node.config.maskImage ?? '',
    strength: node.config.strength?.toString() ?? '0.75',
    width: node.config.width?.toString() ?? '512',
    height: node.config.height?.toString() ?? '512',
    steps: node.config.steps?.toString() ?? '20',
    cfgScale: node.config.cfgScale?.toString() ?? '7',
    seed: node.config.seed?.toString() ?? '',
    samplingMethod: node.config.samplingMethod ?? 'euler_a',
    scheduler: node.config.scheduler ?? 'discrete',
    batchCount: node.config.batchCount?.toString() ?? '1',
    guidance: node.config.guidance?.toString() ?? '3.5',
    videoFrames: node.config.videoFrames?.toString() ?? '25',
    fps: node.config.fps?.toString() ?? '8',
    upscaleModel: node.config.upscaleModel ?? '',
    upscaleRepeats: node.config.upscaleRepeats?.toString() ?? '1',
    upscaleTileSize: node.config.upscaleTileSize?.toString() ?? '128',
    controlNetPath: node.config.controlNetPath ?? '',
    controlImage: node.config.controlImage ?? '',
    controlStrength: node.config.controlStrength?.toString() ?? '0.9',
    outputPath: node.config.outputPath ?? '',
    previewPath: node.config.previewPath ?? '',
    threads: node.config.threads?.toString() ?? '',
    vaeTiling: node.config.vaeTiling ?? false,
    offloadToCpu: node.config.offloadToCpu ?? false,
    flashAttention: node.config.flashAttention ?? false,
  }
}

const buildNodeFromDraft = (node: WorkflowNode, draft: InspectorDraft): WorkflowNode => {
  return {
    ...node,
    title: draft.title.trim() || templateMap[node.type].title,
    description: draft.description.trim(),
    config: {
      modelPath: draft.modelPath.trim(),
      diffusionModel: draft.diffusionModel.trim(),
      vaePath: draft.vaePath.trim(),
      clipL: draft.clipL.trim(),
      clipG: draft.clipG.trim(),
      t5xxl: draft.t5xxl.trim(),
      weightType: draft.weightType.trim(),
      loraModelDir: draft.loraModelDir.trim(),
      prompt: draft.prompt.trim(),
      negativePrompt: draft.negativePrompt.trim(),
      clipSkip: parseOptionalNumber(draft.clipSkip),
      initImage: draft.initImage.trim(),
      maskImage: draft.maskImage.trim(),
      strength: parseOptionalNumber(draft.strength),
      width: parseOptionalNumber(draft.width),
      height: parseOptionalNumber(draft.height),
      steps: parseOptionalNumber(draft.steps),
      cfgScale: parseOptionalNumber(draft.cfgScale),
      seed: parseOptionalNumber(draft.seed),
      samplingMethod: draft.samplingMethod.trim(),
      scheduler: draft.scheduler.trim(),
      batchCount: parseOptionalNumber(draft.batchCount),
      guidance: parseOptionalNumber(draft.guidance),
      videoFrames: parseOptionalNumber(draft.videoFrames),
      fps: parseOptionalNumber(draft.fps),
      upscaleModel: draft.upscaleModel.trim(),
      upscaleRepeats: parseOptionalNumber(draft.upscaleRepeats),
      upscaleTileSize: parseOptionalNumber(draft.upscaleTileSize),
      controlNetPath: draft.controlNetPath.trim(),
      controlImage: draft.controlImage.trim(),
      controlStrength: parseOptionalNumber(draft.controlStrength),
      outputPath: draft.outputPath.trim(),
      previewPath: draft.previewPath.trim(),
      threads: parseOptionalNumber(draft.threads),
      vaeTiling: draft.vaeTiling,
      offloadToCpu: draft.offloadToCpu,
      flashAttention: draft.flashAttention,
    },
  }
}

const validateNode = (node: WorkflowNode): NodeValidation => {
  const issues: string[] = []

  switch (node.type) {
    case 'checkpoint':
      if (!node.config.modelPath?.trim() && !node.config.diffusionModel?.trim())
        issues.push('需指定 --model 或 --diffusion-model')
      break
    case 'lora':
      if (!node.config.loraModelDir?.trim()) issues.push('需指定 LoRA 模型目录')
      break
    case 'prompt':
      if (!node.config.prompt?.trim()) issues.push('缺少提示词')
      break
    case 'imageInput':
      if (!node.config.initImage?.trim()) issues.push('未选择初始图像')
      break
    case 'generate':
      if (!node.config.steps || node.config.steps <= 0) issues.push('采样步数需大于 0')
      break
    case 'videoGen':
      if (!node.config.videoFrames || node.config.videoFrames <= 0) issues.push('视频帧数需大于 0')
      break
    case 'upscale':
      if (!node.config.upscaleModel?.trim()) issues.push('未指定超分模型')
      break
    case 'controlNet':
      if (!node.config.controlNetPath?.trim()) issues.push('未指定 ControlNet 模型')
      break
    case 'output':
      if (!node.config.outputPath?.trim()) issues.push('未设置输出路径')
      break
    case 'performance':
      break
    default:
      break
  }

  return { ready: issues.length === 0, issues }
}

const getNodeSummary = (node: WorkflowNode) => {
  switch (node.type) {
    case 'checkpoint':
      return shortText(node.config.modelPath || node.config.diffusionModel) || '未选择模型'
    case 'lora':
      return shortText(node.config.loraModelDir) || '未设置目录'
    case 'prompt':
      return shortText(node.config.prompt) || '空提示词'
    case 'imageInput':
      return shortText(node.config.initImage) || '未选择图像'
    case 'generate':
      return `${node.config.width ?? 512}×${node.config.height ?? 512} · ${node.config.steps ?? 20} steps · CFG ${node.config.cfgScale ?? 7}`
    case 'videoGen':
      return `${node.config.videoFrames ?? 25} 帧 · ${node.config.fps ?? 8} fps`
    case 'upscale':
      return `${shortText(node.config.upscaleModel) || '未选模型'} · ×${node.config.upscaleRepeats ?? 1}`
    case 'controlNet':
      return `${shortText(node.config.controlNetPath) || '未选模型'} · 强度 ${node.config.controlStrength ?? 0.9}`
    case 'output':
      return shortText(node.config.outputPath) || './output.png'
    case 'performance': {
      const flags: string[] = []
      if (node.config.vaeTiling) flags.push('VAE Tiling')
      if (node.config.offloadToCpu) flags.push('CPU 卸载')
      if (node.config.flashAttention) flags.push('FA')
      return flags.length > 0 ? flags.join(' · ') : `线程 ${node.config.threads ?? 'auto'}`
    }
    default:
      return node.description || '等待配置'
  }
}

const suggestNodePosition = (nodes: WorkflowNode[], anchor: WorkflowNode | null) => {
  if (!anchor) {
    const index = nodes.length
    return {
      x: 48 + (index % 3) * 272,
      y: 72 + Math.floor(index / 3) * 176,
    }
  }

  const candidateRight = { x: anchor.x + 272, y: anchor.y }
  if (candidateRight.x <= 928) return candidateRight

  return {
    x: anchor.x,
    y: anchor.y + 176,
  }
}

const autoArrangeNodes = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] => {
  if (nodes.length === 0) return nodes

  const adjacency = new Map<string, string[]>()
  const reverseAdj = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  nodes.forEach((n) => { adjacency.set(n.id, []); reverseAdj.set(n.id, []); indegree.set(n.id, 0) })
  edges.forEach((e) => {
    adjacency.get(e.from)?.push(e.to)
    reverseAdj.get(e.to)?.push(e.from)
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
  })

  // Longest-path layering for better depth distribution
  const layer = new Map<string, number>()
  const visited = new Set<string>()
  const dfs = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!
    if (visited.has(id)) return 0
    visited.add(id)
    let maxChild = -1
    for (const child of adjacency.get(id) ?? []) {
      maxChild = Math.max(maxChild, dfs(child))
    }
    const l = maxChild + 1
    layer.set(id, l)
    return l
  }
  // Start from roots (indegree 0)
  const roots = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0)
  if (roots.length === 0) roots.push(nodes[0])
  // Compute layers bottom-up then flip so roots are at layer 0
  nodes.forEach((n) => dfs(n.id))
  const maxLayer = Math.max(...Array.from(layer.values()), 0)
  layer.forEach((v, k) => layer.set(k, maxLayer - v))

  // Group nodes by layer
  const columns = new Map<number, string[]>()
  layer.forEach((l, id) => {
    if (!columns.has(l)) columns.set(l, [])
    columns.get(l)!.push(id)
  })
  const sortedLayers = Array.from(columns.keys()).sort((a, b) => a - b)

  // Barycenter ordering: sort nodes within each layer by average position of neighbors in previous layer
  const positionInLayer = new Map<string, number>()
  // Initialize first layer ordering
  const firstLayer = columns.get(sortedLayers[0]) ?? []
  firstLayer.forEach((id, i) => positionInLayer.set(id, i))

  for (let li = 1; li < sortedLayers.length; li++) {
    const col = columns.get(sortedLayers[li]) ?? []
    const bary = col.map((id) => {
      const parents = (reverseAdj.get(id) ?? []).filter((p) => positionInLayer.has(p))
      if (parents.length === 0) return { id, score: Infinity }
      const avg = parents.reduce((s, p) => s + (positionInLayer.get(p) ?? 0), 0) / parents.length
      return { id, score: avg }
    })
    bary.sort((a, b) => a.score - b.score)
    const sorted = bary.map((b) => b.id)
    columns.set(sortedLayers[li], sorted)
    sorted.forEach((id, i) => positionInLayer.set(id, i))
  }

  const H_GAP = 280
  const V_GAP = 48
  const START_X = 60
  const START_Y = 60

  const posMap = new Map<string, { x: number; y: number }>()
  sortedLayers.forEach((l) => {
    const col = columns.get(l) ?? []
    col.forEach((id, ri) => {
      posMap.set(id, { x: START_X + l * H_GAP, y: START_Y + ri * (NODE_HEIGHT + V_GAP) })
    })
  })

  // Vertical centering: shift each layer so its center aligns with the median of connected neighbors
  for (let pass = 0; pass < 4; pass++) {
    for (let li = 1; li < sortedLayers.length; li++) {
      const col = columns.get(sortedLayers[li]) ?? []
      for (const id of col) {
        const parents = (reverseAdj.get(id) ?? []).filter((p) => posMap.has(p))
        if (parents.length === 0) continue
        const avgY = parents.reduce((s, p) => s + (posMap.get(p)!.y), 0) / parents.length
        const current = posMap.get(id)!
        posMap.set(id, { x: current.x, y: avgY })
      }
    }
    // Resolve overlaps within each layer
    for (const l of sortedLayers) {
      const col = columns.get(l) ?? []
      const sorted = col.slice().sort((a, b) => (posMap.get(a)!.y) - (posMap.get(b)!.y))
      for (let i = 1; i < sorted.length; i++) {
        const prev = posMap.get(sorted[i - 1])!
        const curr = posMap.get(sorted[i])!
        const minY = prev.y + NODE_HEIGHT + V_GAP
        if (curr.y < minY) posMap.set(sorted[i], { x: curr.x, y: minY })
      }
    }
  }

  return nodes.map((n) => {
    const pos = posMap.get(n.id)
    return pos ? { ...n, x: pos.x, y: pos.y } : n
  })
}

const getExecutionPlan = (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
  const adjacency = new Map<string, string[]>()
  const indegree = new Map<string, number>()

  nodes.forEach((node) => {
    adjacency.set(node.id, [])
    indegree.set(node.id, 0)
  })

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  })

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const orderedIds: string[] = []

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue

    orderedIds.push(currentId)
    ;(adjacency.get(currentId) ?? []).forEach((nextId) => {
      const nextDegree = (indegree.get(nextId) ?? 0) - 1
      indegree.set(nextId, nextDegree)
      if (nextDegree === 0) queue.push(nextId)
    })
  }

  const unresolvedIds = nodes.map((node) => node.id).filter((id) => !orderedIds.includes(id))

  return {
    orderedIds,
    unresolvedIds,
    hasCycle: unresolvedIds.length > 0,
  }
}

const wouldCreateCycle = (edges: WorkflowEdge[], from: string, to: string) => {
  if (from === to) return true

  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    const current = adjacency.get(edge.from) ?? []
    current.push(edge.to)
    adjacency.set(edge.from, current)
  })

  const visited = new Set<string>()
  const stack = [to]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    if (current === from) return true

    visited.add(current)
    ;(adjacency.get(current) ?? []).forEach((nextId) => stack.push(nextId))
  }

  return false
}

/** Check if the output types of `from` node are compatible with the input types of `to` node */
const canConnect = (fromType: WorkflowNodeType, toType: WorkflowNodeType): boolean => {
  const outputs = nodeIOMap[fromType].outputs
  const inputs = nodeIOMap[toType].inputs
  if (outputs.length === 0 || inputs.length === 0) return false
  return outputs.some((f) => inputs.includes(f))
}

const getNodeStatus = (
  node: WorkflowNode,
  validationMap: Map<string, NodeValidation>,
  runningNodeId: string | null,
): WorkflowNodeStatus => {
  if (node.id === runningNodeId) return 'running'
  return validationMap.get(node.id)?.ready ? 'ready' : 'idle'
}

type DragState = {
  nodeId: string
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

type PanState = {
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

type SocketDragState = {
  fromNodeId: string
  side: 'out' | 'in'
  startWorldX: number
  startWorldY: number
  currentX: number
  currentY: number
}

type ContextMenuPlacement = {
  x: number
  y: number
  direction: 'down' | 'up'
}

type NodeMenuState =
  | (ContextMenuPlacement & {
      kind: 'add'
      worldX: number
      worldY: number
    })
  | (ContextMenuPlacement & {
      kind: 'node'
      nodeId: string
    })

export const WorkflowStudioPage = () => {
  const loadResultRef = useRef(loadWorkflowDocument())
  const nextNodeSeedRef = useRef(getNextNodeSeed(loadResultRef.current.nodes))
  const dragStateRef = useRef<DragState | null>(null)
  const draggingTemplateTypeRef = useRef<WorkflowNodeType | null>(null)
  const panStateRef = useRef<PanState | null>(null)
  const socketDragRef = useRef<SocketDragState | null>(null)
  const runTokenRef = useRef(0)
  const suppressClickRef = useRef(false)
  const nodeMenuRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const [nodes, setNodes] = useState<WorkflowNode[]>(loadResultRef.current.nodes)
  const [edges, setEdges] = useState<WorkflowEdge[]>(loadResultRef.current.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(loadResultRef.current.nodes[0]?.id ?? '')
  const [draft, setDraft] = useState<InspectorDraft>(() => nodeToDraft(loadResultRef.current.nodes[0] ?? null))
  const [connectTargetId, setConnectTargetId] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0 })
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [draggingTemplateType, setDraggingTemplateType] = useState<WorkflowNodeType | null>(null)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 })
  const [viewportScale, setViewportScale] = useState(1)

  const viewportOffsetRef = useRef(viewportOffset)
  viewportOffsetRef.current = viewportOffset
  const viewportScaleRef = useRef(viewportScale)
  viewportScaleRef.current = viewportScale
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const [isPanning, setIsPanning] = useState(false)
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false)
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null)
  const [socketDrag, setSocketDrag] = useState<SocketDragState | null>(null)
  const [nodeSearchQuery, setNodeSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    loadResultRef.current.restored
      ? '已恢复上次编辑的工作流草稿。'
      : '拖入左侧模板或在画布中右键添加节点，按住 Ctrl 可平移视角。',
  )

  const filteredTemplates = useMemo(() => {
    const q = nodeSearchQuery.trim().toLowerCase()
    if (!q) return nodeTemplates
    return nodeTemplates.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || nodeTypeLabel[t.type].toLowerCase().includes(q),
    )
  }, [nodeSearchQuery])

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null
  }, [nodes, selectedNodeId])

  useEffect(() => {
    if (nodes.length === 0) {
      setSelectedNodeId('')
      setDraft({ ...EMPTY_DRAFT })
      return
    }

    if (!nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0].id)
    }
  }, [nodes, selectedNodeId])

  useEffect(() => {
    setDraft(nodeToDraft(selectedNode))
  }, [selectedNode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }))
  }, [nodes, edges])

  useEffect(() => {
    return () => {
      runTokenRef.current += 1
    }
  }, [])

  useEffect(() => {
    const syncCtrlPressed = (event: KeyboardEvent) => {
      setIsCtrlPressed(event.ctrlKey)
    }

    const releaseCtrlPressed = () => {
      setIsCtrlPressed(false)
    }

    window.addEventListener('keydown', syncCtrlPressed)
    window.addEventListener('keyup', syncCtrlPressed)
    window.addEventListener('blur', releaseCtrlPressed)

    return () => {
      window.removeEventListener('keydown', syncCtrlPressed)
      window.removeEventListener('keyup', syncCtrlPressed)
      window.removeEventListener('blur', releaseCtrlPressed)
    }
  }, [])

  const nodeMap = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]))
  }, [nodes])

  const contextMenuNode = useMemo(() => {
    if (!nodeMenu || nodeMenu.kind !== 'node') return null
    return nodeMap.get(nodeMenu.nodeId) ?? null
  }, [nodeMap, nodeMenu])

  const validationMap = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, validateNode(node)]))
  }, [nodes])

  const executionPlan = useMemo(() => getExecutionPlan(nodes, edges), [nodes, edges])

  const readyCount = useMemo(() => {
    return nodes.filter((node) => validationMap.get(node.id)?.ready).length
  }, [nodes, validationMap])

  const selectedValidation = selectedNode ? (validationMap.get(selectedNode.id) ?? { ready: false, issues: [] }) : null
  const selectedStatus = selectedNode ? getNodeStatus(selectedNode, validationMap, runningNodeId) : 'idle'

  const selectedOutgoingTargets = useMemo(() => {
    if (!selectedNode) return []
    return edges
      .filter((edge) => edge.from === selectedNode.id)
      .map((edge) => nodeMap.get(edge.to))
      .filter((node): node is WorkflowNode => !!node)
  }, [edges, nodeMap, selectedNode])

  const connectOptions = useMemo(() => {
    if (!selectedNode) return []
    const linkedIds = new Set(selectedOutgoingTargets.map((node) => node.id))
    return nodes.filter((node) => node.id !== selectedNode.id && !linkedIds.has(node.id))
  }, [nodes, selectedNode, selectedOutgoingTargets])

  useEffect(() => {
    setConnectTargetId((currentValue) => {
      if (connectOptions.some((node) => node.id === currentValue)) return currentValue
      return connectOptions[0]?.id ?? ''
    })
  }, [connectOptions])

  const closeNodeMenu = useCallback(() => {
    setNodeMenu(null)
  }, [])

  const getCanvasWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) {
        return {
          canvasX: 0,
          canvasY: 0,
          worldX: -viewportOffset.x / viewportScale,
          worldY: -viewportOffset.y / viewportScale,
          width: 0,
          height: 0,
        }
      }

      const canvasX = clientX - rect.left
      const canvasY = clientY - rect.top

      return {
        canvasX,
        canvasY,
        worldX: (canvasX - viewportOffset.x) / viewportScale,
        worldY: (canvasY - viewportOffset.y) / viewportScale,
        width: rect.width,
        height: rect.height,
      }
    },
    [viewportOffset.x, viewportOffset.y, viewportScale],
  )

  const getContextMenuPlacement = useCallback(
    (clientX: number, clientY: number, menuHeight: number, menuWidth = 220) => {
      const point = getCanvasWorldPoint(clientX, clientY)
      const menuPadding = 12
      const availableBelow = point.height - point.canvasY - menuPadding
      const availableAbove = point.canvasY - menuPadding
      const direction: ContextMenuPlacement['direction'] =
        availableBelow >= menuHeight || availableBelow >= availableAbove ? 'down' : 'up'
      const targetY = direction === 'down' ? point.canvasY : point.canvasY - menuHeight

      return {
        point,
        placement: {
          x: clamp(point.canvasX, menuPadding, Math.max(menuPadding, point.width - menuWidth - menuPadding)),
          y: clamp(targetY, menuPadding, Math.max(menuPadding, point.height - menuHeight - menuPadding)),
          direction,
        },
      }
    },
    [getCanvasWorldPoint],
  )

  const addNodeToScene = useCallback(
    (
      type: WorkflowNodeType,
      options?: {
        worldX?: number
        worldY?: number
        source?: 'menu' | 'drag'
      },
    ) => {
      if (isRunning) return

      const newNodeId = `node-${nextNodeSeedRef.current++}`
      const hasCustomPosition = typeof options?.worldX === 'number' && typeof options?.worldY === 'number'
      const position = hasCustomPosition
        ? {
            x: clamp(Math.round(options.worldX! - NODE_WIDTH / 2), WORLD_MIN, WORLD_MAX),
            y: clamp(Math.round(options.worldY! - NODE_HEIGHT / 2), WORLD_MIN, WORLD_MAX),
          }
        : suggestNodePosition(nodes, selectedNode)
      const newNode = createNodeFromTemplate(newNodeId, type, position.x, position.y)

      setNodes((currentNodes) => [...currentNodes, newNode])
      if (selectedNode) {
        setEdges((currentEdges) => [...currentEdges, { from: selectedNode.id, to: newNodeId }])
      }

      setSelectedNodeId(newNodeId)
      closeNodeMenu()
      setStatusMessage(
        selectedNode
          ? `${options?.source === 'drag' ? '已拖入' : '已添加'} ${nodeTypeLabel[type]} 节点，并自动连接到 ${selectedNode.title}。`
          : `${options?.source === 'drag' ? '已拖入' : '已添加'} ${nodeTypeLabel[type]} 节点。`,
      )
    },
    [closeNodeMenu, isRunning, nodes, selectedNode],
  )

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodeMap.get(nodeId)
      if (!targetNode) return

      setSelectedNodeId(nodeId)
      setRightPanelCollapsed(false)
      closeNodeMenu()
      setStatusMessage(`已选中 ${targetNode.title}，可在右侧继续编辑。`)
    },
    [closeNodeMenu, nodeMap],
  )

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const sourceNode = nodeMap.get(nodeId)
      if (!sourceNode || isRunning) return

      const duplicatedId = `node-${nextNodeSeedRef.current++}`
      const duplicatedNode: WorkflowNode = {
        ...sourceNode,
        id: duplicatedId,
        title: `${sourceNode.title} 副本`,
        x: sourceNode.x + 36,
        y: sourceNode.y + 36,
        config: { ...sourceNode.config },
      }

      setNodes((currentNodes) => [...currentNodes, duplicatedNode])
      setSelectedNodeId(duplicatedId)
      setRightPanelCollapsed(false)
      closeNodeMenu()
      setStatusMessage(`已复制节点：${sourceNode.title}。`)
    },
    [closeNodeMenu, isRunning, nodeMap],
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodeMap.get(nodeId)
      if (!targetNode || isRunning) return

      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId))
      closeNodeMenu()
      setStatusMessage(`已删除节点：${targetNode.title}。`)
    },
    [closeNodeMenu, isRunning, nodeMap],
  )

  const updateDraft = useCallback((patch: Partial<InspectorDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }))
  }, [])

  const handleTemplateDragStart = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, type: WorkflowNodeType) => {
      draggingTemplateTypeRef.current = type
      setDraggingTemplateType(type)
      event.dataTransfer.setData(TEMPLATE_DRAG_MIME, type)
      event.dataTransfer.setData('text/plain', type)
      event.dataTransfer.effectAllowed = 'copy'
      closeNodeMenu()
      setStatusMessage(`拖动 ${nodeTypeLabel[type]} 到画布即可添加。`)
    },
    [closeNodeMenu],
  )

  const handleTemplateDragEnd = useCallback(() => {
    draggingTemplateTypeRef.current = null
    setDraggingTemplateType(null)
    setIsCanvasDragOver(false)
  }, [])

  const handleApplyChanges = useCallback(() => {
    if (!selectedNode) return

    const nextNode = buildNodeFromDraft(selectedNode, draft)
    const validation = validateNode(nextNode)

    setNodes((currentNodes) => currentNodes.map((node) => (node.id === nextNode.id ? nextNode : node)))
    setStatusMessage(
      validation.ready
        ? `已更新 ${nextNode.title}。`
        : `已保存 ${nextNode.title}，仍需完善：${validation.issues.join('、')}。`,
    )
  }, [draft, selectedNode])

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNode || isRunning) return

    handleDeleteNode(selectedNode.id)
  }, [handleDeleteNode, isRunning, selectedNode])

  const handleConnectSelectedNode = useCallback(() => {
    if (!selectedNode || !connectTargetId) return

    if (edges.some((edge) => edge.from === selectedNode.id && edge.to === connectTargetId)) {
      setStatusMessage('这条连线已经存在。')
      return
    }

    const targetNode = nodeMap.get(connectTargetId)
    if (targetNode && !canConnect(selectedNode.type, targetNode.type)) {
      setStatusMessage(`无法连接：${selectedNode.title} 的输出类型与 ${targetNode.title} 的输入类型不兼容。`)
      return
    }

    if (wouldCreateCycle(edges, selectedNode.id, connectTargetId)) {
      setStatusMessage('该连线会形成循环依赖，请调整目标节点。')
      return
    }

    setEdges((currentEdges) => [...currentEdges, { from: selectedNode.id, to: connectTargetId }])
    setStatusMessage(`已连接 ${selectedNode.title} → ${targetNode?.title ?? '节点'}。`)
  }, [connectTargetId, edges, nodeMap, selectedNode])

  const handleRemoveEdge = useCallback(
    (targetNodeId: string) => {
      if (!selectedNode) return

      const targetNode = nodeMap.get(targetNodeId)
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => !(edge.from === selectedNode.id && edge.to === targetNodeId)),
      )
      setStatusMessage(`已断开 ${selectedNode.title} → ${targetNode?.title ?? '节点'}。`)
    },
    [nodeMap, selectedNode],
  )

  const handleAutoArrange = useCallback(() => {
    if (isRunning || nodes.length === 0) return
    const arranged = autoArrangeNodes(nodes, edges)
    setNodes(arranged)
    setViewportOffset({ x: 0, y: 0 })
    setViewportScale(1)
    setStatusMessage(`已自动整理 ${nodes.length} 个节点布局。`)
  }, [edges, isRunning, nodes])

  const handleResetWorkflow = useCallback(() => {
    runTokenRef.current += 1
    setIsRunning(false)
    setRunningNodeId(null)
    setRunProgress({ current: 0, total: 0 })
    setLastRunAt(null)
    setViewportOffset({ x: 0, y: 0 })
    setViewportScale(1)
    closeNodeMenu()

    const nextDocument = buildDefaultWorkflow()
    nextNodeSeedRef.current = getNextNodeSeed(nextDocument.nodes)

    setNodes(nextDocument.nodes)
    setEdges(nextDocument.edges)
    setSelectedNodeId(nextDocument.nodes[0]?.id ?? '')
    setStatusMessage('已恢复默认示例工作流。')
  }, [closeNodeMenu])

  const handleCanvasContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (isRunning) return

      const { point, placement } = getContextMenuPlacement(event.clientX, event.clientY, 330)

      setNodeMenu({
        kind: 'add',
        x: placement.x,
        y: placement.y,
        worldX: point.worldX,
        worldY: point.worldY,
        direction: placement.direction,
      })
      setStatusMessage('已打开节点菜单，可在当前位置插入新节点。')
    },
    [getContextMenuPlacement, isRunning],
  )

  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => {
      event.preventDefault()
      event.stopPropagation()
      if (isRunning) return

      const targetNode = nodeMap.get(nodeId)
      if (!targetNode) return

      const { placement } = getContextMenuPlacement(event.clientX, event.clientY, 176)

      setSelectedNodeId(nodeId)
      setNodeMenu({
        kind: 'node',
        nodeId,
        x: placement.x,
        y: placement.y,
        direction: placement.direction,
      })
      setStatusMessage(`已打开 ${targetNode.title} 的节点管理菜单。`)
    },
    [getContextMenuPlacement, isRunning, nodeMap],
  )

  const handleCanvasMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return

      const target = event.target as Node | null
      if (nodeMenuRef.current?.contains(target)) return

      if (event.ctrlKey) {
        panStateRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: viewportOffset.x,
          originY: viewportOffset.y,
          moved: false,
        }
        setIsPanning(true)
        closeNodeMenu()
        event.preventDefault()
        return
      }

      if (nodeMenu) closeNodeMenu()
    },
    [closeNodeMenu, nodeMenu, viewportOffset.x, viewportOffset.y],
  )

  // Native wheel listener (non-passive) so preventDefault works for zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      const direction = event.deltaY < 0 ? 1 : -1
      const scale = viewportScaleRef.current
      const offset = viewportOffsetRef.current
      const newScale = clamp(scale + direction * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)
      const ratio = newScale / scale
      setViewportScale(newScale)
      setViewportOffset({
        x: mouseX - (mouseX - offset.x) * ratio,
        y: mouseY - (mouseY - offset.y) * ratio,
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const handleCanvasDragEnter = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const canAcceptTemplate =
        !!draggingTemplateTypeRef.current ||
        Array.from(event.dataTransfer.types).includes(TEMPLATE_DRAG_MIME) ||
        Array.from(event.dataTransfer.types).includes('text/plain')
      if (!canAcceptTemplate) return
      event.preventDefault()
      setIsCanvasDragOver(true)
      closeNodeMenu()
    },
    [closeNodeMenu],
  )

  const handleCanvasDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const canAcceptTemplate =
        !!draggingTemplateTypeRef.current ||
        Array.from(event.dataTransfer.types).includes(TEMPLATE_DRAG_MIME) ||
        Array.from(event.dataTransfer.types).includes('text/plain')
      if (!canAcceptTemplate) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      if (!isCanvasDragOver) setIsCanvasDragOver(true)
    },
    [isCanvasDragOver],
  )

  const handleCanvasDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsCanvasDragOver(false)
  }, [])

  const handleCanvasDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const droppedType = (event.dataTransfer.getData(TEMPLATE_DRAG_MIME) ||
        event.dataTransfer.getData('text/plain') ||
        draggingTemplateTypeRef.current) as WorkflowNodeType
      if (!validNodeTypes.has(droppedType)) return

      event.preventDefault()
      setIsCanvasDragOver(false)
      draggingTemplateTypeRef.current = null
      setDraggingTemplateType(null)
      const point = getCanvasWorldPoint(event.clientX, event.clientY)
      addNodeToScene(droppedType, { worldX: point.worldX, worldY: point.worldY, source: 'drag' })
    },
    [addNodeToScene, getCanvasWorldPoint],
  )

  const handleNodeMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => {
      if (event.button !== 0 || isRunning || event.ctrlKey) return
      const target = event.target as HTMLElement
      if (target.closest('.workflow-socket')) return

      const node = nodes.find((item) => item.id === nodeId)
      if (!node) return

      dragStateRef.current = {
        nodeId,
        startX: event.clientX,
        startY: event.clientY,
        originX: node.x,
        originY: node.y,
        moved: false,
      }
    },
    [isRunning, nodes],
  )

  const handleSocketMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>, nodeId: string, side: 'in' | 'out') => {
      if (isRunning) return
      event.preventDefault()
      event.stopPropagation()

      const node = nodeMap.get(nodeId)
      if (!node) return

      const worldX = side === 'out' ? node.x + NODE_WIDTH : node.x
      const worldY = node.y + NODE_HEIGHT / 2

      const state: SocketDragState = {
        fromNodeId: nodeId,
        side,
        startWorldX: worldX,
        startWorldY: worldY,
        currentX: worldX,
        currentY: worldY,
      }
      socketDragRef.current = state
      setSocketDrag(state)
    },
    [isRunning, nodeMap],
  )

  const handleEdgeClick = useCallback(
    (event: ReactMouseEvent<SVGPathElement>, fromId: string, toId: string) => {
      event.stopPropagation()
      if (isRunning) return
      const fromNode = nodeMap.get(fromId)
      const toNode = nodeMap.get(toId)
      setEdges((cur) => cur.filter((e) => !(e.from === fromId && e.to === toId)))
      setStatusMessage(`已断开连线：${fromNode?.title ?? fromId} → ${toNode?.title ?? toId}。`)
    },
    [isRunning, nodeMap],
  )

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const sState = socketDragRef.current
      if (sState) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const canvasX = event.clientX - rect.left
          const canvasY = event.clientY - rect.top
          const off = viewportOffsetRef.current
          const sc = viewportScaleRef.current
          const wx = (canvasX - off.x) / sc
          const wy = (canvasY - off.y) / sc
          const next = { ...sState, currentX: wx, currentY: wy }
          socketDragRef.current = next
          setSocketDrag(next)
        }
        return
      }

      const panState = panStateRef.current
      if (panState) {
        const deltaX = event.clientX - panState.startX
        const deltaY = event.clientY - panState.startY
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) panState.moved = true

        setViewportOffset({
          x: panState.originX + deltaX,
          y: panState.originY + deltaY,
        })
        return
      }

      const dragState = dragStateRef.current
      if (!dragState) return

      const deltaX = event.clientX - dragState.startX
      const deltaY = event.clientY - dragState.startY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) dragState.moved = true

      const sc = viewportScaleRef.current
      const nextX = clamp(dragState.originX + deltaX / sc, WORLD_MIN, WORLD_MAX)
      const nextY = clamp(dragState.originY + deltaY / sc, WORLD_MIN, WORLD_MAX)

      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === dragState.nodeId ? { ...node, x: nextX, y: nextY } : node)),
      )
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (socketDragRef.current) {
        const sState = socketDragRef.current
        socketDragRef.current = null
        setSocketDrag(null)

        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const canvasX = event.clientX - rect.left
          const canvasY = event.clientY - rect.top
          const off = viewportOffsetRef.current
          const sc = viewportScaleRef.current
          const wx = (canvasX - off.x) / sc
          const wy = (canvasY - off.y) / sc
          const curNodes = nodesRef.current
          const curEdges = edgesRef.current

          let targetId: string | null = null
          for (const n of curNodes) {
            if (wx >= n.x && wx <= n.x + NODE_WIDTH && wy >= n.y && wy <= n.y + NODE_HEIGHT) {
              if (n.id !== sState.fromNodeId) targetId = n.id
              break
            }
          }

          if (targetId) {
            const from = sState.side === 'out' ? sState.fromNodeId : targetId
            const to = sState.side === 'out' ? targetId : sState.fromNodeId
            const fromNode = curNodes.find((n) => n.id === from)
            const toNode = curNodes.find((n) => n.id === to)
            if (fromNode && toNode && !canConnect(fromNode.type, toNode.type)) {
              setStatusMessage(`无法连接：${fromNode.title} 的输出类型与 ${toNode.title} 的输入类型不兼容。`)
            } else if (!curEdges.some((e) => e.from === from && e.to === to) && !wouldCreateCycle(curEdges, from, to)) {
              setEdges((cur) => [...cur, { from, to }])
              const fn = curNodes.find((n) => n.id === from)
              const tn = curNodes.find((n) => n.id === to)
              setStatusMessage(`已连接 ${fn?.title ?? from} → ${tn?.title ?? to}。`)
            }
          }
        }
        return
      }

      if (panStateRef.current) {
        if (panStateRef.current.moved) {
          suppressClickRef.current = true
          window.setTimeout(() => {
            suppressClickRef.current = false
          }, 0)
          setStatusMessage('已平移工作台视角。')
        }
        panStateRef.current = null
        setIsPanning(false)
      }

      if (!dragStateRef.current) return
      if (dragStateRef.current.moved) {
        suppressClickRef.current = true
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
        setStatusMessage('已更新节点布局。')
      }
      dragStateRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const runWorkflow = useCallback(async () => {
    if (isRunning) return
    closeNodeMenu()
    if (nodes.length === 0) {
      setStatusMessage('画布为空，请先添加节点。')
      return
    }
    if (executionPlan.hasCycle) {
      setStatusMessage('存在循环依赖，无法执行，请先调整连线。')
      return
    }

    const blockedNodes = nodes.filter((node) => !validationMap.get(node.id)?.ready)
    if (blockedNodes.length > 0) {
      setSelectedNodeId(blockedNodes[0].id)
      setStatusMessage(
        `还有 ${blockedNodes.length} 个节点待配置：${blockedNodes.map((node) => node.title).join('、')}。`,
      )
      return
    }

    const queueNodes = executionPlan.orderedIds
      .map((nodeId) => nodeMap.get(nodeId))
      .filter((node): node is WorkflowNode => !!node)

    if (queueNodes.length === 0) {
      setStatusMessage('没有可执行节点。')
      return
    }

    const runToken = ++runTokenRef.current
    setIsRunning(true)
    setRunProgress({ current: 0, total: queueNodes.length })
    setStatusMessage(`开始执行 ${queueNodes.length} 个节点。`)

    try {
      for (let index = 0; index < queueNodes.length; index += 1) {
        if (runTokenRef.current !== runToken) return

        const currentNode = queueNodes[index]
        setRunningNodeId(currentNode.id)
        setRunProgress({ current: index + 1, total: queueNodes.length })
        setStatusMessage(`执行中：${currentNode.title}。`)
        await wait(420 + (index % 3) * 120)
      }

      if (runTokenRef.current !== runToken) return

      setLastRunAt(
        new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
      setStatusMessage(`执行完成：${queueNodes.length} 个节点已串行处理。`)
    } finally {
      if (runTokenRef.current === runToken) {
        setRunningNodeId(null)
        setIsRunning(false)
      }
    }
  }, [closeNodeMenu, executionPlan.hasCycle, executionPlan.orderedIds, isRunning, nodeMap, nodes, validationMap])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNodeMenu()
      }

      if (event.code !== 'Space') return

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target?.isContentEditable) {
        return
      }

      event.preventDefault()
      void runWorkflow()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeNodeMenu, runWorkflow])

  useEffect(() => {
    if (!nodeMenu) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (nodeMenuRef.current?.contains(target)) return
      if (canvasRef.current?.contains(target)) return
      closeNodeMenu()
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeNodeMenu, nodeMenu])

  const footerState = useMemo(() => {
    if (isRunning) {
      return {
        tone: 'running',
        text: `工作流状态：执行中（${runProgress.current}/${runProgress.total}）`,
      }
    }

    if (executionPlan.hasCycle) {
      return {
        tone: 'warning',
        text: '工作流状态：存在循环依赖，需调整连线',
      }
    }

    if (nodes.length === 0) {
      return {
        tone: 'warning',
        text: '工作流状态：画布为空，请先添加节点',
      }
    }

    if (readyCount < nodes.length) {
      return {
        tone: 'warning',
        text: `工作流状态：${nodes.length - readyCount} 个节点待配置`,
      }
    }

    return {
      tone: 'ready',
      text: `工作流状态：已就绪（${nodes.length} 节点 / ${edges.length} 连线）`,
    }
  }, [edges.length, executionPlan.hasCycle, isRunning, nodes.length, readyCount, runProgress])

  const renderNodeFields = () => {
    if (!selectedNode) return null

    switch (selectedNode.type) {
      case 'checkpoint':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>模型路径 (--model)</label>
              <Input
                size="small"
                value={draft.modelPath}
                onChange={(event) => updateDraft({ modelPath: event.target.value })}
                disabled={isRunning}
                placeholder="完整模型文件路径"
              />
            </div>
            <div className="workflow-inspector-group">
              <label>扩散模型 (--diffusion-model)</label>
              <Input
                size="small"
                value={draft.diffusionModel}
                onChange={(event) => updateDraft({ diffusionModel: event.target.value })}
                disabled={isRunning}
                placeholder="独立扩散模型路径（可选）"
              />
            </div>
            <div className="workflow-inspector-group">
              <label>VAE (--vae)</label>
              <Input
                size="small"
                value={draft.vaePath}
                onChange={(event) => updateDraft({ vaePath: event.target.value })}
                disabled={isRunning}
                placeholder="独立 VAE 模型路径（可选）"
              />
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>CLIP-L</label>
                <Input
                  size="small"
                  value={draft.clipL}
                  onChange={(event) => updateDraft({ clipL: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>CLIP-G</label>
                <Input
                  size="small"
                  value={draft.clipG}
                  onChange={(event) => updateDraft({ clipG: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>T5-XXL</label>
                <Input
                  size="small"
                  value={draft.t5xxl}
                  onChange={(event) => updateDraft({ t5xxl: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>权重类型 (--type)</label>
                <Select
                  size="small"
                  value={draft.weightType || undefined}
                  onChange={(value) => updateDraft({ weightType: value })}
                  disabled={isRunning}
                  allowClear
                  placeholder="自动"
                  options={[
                    { value: 'f32', label: 'F32' },
                    { value: 'f16', label: 'F16' },
                    { value: 'q8_0', label: 'Q8_0' },
                    { value: 'q5_1', label: 'Q5_1' },
                    { value: 'q5_0', label: 'Q5_0' },
                    { value: 'q4_1', label: 'Q4_1' },
                    { value: 'q4_0', label: 'Q4_0' },
                    { value: 'q4_K', label: 'Q4_K' },
                    { value: 'q3_K', label: 'Q3_K' },
                    { value: 'q2_K', label: 'Q2_K' },
                  ]}
                />
              </div>
            </div>
          </>
        )
      case 'lora':
        return (
          <div className="workflow-inspector-group">
            <label>LoRA 目录 (--lora-model-dir)</label>
            <Input
              size="small"
              value={draft.loraModelDir}
              onChange={(event) => updateDraft({ loraModelDir: event.target.value })}
              disabled={isRunning}
              placeholder="存放 LoRA 权重的文件夹路径"
            />
          </div>
        )
      case 'prompt':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>正向提示词 (--prompt)</label>
              <Input.TextArea
                size="small"
                rows={4}
                value={draft.prompt}
                onChange={(event) => updateDraft({ prompt: event.target.value })}
                disabled={isRunning}
                placeholder="描述你想生成的画面内容..."
              />
            </div>
            <div className="workflow-inspector-group">
              <label>反向提示词 (--negative-prompt)</label>
              <Input.TextArea
                size="small"
                rows={2}
                value={draft.negativePrompt}
                onChange={(event) => updateDraft({ negativePrompt: event.target.value })}
                disabled={isRunning}
                placeholder="不想出现的内容..."
              />
            </div>
            <div className="workflow-inspector-group">
              <label>CLIP Skip (--clip-skip)</label>
              <Input
                size="small"
                value={draft.clipSkip}
                onChange={(event) => updateDraft({ clipSkip: event.target.value })}
                disabled={isRunning}
                placeholder="默认自动（SD1.x=1, SD2.x=2）"
              />
            </div>
          </>
        )
      case 'imageInput':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>初始图像 (--init-img)</label>
              <Input
                size="small"
                value={draft.initImage}
                onChange={(event) => updateDraft({ initImage: event.target.value })}
                disabled={isRunning}
                placeholder="图生图的初始图像路径"
              />
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>遮罩 (--mask)</label>
                <Input
                  size="small"
                  value={draft.maskImage}
                  onChange={(event) => updateDraft({ maskImage: event.target.value })}
                  disabled={isRunning}
                  placeholder="遮罩图像路径（可选）"
                />
              </div>
              <div className="workflow-inspector-group">
                <label>重绘强度 (--strength)</label>
                <Input
                  size="small"
                  value={draft.strength}
                  onChange={(event) => updateDraft({ strength: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
          </>
        )
      case 'generate':
        return (
          <>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>宽度 (-W)</label>
                <Input
                  size="small"
                  value={draft.width}
                  onChange={(event) => updateDraft({ width: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>高度 (-H)</label>
                <Input
                  size="small"
                  value={draft.height}
                  onChange={(event) => updateDraft({ height: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>步数 (--steps)</label>
                <Input
                  size="small"
                  value={draft.steps}
                  onChange={(event) => updateDraft({ steps: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>CFG (--cfg-scale)</label>
                <Input
                  size="small"
                  value={draft.cfgScale}
                  onChange={(event) => updateDraft({ cfgScale: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>种子 (--seed)</label>
                <Input
                  size="small"
                  value={draft.seed}
                  onChange={(event) => updateDraft({ seed: event.target.value })}
                  disabled={isRunning}
                  placeholder="-1 随机"
                />
              </div>
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>采样方法</label>
                <Select
                  size="small"
                  value={draft.samplingMethod}
                  onChange={(value) => updateDraft({ samplingMethod: value })}
                  disabled={isRunning}
                  options={[
                    { value: 'euler', label: 'Euler' },
                    { value: 'euler_a', label: 'Euler A' },
                    { value: 'heun', label: 'Heun' },
                    { value: 'dpm2', label: 'DPM2' },
                    { value: 'dpm++2s_a', label: 'DPM++ 2S A' },
                    { value: 'dpm++2m', label: 'DPM++ 2M' },
                    { value: 'dpm++2mv2', label: 'DPM++ 2M v2' },
                    { value: 'lcm', label: 'LCM' },
                    { value: 'ipndm', label: 'iPNDM' },
                  ]}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>调度器</label>
                <Select
                  size="small"
                  value={draft.scheduler}
                  onChange={(value) => updateDraft({ scheduler: value })}
                  disabled={isRunning}
                  options={[
                    { value: 'discrete', label: 'Discrete' },
                    { value: 'karras', label: 'Karras' },
                    { value: 'exponential', label: 'Exponential' },
                    { value: 'ays', label: 'AYS' },
                    { value: 'sgm_uniform', label: 'SGM Uniform' },
                    { value: 'simple', label: 'Simple' },
                  ]}
                />
              </div>
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>批次 (-b)</label>
                <Input
                  size="small"
                  value={draft.batchCount}
                  onChange={(event) => updateDraft({ batchCount: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>引导 (--guidance)</label>
                <Input
                  size="small"
                  value={draft.guidance}
                  onChange={(event) => updateDraft({ guidance: event.target.value })}
                  disabled={isRunning}
                  placeholder="蒸馏模型引导强度"
                />
              </div>
            </div>
          </>
        )
      case 'videoGen':
        return (
          <>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>帧数 (--video-frames)</label>
                <Input
                  size="small"
                  value={draft.videoFrames}
                  onChange={(event) => updateDraft({ videoFrames: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>FPS (--fps)</label>
                <Input
                  size="small"
                  value={draft.fps}
                  onChange={(event) => updateDraft({ fps: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>步数</label>
                <Input
                  size="small"
                  value={draft.steps}
                  onChange={(event) => updateDraft({ steps: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>CFG</label>
                <Input
                  size="small"
                  value={draft.cfgScale}
                  onChange={(event) => updateDraft({ cfgScale: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>种子</label>
                <Input
                  size="small"
                  value={draft.seed}
                  onChange={(event) => updateDraft({ seed: event.target.value })}
                  disabled={isRunning}
                  placeholder="-1 随机"
                />
              </div>
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>采样方法</label>
                <Select
                  size="small"
                  value={draft.samplingMethod}
                  onChange={(value) => updateDraft({ samplingMethod: value })}
                  disabled={isRunning}
                  options={[
                    { value: 'euler', label: 'Euler' },
                    { value: 'euler_a', label: 'Euler A' },
                    { value: 'dpm++2m', label: 'DPM++ 2M' },
                  ]}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>调度器</label>
                <Select
                  size="small"
                  value={draft.scheduler}
                  onChange={(value) => updateDraft({ scheduler: value })}
                  disabled={isRunning}
                  options={[
                    { value: 'discrete', label: 'Discrete' },
                    { value: 'karras', label: 'Karras' },
                    { value: 'simple', label: 'Simple' },
                  ]}
                />
              </div>
            </div>
          </>
        )
      case 'upscale':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>超分模型 (--upscale-model)</label>
              <Input
                size="small"
                value={draft.upscaleModel}
                onChange={(event) => updateDraft({ upscaleModel: event.target.value })}
                disabled={isRunning}
                placeholder="ESRGAN 模型路径"
              />
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>重复次数</label>
                <Input
                  size="small"
                  value={draft.upscaleRepeats}
                  onChange={(event) => updateDraft({ upscaleRepeats: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>切片大小</label>
                <Input
                  size="small"
                  value={draft.upscaleTileSize}
                  onChange={(event) => updateDraft({ upscaleTileSize: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
          </>
        )
      case 'controlNet':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>ControlNet 模型 (--control-net)</label>
              <Input
                size="small"
                value={draft.controlNetPath}
                onChange={(event) => updateDraft({ controlNetPath: event.target.value })}
                disabled={isRunning}
                placeholder="ControlNet 模型路径"
              />
            </div>
            <div className="workflow-inspector-group">
              <label>控制图像 (--control-image)</label>
              <Input
                size="small"
                value={draft.controlImage}
                onChange={(event) => updateDraft({ controlImage: event.target.value })}
                disabled={isRunning}
                placeholder="控制图像路径"
              />
            </div>
            <div className="workflow-inspector-group">
              <label>强度 (--control-strength)</label>
              <Input
                size="small"
                value={draft.controlStrength}
                onChange={(event) => updateDraft({ controlStrength: event.target.value })}
                disabled={isRunning}
              />
            </div>
          </>
        )
      case 'output':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>输出路径 (--output)</label>
              <Input
                size="small"
                value={draft.outputPath}
                onChange={(event) => updateDraft({ outputPath: event.target.value })}
                disabled={isRunning}
                placeholder="./output.png（支持 %d 序列）"
              />
            </div>
            <div className="workflow-inspector-group">
              <label>预览路径 (--preview-path)</label>
              <Input
                size="small"
                value={draft.previewPath}
                onChange={(event) => updateDraft({ previewPath: event.target.value })}
                disabled={isRunning}
                placeholder="./preview.png"
              />
            </div>
          </>
        )
      case 'performance':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>线程数 (--threads)</label>
              <Input
                size="small"
                value={draft.threads}
                onChange={(event) => updateDraft({ threads: event.target.value })}
                disabled={isRunning}
                placeholder="-1 自动检测 CPU 核心数"
              />
            </div>
            <div className="workflow-inspector-group">
              <label>VAE 分块 (--vae-tiling)</label>
              <Switch
                size="small"
                checked={draft.vaeTiling}
                onChange={(checked) => updateDraft({ vaeTiling: checked })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-group">
              <label>CPU 卸载 (--offload-to-cpu)</label>
              <Switch
                size="small"
                checked={draft.offloadToCpu}
                onChange={(checked) => updateDraft({ offloadToCpu: checked })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-group">
              <label>Flash Attention (--fa)</label>
              <Switch
                size="small"
                checked={draft.flashAttention}
                onChange={(checked) => updateDraft({ flashAttention: checked })}
                disabled={isRunning}
              />
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="workflow-page">
      <div className="workflow-toolbar">
        <div className="workflow-toolbar-left">
          <h2 className="workflow-toolbar-title">节点工作台</h2>
          <Tag color="default">自动保存</Tag>
          <span className="workflow-toolbar-note">{lastRunAt ? `上次执行：${lastRunAt}` : '未执行'}</span>
        </div>
        <div className="workflow-toolbar-right">
          <Tooltip title="自动整理节点布局">
            <Button size="small" onClick={handleAutoArrange} disabled={isRunning || nodes.length === 0}>
              自动整理
            </Button>
          </Tooltip>
          <Tooltip title="重置缩放与视角">
            <Button size="small" onClick={() => { setViewportScale(1); setViewportOffset({ x: 0, y: 0 }) }}>
              {Math.round(viewportScale * 100)}%
            </Button>
          </Tooltip>
          <Tooltip title="恢复出厂示例工作流">
            <Button size="small" onClick={handleResetWorkflow} disabled={isRunning}>
              重置示例
            </Button>
          </Tooltip>
          <Button
            type="primary"
            size="small"
            icon={<ArrowRightRegular />}
            onClick={() => void runWorkflow()}
            disabled={isRunning}
          >
            {isRunning ? '执行中…' : '执行工作流'}
          </Button>
        </div>
      </div>

      <section className="workflow-body">
        {leftPanelCollapsed ? (
          <button
            type="button"
            className="workflow-panel-dock workflow-panel-dock-left"
            onClick={() => setLeftPanelCollapsed(false)}
            title="展开节点库"
            aria-label="展开节点库"
          >
            <GridRegular />
          </button>
        ) : (
          <aside className="workflow-panel workflow-left">
            <div className="workflow-panel-header">
              <div className="workflow-panel-header-copy">
                <h3>节点库</h3>
                <p>拖到画布中创建；按住 Ctrl 拖动画布，右键打开菜单。</p>
              </div>
              <button
                type="button"
                className="workflow-panel-collapse"
                onClick={() => setLeftPanelCollapsed(true)}
                title="折叠节点库"
                aria-label="折叠节点库"
              >
                <ChevronLeftRegular />
              </button>
            </div>

            <Input
              size="small"
              placeholder="搜索节点…"
              prefix={<SearchRegular />}
              allowClear
              value={nodeSearchQuery}
              onChange={(event) => setNodeSearchQuery(event.target.value)}
            />

            <div className="workflow-node-list">
              {filteredTemplates.length === 0 ? (
                <p className="workflow-empty-text">没有匹配的节点。</p>
              ) : (
                filteredTemplates.map((template) => {
                  const io = nodeIOMap[template.type]
                  return (
                    <div
                      key={template.type}
                      className="workflow-node-template"
                      draggable={!isRunning}
                      onDragStart={(event) => handleTemplateDragStart(event, template.type)}
                      onDragEnd={handleTemplateDragEnd}
                    >
                      <span
                        className="workflow-node-template-dot"
                        style={{ background: nodeTypeColor[template.type] }}
                      />
                      <span className="workflow-node-template-copy">
                        <strong>{template.title}</strong>
                        <span>{template.description}</span>
                        <span className="workflow-node-template-io">
                          {io.inputs.map((f) => (
                            <span key={`in-${f}`} className="workflow-io-tag is-input" style={{ borderColor: mediaFormatColor[f], color: mediaFormatColor[f] }}>{mediaFormatLabel[f]}</span>
                          ))}
                          {io.outputs.length > 0 && <span className="workflow-io-arrow">→</span>}
                          {io.outputs.map((f) => (
                            <span key={`out-${f}`} className="workflow-io-tag is-output" style={{ background: mediaFormatColor[f] }}>{mediaFormatLabel[f]}</span>
                          ))}
                        </span>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        )}

        <div
          className={`workflow-canvas ${isPanning ? 'is-panning' : ''} ${isCanvasDragOver ? 'is-drag-over' : ''} ${isCtrlPressed && !isRunning ? 'is-pan-ready' : ''}`}
          ref={canvasRef}
          onContextMenu={handleCanvasContextMenu}
          onMouseDown={handleCanvasMouseDown}
          onDragEnter={handleCanvasDragEnter}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          {draggingTemplateType ? (
            <div
              className={`workflow-drop-overlay ${isCanvasDragOver ? 'is-active' : ''}`}
              onDragEnter={handleCanvasDragEnter}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
            >
              <div className="workflow-drop-overlay-card">
                <span className="workflow-drop-overlay-icon">{nodeTypeIcon[draggingTemplateType]}</span>
                <span>释放以添加「{nodeTypeLabel[draggingTemplateType]}」节点</span>
              </div>
            </div>
          ) : null}

          {nodeMenu ? (
            <div
              className={`workflow-node-menu ${nodeMenu.direction === 'up' ? 'is-open-upward' : 'is-open-downward'}`}
              ref={nodeMenuRef}
              style={{ left: nodeMenu.x, top: nodeMenu.y }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.stopPropagation()}
            >
              {nodeMenu.kind === 'add' ? (
                <>
                  <div className="workflow-node-menu-title">添加节点</div>
                  <div className="workflow-node-menu-list">
                    {nodeTemplates.map((template) => (
                      <button
                        key={template.type}
                        type="button"
                        className="workflow-node-menu-item"
                        onClick={() =>
                          addNodeToScene(template.type, {
                            worldX: nodeMenu.worldX,
                            worldY: nodeMenu.worldY,
                            source: 'menu',
                          })
                        }
                      >
                        <span className="workflow-node-menu-icon">{nodeTypeIcon[template.type]}</span>
                        <span className="workflow-node-menu-copy">
                          <strong>{template.title}</strong>
                          <span>{template.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="workflow-node-menu-title">管理节点</div>
                  <div className="workflow-node-menu-list">
                    <button
                      type="button"
                      className="workflow-node-menu-item"
                      onClick={() => handleFocusNode(nodeMenu.nodeId)}
                    >
                      <span className="workflow-node-menu-icon">
                        <EditRegular />
                      </span>
                      <span className="workflow-node-menu-copy">
                        <strong>编辑节点</strong>
                        <span>{contextMenuNode?.title ?? '打开右侧参数面板继续编辑'}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="workflow-node-menu-item"
                      onClick={() => handleDuplicateNode(nodeMenu.nodeId)}
                    >
                      <span className="workflow-node-menu-icon">
                        <CopyRegular />
                      </span>
                      <span className="workflow-node-menu-copy">
                        <strong>复制节点</strong>
                        <span>生成一个带相同参数的副本</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="workflow-node-menu-item"
                      onClick={() => handleDeleteNode(nodeMenu.nodeId)}
                    >
                      <span className="workflow-node-menu-icon">
                        <DeleteRegular />
                      </span>
                      <span className="workflow-node-menu-copy">
                        <strong>删除节点</strong>
                        <span>同时移除该节点的所有入边和出边</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {nodes.length === 0 ? (
            <div className="workflow-canvas-empty">拖入左侧节点，或在此处右键添加第一个节点。</div>
          ) : null}

          <div
            className="workflow-canvas-stage"
            style={{ transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${viewportScale})` }}
          >
            <svg className="workflow-links" aria-hidden="true">
              {edges.map((edge) => {
                const fromNode = nodeMap.get(edge.from)
                const toNode = nodeMap.get(edge.to)
                if (!fromNode || !toNode) return null

                const x1 = fromNode.x + NODE_WIDTH
                const y1 = fromNode.y + NODE_HEIGHT / 2
                const x2 = toNode.x
                const y2 = toNode.y + NODE_HEIGHT / 2
                const midX = (x1 + x2) / 2
                const path = `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`
                const edgeColor = nodeTypeColor[fromNode.type]
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      onClick={(e) => handleEdgeClick(e, edge.from, edge.to)}
                    />
                    <path
                      d={path}
                      className="workflow-link-path"
                      style={{ stroke: edgeColor }}
                    />
                  </g>
                )
              })}
              {socketDrag && (() => {
                const x1 = socketDrag.side === 'out' ? socketDrag.startWorldX : socketDrag.currentX
                const y1 = socketDrag.side === 'out' ? socketDrag.startWorldY : socketDrag.currentY
                const x2 = socketDrag.side === 'out' ? socketDrag.currentX : socketDrag.startWorldX
                const y2 = socketDrag.side === 'out' ? socketDrag.currentY : socketDrag.startWorldY
                const midX = (x1 + x2) / 2
                const path = `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`
                return (
                  <path
                    d={path}
                    className="workflow-link-path is-dragging"
                  />
                )
              })()}
            </svg>

            {nodes.map((node) => {
              const status = getNodeStatus(node, validationMap, runningNodeId)
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`workflow-node ${node.id === selectedNodeId ? 'is-selected' : ''}`}
                  style={{ left: node.x, top: node.y, '--node-color': nodeTypeColor[node.type] } as CSSProperties}
                  onClick={(event) => {
                    if (event.ctrlKey || suppressClickRef.current) return
                    setSelectedNodeId(node.id)
                  }}
                  onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                  onContextMenu={(event) => handleNodeContextMenu(event, node.id)}
                  data-node-id={node.id}
                  disabled={isRunning}
                >
                  <div className="workflow-node-header" style={{ '--node-color': nodeTypeColor[node.type] } as CSSProperties}>
                    <span className="workflow-node-icon">{nodeTypeIcon[node.type]}</span>
                    <span className="workflow-node-title">{node.title}</span>
                    <span className={`workflow-node-badge is-${status}`}>{statusText[status]}</span>
                  </div>
                  <div className="workflow-node-body">
                    <p>{getNodeSummary(node)}</p>
                  </div>
                  <div className="workflow-node-footer">
                    <span className="workflow-node-io-tags">
                      {nodeIOMap[node.type].inputs.map((f) => (
                        <span key={`in-${f}`} className="workflow-io-tag is-input" style={{ borderColor: mediaFormatColor[f], color: mediaFormatColor[f] }}>{mediaFormatLabel[f]}</span>
                      ))}
                    </span>
                    <span className="workflow-node-io-tags">
                      {nodeIOMap[node.type].outputs.map((f) => (
                        <span key={`out-${f}`} className="workflow-io-tag is-output" style={{ background: mediaFormatColor[f] }}>{mediaFormatLabel[f]}</span>
                      ))}
                    </span>
                  </div>
                  {nodeIOMap[node.type].inputs.length > 0 && <span className="workflow-socket workflow-socket-in" style={{ background: mediaFormatColor[nodeIOMap[node.type].inputs[0]], boxShadow: `0 0 0 1px ${mediaFormatColor[nodeIOMap[node.type].inputs[0]]}` }} onMouseDown={(e) => handleSocketMouseDown(e, node.id, 'in')} />}
                  {nodeIOMap[node.type].outputs.length > 0 && <span className="workflow-socket workflow-socket-out" style={{ background: mediaFormatColor[nodeIOMap[node.type].outputs[0]], boxShadow: `0 0 0 1px ${mediaFormatColor[nodeIOMap[node.type].outputs[0]]}` }} onMouseDown={(e) => handleSocketMouseDown(e, node.id, 'out')} />}
                </button>
              )
            })}
          </div>
        </div>

        {rightPanelCollapsed ? (
          <button
            type="button"
            className="workflow-panel-dock workflow-panel-dock-right"
            onClick={() => setRightPanelCollapsed(false)}
            title="展开节点参数"
            aria-label="展开节点参数"
          >
            <SettingsRegular />
          </button>
        ) : (
          <aside className="workflow-panel workflow-inspector">
            <div className="workflow-panel-header">
              <div className="workflow-panel-header-copy">
                <h3>节点参数</h3>
                <p>这里可以编辑节点名称、参数与输出连线，应用后会同步到画布并自动保存。</p>
              </div>
              <button
                type="button"
                className="workflow-panel-collapse"
                onClick={() => setRightPanelCollapsed(true)}
                title="折叠节点参数"
                aria-label="折叠节点参数"
              >
                <ChevronRightRegular />
              </button>
            </div>

            {selectedNode ? (
              <>
                <div className="workflow-inspector-group">
                  <label>节点名称</label>
                  <Input
                    size="small"
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    disabled={isRunning}
                  />
                </div>

                <div className="workflow-inspector-grid">
                  <div className="workflow-inspector-group">
                    <label>节点类型</label>
                    <Input
                      size="small"
                      value={nodeTypeLabel[selectedNode.type]}
                      readOnly
                      style={{ borderColor: nodeTypeColor[selectedNode.type], color: nodeTypeColor[selectedNode.type] }}
                    />
                  </div>
                  <div className="workflow-inspector-group">
                    <label>状态</label>
                    <Tag color={selectedStatus === 'ready' ? 'success' : selectedStatus === 'running' ? 'warning' : 'default'}>
                      {statusText[selectedStatus]}
                    </Tag>
                  </div>
                </div>

                <div className="workflow-inspector-group">
                  <label>说明</label>
                  <Input.TextArea
                    size="small"
                    rows={2}
                    value={draft.description}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    disabled={isRunning}
                  />
                </div>

                {renderNodeFields()}

                <div className="workflow-inspector-group">
                  <label>输出连线</label>
                  <div className="workflow-link-editor">
                    <Select
                      size="small"
                      value={connectTargetId || undefined}
                      onChange={(value) => setConnectTargetId(value)}
                      disabled={isRunning || connectOptions.length === 0}
                      placeholder="没有可连接的节点"
                      options={connectOptions.map((node) => ({ value: node.id, label: node.title }))}
                      style={{ flex: 1 }}
                    />
                    <Button
                      size="small"
                      onClick={handleConnectSelectedNode}
                      disabled={isRunning || !connectTargetId}
                    >
                      添加连线
                    </Button>
                  </div>

                  <div className="workflow-link-list">
                    {selectedOutgoingTargets.length === 0 ? (
                      <span className="workflow-empty-text">暂无输出连线</span>
                    ) : (
                      selectedOutgoingTargets.map((targetNode) => (
                        <Tag
                          key={targetNode.id}
                          closable={!isRunning}
                          onClose={() => handleRemoveEdge(targetNode.id)}
                        >
                          → {targetNode.title}
                        </Tag>
                      ))
                    )}
                  </div>
                </div>

                <div className={`workflow-inspector-note ${selectedValidation?.ready ? 'is-ready' : 'is-warning'}`}>
                  {selectedValidation?.ready
                    ? '当前节点已满足执行条件。'
                    : `待完善：${selectedValidation?.issues.join('、') || '请继续配置节点参数。'}`}
                </div>

                <div className="workflow-inspector-actions">
                  <Button type="primary" size="small" onClick={handleApplyChanges} disabled={isRunning}>
                    应用更改
                  </Button>
                  <Button size="small" danger onClick={handleDeleteSelectedNode} disabled={isRunning} icon={<DeleteRegular />}>
                    删除节点
                  </Button>
                </div>
              </>
            ) : (
              <div className="workflow-empty-state">当前画布没有节点，请先从左侧节点库添加内容。</div>
            )}
          </aside>
        )}
      </section>

      <footer className="workflow-statusbar">
        <div className="workflow-statusbar-left">
          <span className={`workflow-status-dot is-${footerState.tone}`} />
          <span>{footerState.text}</span>
        </div>
        <div className="workflow-shortcut-hints">
          <span className="workflow-shortcut-key"><kbd>Ctrl</kbd>+<kbd>LMB</kbd> 平移</span>
          <span className="workflow-shortcut-key"><kbd>Scroll</kbd> 缩放</span>
          <span className="workflow-shortcut-key"><kbd>RMB</kbd> 菜单</span>
          <span className="workflow-shortcut-key"><kbd>Space</kbd> 执行</span>
          <span className="workflow-shortcut-key"><kbd>Del</kbd> 删除</span>
        </div>
        <span className="workflow-status-message">{statusMessage}</span>
      </footer>
    </div>
  )
}

export default WorkflowStudioPage
