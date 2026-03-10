import type {
  InspectorDraft,
  MediaFormat,
  NodeTemplate,
  NodeValidation,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowLoadResult,
  WorkflowNode,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../types'

export const WORKFLOW_STORAGE_KEY = 'hello-ui-workflow-studio-v1'
export const WORKFLOW_NODE_WIDTH = 228
export const WORKFLOW_NODE_HEIGHT = 132

export const EMPTY_DRAFT: InspectorDraft = {
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

export const nodeTemplates: NodeTemplate[] = [
  { type: 'checkpoint', title: '模型加载', description: '加载 Stable Diffusion 模型权重文件。', config: { modelPath: '' } },
  { type: 'lora', title: 'LoRA', description: '指定 LoRA 模型目录，应用微调权重。', config: { loraModelDir: '' } },
  { type: 'prompt', title: '提示词', description: '配置正向和反向提示词。', config: { prompt: '', negativePrompt: '' } },
  { type: 'imageInput', title: '图像输入', description: '加载初始图像或遮罩，用于图生图。', config: { initImage: '', strength: 0.75 } },
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
  { type: 'output', title: '输出保存', description: '设置输出文件路径和预览路径。', config: { outputPath: './output.png' } },
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

export const nodeTypeLabel: Record<WorkflowNodeType, string> = {
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

export const nodeIOMap: Record<WorkflowNodeType, { inputs: MediaFormat[]; outputs: MediaFormat[] }> = {
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

export function isWorkflowNodeType(value: string): value is WorkflowNodeType {
  return validNodeTypes.has(value as WorkflowNodeType)
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

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

export function createNodeFromTemplate(
  id: string,
  type: WorkflowNodeType,
  x: number,
  y: number,
  overrides: Partial<Omit<WorkflowNode, 'id' | 'type' | 'x' | 'y'>> = {},
): WorkflowNode {
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

export function buildDefaultWorkflow(): WorkflowDocument {
  return {
    nodes: [
      createNodeFromTemplate('node-1', 'checkpoint', 60, 140),
      createNodeFromTemplate('node-2', 'prompt', 60, 340),
      createNodeFromTemplate('node-3', 'generate', 400, 200),
      createNodeFromTemplate('node-4', 'output', 740, 200),
    ],
    edges: [
      { from: 'node-1', to: 'node-3' },
      { from: 'node-2', to: 'node-3' },
      { from: 'node-3', to: 'node-4' },
    ],
  }
}

export function sanitizeNode(value: unknown, index: number): WorkflowNode | null {
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
    config: isRecord(value.config) ? { ...value.config } : {},
  }
}

export function sanitizeEdges(nodes: WorkflowNode[], values: unknown[]): WorkflowEdge[] {
  const ids = new Set(nodes.map((node) => node.id))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
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

export function loadWorkflowDocument(): WorkflowLoadResult {
  const fallback = buildDefaultWorkflow()
  if (typeof window === 'undefined') return { ...fallback, restored: false }

  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY)
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

export function getNextNodeSeed(nodes: WorkflowNode[]): number {
  return (
    nodes.reduce((maxValue, node) => {
      const matched = node.id.match(/(?:node-|n)(\d+)$/)
      const nextValue = matched ? Number(matched[1]) : 0
      return Number.isFinite(nextValue) ? Math.max(maxValue, nextValue) : maxValue
    }, 0) + 1
  )
}

export function nodeToDraft(node: WorkflowNode | null): InspectorDraft {
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

export function buildNodeFromDraft(node: WorkflowNode, draft: InspectorDraft): WorkflowNode {
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

export function validateNode(node: WorkflowNode): NodeValidation {
  const issues: string[] = []

  switch (node.type) {
    case 'checkpoint':
      if (!node.config.modelPath?.trim() && !node.config.diffusionModel?.trim()) issues.push('需指定 --model 或 --diffusion-model')
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
  }

  return { ready: issues.length === 0, issues }
}

export function getNodeSummary(node: WorkflowNode): string {
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
  }
}

export function suggestNodePosition(nodes: WorkflowNode[], anchor: WorkflowNode | null): { x: number; y: number } {
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

export function autoArrangeNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (nodes.length === 0) return nodes

  const adjacency = new Map<string, string[]>()
  const reverseAdj = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  nodes.forEach((node) => {
    adjacency.set(node.id, [])
    reverseAdj.set(node.id, [])
    indegree.set(node.id, 0)
  })

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to)
    reverseAdj.get(edge.to)?.push(edge.from)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  })

  const layer = new Map<string, number>()
  const visited = new Set<string>()
  const dfs = (id: string): number => {
    if (layer.has(id)) return layer.get(id) ?? 0
    if (visited.has(id)) return 0
    visited.add(id)
    let maxChild = -1
    for (const child of adjacency.get(id) ?? []) {
      maxChild = Math.max(maxChild, dfs(child))
    }
    const nextLayer = maxChild + 1
    layer.set(id, nextLayer)
    return nextLayer
  }

  const roots = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0)
  if (roots.length === 0) roots.push(nodes[0])

  nodes.forEach((node) => dfs(node.id))
  const maxLayer = Math.max(...Array.from(layer.values()), 0)
  layer.forEach((value, key) => layer.set(key, maxLayer - value))

  const columns = new Map<number, string[]>()
  layer.forEach((value, id) => {
    if (!columns.has(value)) columns.set(value, [])
    columns.get(value)?.push(id)
  })
  const sortedLayers = Array.from(columns.keys()).sort((a, b) => a - b)

  const positionInLayer = new Map<string, number>()
  const firstLayer = columns.get(sortedLayers[0]) ?? []
  firstLayer.forEach((id, index) => positionInLayer.set(id, index))

  for (let layerIndex = 1; layerIndex < sortedLayers.length; layerIndex++) {
    const column = columns.get(sortedLayers[layerIndex]) ?? []
    const barycenter = column.map((id) => {
      const parents = (reverseAdj.get(id) ?? []).filter((parent) => positionInLayer.has(parent))
      if (parents.length === 0) return { id, score: Infinity }
      const average = parents.reduce((sum, parent) => sum + (positionInLayer.get(parent) ?? 0), 0) / parents.length
      return { id, score: average }
    })

    barycenter.sort((a, b) => a.score - b.score)
    const sorted = barycenter.map((item) => item.id)
    columns.set(sortedLayers[layerIndex], sorted)
    sorted.forEach((id, index) => positionInLayer.set(id, index))
  }

  const horizontalGap = 280
  const verticalGap = 48
  const startX = 60
  const startY = 60
  const positionMap = new Map<string, { x: number; y: number }>()

  sortedLayers.forEach((layerId) => {
    const column = columns.get(layerId) ?? []
    column.forEach((id, rowIndex) => {
      positionMap.set(id, { x: startX + layerId * horizontalGap, y: startY + rowIndex * (WORKFLOW_NODE_HEIGHT + verticalGap) })
    })
  })

  for (let pass = 0; pass < 4; pass++) {
    for (let layerIndex = 1; layerIndex < sortedLayers.length; layerIndex++) {
      const column = columns.get(sortedLayers[layerIndex]) ?? []
      for (const id of column) {
        const parents = (reverseAdj.get(id) ?? []).filter((parent) => positionMap.has(parent))
        if (parents.length === 0) continue
        const averageY = parents.reduce((sum, parent) => sum + (positionMap.get(parent)?.y ?? 0), 0) / parents.length
        const current = positionMap.get(id)
        if (!current) continue
        positionMap.set(id, { x: current.x, y: averageY })
      }
    }

    for (const layerId of sortedLayers) {
      const column = columns.get(layerId) ?? []
      const sorted = column.slice().sort((a, b) => (positionMap.get(a)?.y ?? 0) - (positionMap.get(b)?.y ?? 0))
      for (let index = 1; index < sorted.length; index++) {
        const previous = positionMap.get(sorted[index - 1])
        const current = positionMap.get(sorted[index])
        if (!previous || !current) continue
        const minY = previous.y + WORKFLOW_NODE_HEIGHT + verticalGap
        if (current.y < minY) {
          positionMap.set(sorted[index], { x: current.x, y: minY })
        }
      }
    }
  }

  return nodes.map((node) => {
    const position = positionMap.get(node.id)
    return position ? { ...node, x: position.x, y: position.y } : node
  })
}

export function getExecutionPlan(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
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

export function wouldCreateCycle(edges: WorkflowEdge[], from: string, to: string): boolean {
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

export function canConnect(fromType: WorkflowNodeType, toType: WorkflowNodeType): boolean {
  const outputs = nodeIOMap[fromType].outputs
  const inputs = nodeIOMap[toType].inputs
  if (outputs.length === 0 || inputs.length === 0) return false
  return outputs.some((format) => inputs.includes(format))
}

export function getNodeStatus(
  node: WorkflowNode,
  validationMap: Map<string, NodeValidation>,
  runningNodeId: string | null,
): WorkflowNodeStatus {
  if (node.id === runningNodeId) return 'running'
  return validationMap.get(node.id)?.ready ? 'ready' : 'idle'
}
