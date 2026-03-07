import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { Body1 } from '@/ui/components'
import {
  ArrowRightRegular,
  CheckmarkCircleFilled,
  ChevronLeftRegular,
  ChevronRightRegular,
  CopyRegular,
  DeleteRegular,
  EditRegular,
  GridRegular,
  ImageRegular,
  SettingsRegular,
  VideoClipRegular,
  ZoomInRegular,
} from '@/ui/icons'
import './WorkflowStudioPage.css'

type WorkflowNodeType = 'text2image' | 'imageEdit' | 'videoGen' | 'upscale' | 'sampler' | 'saveOutput' | 'paramMerge'

type WorkflowNodeStatus = 'ready' | 'running' | 'idle'

type WorkflowNodeConfig = {
  prompt?: string
  negativePrompt?: string
  model?: string
  steps?: number
  cfgScale?: number
  sourceName?: string
  strength?: number
  mode?: string
  duration?: number
  fps?: number
  scale?: number
  upscaler?: string
  sharpen?: boolean
  outputName?: string
  format?: string
  mergeStrategy?: string
  mergeFields?: string
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
  prompt: string
  negativePrompt: string
  model: string
  steps: string
  cfgScale: string
  sourceName: string
  strength: string
  mode: string
  duration: string
  fps: string
  scale: string
  upscaler: string
  sharpen: boolean
  outputName: string
  format: string
  mergeStrategy: string
  mergeFields: string
}

const STORAGE_KEY = 'hello-ui-workflow-studio-v1'
const NODE_WIDTH = 228
const NODE_HEIGHT = 132
const WORLD_MIN = -2400
const WORLD_MAX = 3200
const TEMPLATE_DRAG_MIME = 'application/x-hello-ui-node-template'

const EMPTY_DRAFT: InspectorDraft = {
  title: '',
  description: '',
  prompt: '',
  negativePrompt: '',
  model: '',
  steps: '',
  cfgScale: '',
  sourceName: '',
  strength: '',
  mode: 'inpaint',
  duration: '',
  fps: '',
  scale: '',
  upscaler: '',
  sharpen: true,
  outputName: '',
  format: 'png',
  mergeStrategy: '覆盖优先',
  mergeFields: 'prompt, steps, cfgScale',
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'text2image',
    title: '文生图',
    description: '输入提示词，生成基础图像。',
    config: {
      prompt: 'cinematic portrait of a traveler, teal and gold lighting',
      negativePrompt: 'blurry, noisy, low quality',
      model: 'flux-dev',
    },
  },
  {
    type: 'sampler',
    title: '采样器',
    description: '控制模型、步数和 CFG 等采样参数。',
    config: {
      model: 'flux-dev',
      steps: 28,
      cfgScale: 6.5,
    },
  },
  {
    type: 'imageEdit',
    title: '图片编辑',
    description: '对已有素材做局部重绘或风格迁移。',
    config: {
      sourceName: '',
      mode: 'inpaint',
      strength: 0.42,
      prompt: 'repair the face and costume details',
    },
  },
  {
    type: 'videoGen',
    title: '视频生成',
    description: '把图像扩展为短视频片段。',
    config: {
      sourceName: '',
      duration: 4,
      fps: 16,
      prompt: 'slow dolly in camera motion',
    },
  },
  {
    type: 'upscale',
    title: '图像超分',
    description: '放大输出结果并做锐化增强。',
    config: {
      scale: 2,
      upscaler: 'ESRGAN',
      sharpen: true,
    },
  },
  {
    type: 'paramMerge',
    title: '参数合并器',
    description: '统一 prompt、步数和输出策略。',
    config: {
      mergeStrategy: '覆盖优先',
      mergeFields: 'prompt, steps, cfgScale',
    },
  },
  {
    type: 'saveOutput',
    title: '输出保存',
    description: '将结果写入文件并记录元数据。',
    config: {
      outputName: 'workflow-output',
      format: 'png',
    },
  },
]

const templateMap = Object.fromEntries(nodeTemplates.map((template) => [template.type, template])) as Record<
  WorkflowNodeType,
  NodeTemplate
>

const nodeTypeLabel: Record<WorkflowNodeType, string> = {
  text2image: '文生图',
  imageEdit: '图片编辑',
  videoGen: '视频生成',
  upscale: '图像超分',
  sampler: '采样器',
  saveOutput: '输出保存',
  paramMerge: '参数合并器',
}

const nodeTypeIcon: Record<WorkflowNodeType, ReactNode> = {
  text2image: <ImageRegular />,
  imageEdit: <EditRegular />,
  videoGen: <VideoClipRegular />,
  upscale: <ZoomInRegular />,
  sampler: <GridRegular />,
  saveOutput: <CheckmarkCircleFilled />,
  paramMerge: <SettingsRegular />,
}

const statusText: Record<WorkflowNodeStatus, string> = {
  ready: '就绪',
  running: '运行中',
  idle: '待配置',
}

const validNodeTypes = new Set<WorkflowNodeType>([
  'text2image',
  'imageEdit',
  'videoGen',
  'upscale',
  'sampler',
  'saveOutput',
  'paramMerge',
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
      createNodeFromTemplate('node-1', 'text2image', 72, 84, {
        title: '提示词输入',
        description: '负责输入基础提示词与反向提示词。',
      }),
      createNodeFromTemplate('node-2', 'sampler', 344, 96, {
        title: '模型采样',
        description: '统一设置模型、步数和 CFG。',
      }),
      createNodeFromTemplate('node-3', 'imageEdit', 632, 88, {
        title: '局部重绘',
        description: '需要绑定输入素材后才可执行。',
      }),
      createNodeFromTemplate('node-4', 'videoGen', 632, 272, {
        title: '视频拼接',
        description: '将静帧扩展为短视频镜头。',
      }),
      createNodeFromTemplate('node-5', 'upscale', 344, 286, {
        title: '图像超分',
        description: '在出图后做分辨率增强。',
      }),
      createNodeFromTemplate('node-6', 'saveOutput', 920, 180, {
        title: '输出保存',
        description: '把结果写入图库并保留参数快照。',
      }),
    ],
    edges: [
      { from: 'node-1', to: 'node-2' },
      { from: 'node-2', to: 'node-3' },
      { from: 'node-2', to: 'node-5' },
      { from: 'node-3', to: 'node-6' },
      { from: 'node-4', to: 'node-6' },
      { from: 'node-5', to: 'node-6' },
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
  const seen = new Set<string>()

  return values.flatMap((value) => {
    if (!isRecord(value) || typeof value.from !== 'string' || typeof value.to !== 'string') return []
    if (!ids.has(value.from) || !ids.has(value.to) || value.from === value.to) return []

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
    prompt: node.config.prompt ?? '',
    negativePrompt: node.config.negativePrompt ?? '',
    model: node.config.model ?? '',
    steps: node.config.steps?.toString() ?? '',
    cfgScale: node.config.cfgScale?.toString() ?? '',
    sourceName: node.config.sourceName ?? '',
    strength: node.config.strength?.toString() ?? '',
    mode: node.config.mode ?? 'inpaint',
    duration: node.config.duration?.toString() ?? '',
    fps: node.config.fps?.toString() ?? '',
    scale: node.config.scale?.toString() ?? '',
    upscaler: node.config.upscaler ?? '',
    sharpen: node.config.sharpen ?? true,
    outputName: node.config.outputName ?? '',
    format: node.config.format ?? 'png',
    mergeStrategy: node.config.mergeStrategy ?? '覆盖优先',
    mergeFields: node.config.mergeFields ?? 'prompt, steps, cfgScale',
  }
}

const buildNodeFromDraft = (node: WorkflowNode, draft: InspectorDraft): WorkflowNode => {
  return {
    ...node,
    title: draft.title.trim() || templateMap[node.type].title,
    description: draft.description.trim(),
    config: {
      ...node.config,
      prompt: draft.prompt.trim(),
      negativePrompt: draft.negativePrompt.trim(),
      model: draft.model.trim(),
      steps: parseOptionalNumber(draft.steps),
      cfgScale: parseOptionalNumber(draft.cfgScale),
      sourceName: draft.sourceName.trim(),
      strength: parseOptionalNumber(draft.strength),
      mode: draft.mode,
      duration: parseOptionalNumber(draft.duration),
      fps: parseOptionalNumber(draft.fps),
      scale: parseOptionalNumber(draft.scale),
      upscaler: draft.upscaler.trim(),
      sharpen: draft.sharpen,
      outputName: draft.outputName.trim(),
      format: draft.format,
      mergeStrategy: draft.mergeStrategy,
      mergeFields: draft.mergeFields.trim(),
    },
  }
}

const validateNode = (node: WorkflowNode): NodeValidation => {
  const issues: string[] = []

  switch (node.type) {
    case 'text2image':
      if (!node.config.prompt?.trim()) issues.push('缺少提示词')
      if (!node.config.model?.trim()) issues.push('未选择模型')
      break
    case 'sampler':
      if (!node.config.model?.trim()) issues.push('未选择采样模型')
      if (!node.config.steps || node.config.steps <= 0) issues.push('采样步数需大于 0')
      break
    case 'imageEdit':
      if (!node.config.sourceName?.trim()) issues.push('未绑定输入素材')
      if (!node.config.mode?.trim()) issues.push('未选择编辑模式')
      break
    case 'videoGen':
      if (!node.config.sourceName?.trim()) issues.push('未绑定视频来源')
      if (!node.config.duration || node.config.duration <= 0) issues.push('时长需大于 0')
      if (!node.config.fps || node.config.fps <= 0) issues.push('fps 需大于 0')
      break
    case 'upscale':
      if (!node.config.scale || node.config.scale <= 0) issues.push('超分倍率需大于 0')
      if (!node.config.upscaler?.trim()) issues.push('未填写超分模型')
      break
    case 'saveOutput':
      if (!node.config.outputName?.trim()) issues.push('未设置输出文件名')
      break
    case 'paramMerge':
      if (!node.config.mergeStrategy?.trim()) issues.push('未选择合并策略')
      if (!node.config.mergeFields?.trim()) issues.push('未填写合并字段')
      break
    default:
      break
  }

  return { ready: issues.length === 0, issues }
}

const getNodeSummary = (node: WorkflowNode) => {
  switch (node.type) {
    case 'text2image':
      return `${shortText(node.config.prompt)} · ${node.config.model || '未选择模型'}`
    case 'sampler':
      return `${node.config.model || '未选择模型'} · ${node.config.steps ?? '?'} steps · CFG ${node.config.cfgScale ?? '?'}`
    case 'imageEdit':
      return `${node.config.sourceName || '未绑定素材'} · ${node.config.mode || '未选模式'} · 强度 ${node.config.strength ?? '?'}`
    case 'videoGen':
      return `${node.config.sourceName || '未绑定素材'} · ${node.config.duration ?? '?'}s · ${node.config.fps ?? '?'} fps`
    case 'upscale':
      return `${node.config.scale ?? '?'}x · ${node.config.upscaler || '未选择模型'} · ${node.config.sharpen ? '锐化' : '标准'}`
    case 'saveOutput':
      return `${node.config.outputName || '未命名'} · ${node.config.format || 'png'}`
    case 'paramMerge':
      return `${node.config.mergeStrategy || '未选策略'} · ${shortText(node.config.mergeFields, 24)}`
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
  const [isPanning, setIsPanning] = useState(false)
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false)
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null)
  const [statusMessage, setStatusMessage] = useState(
    loadResultRef.current.restored
      ? '已恢复上次编辑的工作流草稿。'
      : '拖入左侧模板或在画布中右键添加节点，按住 Ctrl 可平移视角。',
  )

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

  const incomingCounts = useMemo(() => {
    const map = new Map(nodes.map((node) => [node.id, 0]))
    edges.forEach((edge) => map.set(edge.to, (map.get(edge.to) ?? 0) + 1))
    return map
  }, [edges, nodes])

  const outgoingCounts = useMemo(() => {
    const map = new Map(nodes.map((node) => [node.id, 0]))
    edges.forEach((edge) => map.set(edge.from, (map.get(edge.from) ?? 0) + 1))
    return map
  }, [edges, nodes])

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
          worldX: -viewportOffset.x,
          worldY: -viewportOffset.y,
          width: 0,
          height: 0,
        }
      }

      const canvasX = clientX - rect.left
      const canvasY = clientY - rect.top

      return {
        canvasX,
        canvasY,
        worldX: canvasX - viewportOffset.x,
        worldY: canvasY - viewportOffset.y,
        width: rect.width,
        height: rect.height,
      }
    },
    [viewportOffset.x, viewportOffset.y],
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
            x: clamp(Math.round(options.worldX - NODE_WIDTH / 2), WORLD_MIN, WORLD_MAX),
            y: clamp(Math.round(options.worldY - NODE_HEIGHT / 2), WORLD_MIN, WORLD_MAX),
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

    if (wouldCreateCycle(edges, selectedNode.id, connectTargetId)) {
      setStatusMessage('该连线会形成循环依赖，请调整目标节点。')
      return
    }

    const targetNode = nodeMap.get(connectTargetId)
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

  const handleResetWorkflow = useCallback(() => {
    runTokenRef.current += 1
    setIsRunning(false)
    setRunningNodeId(null)
    setRunProgress({ current: 0, total: 0 })
    setLastRunAt(null)
    setViewportOffset({ x: 0, y: 0 })
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

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
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

      const nextX = clamp(dragState.originX + deltaX, WORLD_MIN, WORLD_MAX)
      const nextY = clamp(dragState.originY + deltaY, WORLD_MIN, WORLD_MAX)

      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === dragState.nodeId ? { ...node, x: nextX, y: nextY } : node)),
      )
    }

    const handleMouseUp = () => {
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
      case 'text2image':
        return (
          <>
            <div className="workflow-inspector-group">
              <label>正向提示词</label>
              <textarea
                value={draft.prompt}
                onChange={(event) => updateDraft({ prompt: event.target.value })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-group">
              <label>反向提示词</label>
              <textarea
                value={draft.negativePrompt}
                onChange={(event) => updateDraft({ negativePrompt: event.target.value })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>模型</label>
                <input
                  value={draft.model}
                  onChange={(event) => updateDraft({ model: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
          </>
        )
      case 'sampler':
        return (
          <div className="workflow-inspector-grid">
            <div className="workflow-inspector-group">
              <label>模型</label>
              <input
                value={draft.model}
                onChange={(event) => updateDraft({ model: event.target.value })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-group">
              <label>采样步数</label>
              <input
                value={draft.steps}
                onChange={(event) => updateDraft({ steps: event.target.value })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-group">
              <label>CFG Scale</label>
              <input
                value={draft.cfgScale}
                onChange={(event) => updateDraft({ cfgScale: event.target.value })}
                disabled={isRunning}
              />
            </div>
          </div>
        )
      case 'imageEdit':
        return (
          <>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>输入素材</label>
                <input
                  value={draft.sourceName}
                  onChange={(event) => updateDraft({ sourceName: event.target.value })}
                  disabled={isRunning}
                  placeholder="例如：portrait_base.png"
                />
              </div>
              <div className="workflow-inspector-group">
                <label>模式</label>
                <select
                  value={draft.mode}
                  onChange={(event) => updateDraft({ mode: event.target.value })}
                  disabled={isRunning}
                >
                  <option value="inpaint">Inpaint</option>
                  <option value="outpaint">Outpaint</option>
                  <option value="style-transfer">风格迁移</option>
                </select>
              </div>
              <div className="workflow-inspector-group">
                <label>重绘强度</label>
                <input
                  value={draft.strength}
                  onChange={(event) => updateDraft({ strength: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="workflow-inspector-group">
              <label>编辑说明</label>
              <textarea
                value={draft.prompt}
                onChange={(event) => updateDraft({ prompt: event.target.value })}
                disabled={isRunning}
              />
            </div>
          </>
        )
      case 'videoGen':
        return (
          <>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>输入素材</label>
                <input
                  value={draft.sourceName}
                  onChange={(event) => updateDraft({ sourceName: event.target.value })}
                  disabled={isRunning}
                  placeholder="例如：hero_frame.png"
                />
              </div>
              <div className="workflow-inspector-group">
                <label>时长（秒）</label>
                <input
                  value={draft.duration}
                  onChange={(event) => updateDraft({ duration: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>FPS</label>
                <input
                  value={draft.fps}
                  onChange={(event) => updateDraft({ fps: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="workflow-inspector-group">
              <label>镜头运动描述</label>
              <textarea
                value={draft.prompt}
                onChange={(event) => updateDraft({ prompt: event.target.value })}
                disabled={isRunning}
              />
            </div>
          </>
        )
      case 'upscale':
        return (
          <>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>超分倍率</label>
                <input
                  value={draft.scale}
                  onChange={(event) => updateDraft({ scale: event.target.value })}
                  disabled={isRunning}
                />
              </div>
              <div className="workflow-inspector-group">
                <label>超分模型</label>
                <input
                  value={draft.upscaler}
                  onChange={(event) => updateDraft({ upscaler: event.target.value })}
                  disabled={isRunning}
                />
              </div>
            </div>
            <label className="workflow-checkbox">
              <input
                type="checkbox"
                checked={draft.sharpen}
                onChange={(event) => updateDraft({ sharpen: event.target.checked })}
                disabled={isRunning}
              />
              <span>启用锐化增强</span>
            </label>
          </>
        )
      case 'saveOutput':
        return (
          <div className="workflow-inspector-grid">
            <div className="workflow-inspector-group">
              <label>输出文件名</label>
              <input
                value={draft.outputName}
                onChange={(event) => updateDraft({ outputName: event.target.value })}
                disabled={isRunning}
              />
            </div>
            <div className="workflow-inspector-group">
              <label>格式</label>
              <select
                value={draft.format}
                onChange={(event) => updateDraft({ format: event.target.value })}
                disabled={isRunning}
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WEBP</option>
              </select>
            </div>
          </div>
        )
      case 'paramMerge':
        return (
          <>
            <div className="workflow-inspector-grid">
              <div className="workflow-inspector-group">
                <label>合并策略</label>
                <select
                  value={draft.mergeStrategy}
                  onChange={(event) => updateDraft({ mergeStrategy: event.target.value })}
                  disabled={isRunning}
                >
                  <option value="覆盖优先">覆盖优先</option>
                  <option value="追加合并">追加合并</option>
                  <option value="仅保留共享字段">仅保留共享字段</option>
                </select>
              </div>
            </div>
            <div className="workflow-inspector-group">
              <label>合并字段</label>
              <textarea
                value={draft.mergeFields}
                onChange={(event) => updateDraft({ mergeFields: event.target.value })}
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
    <div className="workflow-page pencil-page">
      <header className="pencil-page-header">
        <div className="pencil-page-title-row">
          <h1 className="pencil-page-title">节点工作台</h1>
          <span className="pencil-page-kicker">COMFY-LIKE NODE EDITOR</span>
        </div>
        <p className="pencil-page-description">
          现在这个页面已经不是静态样板：可以添加节点、编辑参数、管理连线、拖拽布局，并模拟串行执行整条工作流。
        </p>
      </header>

      <div className="workflow-toolbar">
        <div className="workflow-toolbar-meta">
          <span className="workflow-badge">自动保存到本地草稿</span>
          <span className="workflow-toolbar-note">{lastRunAt ? `上次执行：${lastRunAt}` : '未执行'}</span>
        </div>
        <div className="workflow-toolbar-actions">
          <button
            type="button"
            className="workflow-btn workflow-btn-secondary"
            onClick={handleResetWorkflow}
            disabled={isRunning}
          >
            重置示例
          </button>
          <button
            type="button"
            className="workflow-btn workflow-btn-primary"
            onClick={() => void runWorkflow()}
            disabled={isRunning}
          >
            <ArrowRightRegular />
            {isRunning ? '执行中…' : '执行工作流'}
          </button>
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
                <p>左侧模板不再支持点击添加，只能拖到画布中创建；按住 Ctrl 可拖动画布，右键可打开节点菜单。</p>
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

            <div className="workflow-node-list">
              {nodeTemplates.map((template) => (
                <div
                  key={template.type}
                  className="workflow-node-template"
                  draggable={!isRunning}
                  onDragStart={(event) => handleTemplateDragStart(event, template.type)}
                  onDragEnd={handleTemplateDragEnd}
                >
                  <span className="workflow-node-template-icon">{nodeTypeIcon[template.type]}</span>
                  <span className="workflow-node-template-copy">
                    <strong>{template.title}</strong>
                    <span>{template.description}</span>
                    <span className="workflow-node-template-action">拖入画布添加</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="workflow-queue">
              <div className="workflow-queue-header">
                <h4>执行队列</h4>
                <span>{executionPlan.orderedIds.length} 步</span>
              </div>

              {executionPlan.orderedIds.length === 0 ? (
                <Body1>当前画布还没有可执行节点。</Body1>
              ) : (
                executionPlan.orderedIds.map((nodeId, index) => {
                  const node = nodeMap.get(nodeId)
                  if (!node) return null

                  const status = getNodeStatus(node, validationMap, runningNodeId)
                  return (
                    <div key={nodeId} className={`workflow-queue-item is-${status}`}>
                      <span className="workflow-queue-index">{index + 1}</span>
                      <div className="workflow-queue-copy">
                        <strong>{node.title}</strong>
                        <span>{nodeTypeLabel[node.type]}</span>
                      </div>
                      <span className={`workflow-inline-status is-${status}`}>{statusText[status]}</span>
                    </div>
                  )
                })
              )}

              {executionPlan.hasCycle ? (
                <div className="workflow-warning">
                  检测到循环依赖：
                  {executionPlan.unresolvedIds.map((nodeId) => nodeMap.get(nodeId)?.title ?? nodeId).join('、')}
                </div>
              ) : null}
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
          <div className="workflow-canvas-hint">
            按住 Ctrl + 左键可平移视角，右键打开节点菜单，左侧节点拖入场景添加。
          </div>

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
            style={{ transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)` }}
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
                return <path key={`${edge.from}-${edge.to}`} d={path} className="workflow-link-path" />
              })}
            </svg>

            {nodes.map((node) => {
              const status = getNodeStatus(node, validationMap, runningNodeId)
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`workflow-node ${node.id === selectedNodeId ? 'is-selected' : ''}`}
                  style={{ left: node.x, top: node.y }}
                  onClick={(event) => {
                    if (event.ctrlKey || suppressClickRef.current) return
                    setSelectedNodeId(node.id)
                  }}
                  onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                  onContextMenu={(event) => handleNodeContextMenu(event, node.id)}
                  data-node-id={node.id}
                  disabled={isRunning}
                >
                  <div className="workflow-node-head">
                    <span className="workflow-node-icon">{nodeTypeIcon[node.type]}</span>
                    <span>{node.title}</span>
                  </div>
                  <p>{getNodeSummary(node)}</p>
                  <div className="workflow-node-footer">
                    <div className={`workflow-node-status is-${status}`}>{statusText[status]}</div>
                    <span className="workflow-node-metrics">
                      {incomingCounts.get(node.id) ?? 0} 入 / {outgoingCounts.get(node.id) ?? 0} 出
                    </span>
                  </div>
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
                  <input
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    disabled={isRunning}
                  />
                </div>

                <div className="workflow-inspector-grid">
                  <div className="workflow-inspector-group">
                    <label>节点类型</label>
                    <input value={nodeTypeLabel[selectedNode.type]} readOnly />
                  </div>
                  <div className="workflow-inspector-group">
                    <label>状态</label>
                    <input value={statusText[selectedStatus]} readOnly />
                  </div>
                </div>

                <div className="workflow-inspector-group">
                  <label>说明</label>
                  <textarea
                    value={draft.description}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    disabled={isRunning}
                  />
                </div>

                {renderNodeFields()}

                <div className="workflow-inspector-group">
                  <label>输出连线</label>
                  <div className="workflow-link-editor">
                    <select
                      value={connectTargetId}
                      onChange={(event) => setConnectTargetId(event.target.value)}
                      disabled={isRunning || connectOptions.length === 0}
                    >
                      {connectOptions.length === 0 ? <option value="">没有可连接的节点</option> : null}
                      {connectOptions.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="workflow-btn workflow-btn-secondary"
                      onClick={handleConnectSelectedNode}
                      disabled={isRunning || !connectTargetId}
                    >
                      添加连线
                    </button>
                  </div>

                  <div className="workflow-link-list">
                    {selectedOutgoingTargets.length === 0 ? (
                      <span className="workflow-empty-text">暂无输出连线</span>
                    ) : (
                      selectedOutgoingTargets.map((targetNode) => (
                        <button
                          key={targetNode.id}
                          type="button"
                          className="workflow-link-chip"
                          onClick={() => handleRemoveEdge(targetNode.id)}
                          disabled={isRunning}
                        >
                          断开 → {targetNode.title}
                        </button>
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
                  <button
                    type="button"
                    className="workflow-btn workflow-btn-primary"
                    onClick={handleApplyChanges}
                    disabled={isRunning}
                  >
                    应用更改
                  </button>
                  <button
                    type="button"
                    className="workflow-btn workflow-btn-secondary workflow-btn-danger"
                    onClick={handleDeleteSelectedNode}
                    disabled={isRunning}
                  >
                    <DeleteRegular />
                    删除节点
                  </button>
                </div>
              </>
            ) : (
              <div className="workflow-empty-state">当前画布没有节点，请先从左侧节点库添加内容。</div>
            )}
          </aside>
        )}
      </section>

      <footer className="pencil-page-statusbar">
        <div className="pencil-page-status-main">
          <span className={`pencil-page-status-dot workflow-status-dot is-${footerState.tone}`} />
          {footerState.text}
          <span className="workflow-status-message">· {statusMessage}</span>
        </div>
        <button
          type="button"
          className="workflow-btn workflow-btn-secondary"
          onClick={() => void runWorkflow()}
          disabled={isRunning}
        >
          [ Space ] {isRunning ? '执行中…' : '运行当前图'}
        </button>
      </footer>
    </div>
  )
}

export default WorkflowStudioPage
