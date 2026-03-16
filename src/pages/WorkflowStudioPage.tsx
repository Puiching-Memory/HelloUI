import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Button, Input, Select, Tag, Tooltip } from 'antd'
import {
  ArrowRightRegular,
  ChevronRightRegular,
  CopyRegular,
  DeleteRegular,
  EditRegular,
  SettingsRegular,
} from '@/ui/icons'
import {
  autoArrangeNodes,
  buildDefaultWorkflow,
  buildNodeFromDraft,
  canConnect,
  createNodeFromTemplate,
  EMPTY_DRAFT,
  getExecutionPlan,
  getNextNodeSeed,
  getNodeStatus,
  getNodeSummary,
  isWorkflowNodeType,
  loadWorkflowDocument,
  nodeIOMap,
  nodeTemplates,
  nodeToDraft,
  nodeTypeLabel,
  suggestNodePosition,
  validateNode,
  WORKFLOW_NODE_HEIGHT,
  WORKFLOW_NODE_WIDTH,
  WORKFLOW_STORAGE_KEY,
  wouldCreateCycle,
} from '@/features/workflow-studio/domain/workflowDomain'
import type { InspectorDraft, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '@/features/workflow-studio/types'
import { WorkflowInspectorFields } from '@/pages/workflow-studio/WorkflowInspectorFields'
import { WorkflowNodeLibrary } from '@/pages/workflow-studio/WorkflowNodeLibrary'
import {
  mediaFormatColor,
  mediaFormatLabel,
  nodeTypeColor,
  nodeTypeIcon,
  statusText,
} from '@/pages/workflow-studio/workflowStudioConfig'
import './WorkflowStudioPage.css'

const NODE_WIDTH = WORKFLOW_NODE_WIDTH
const NODE_HEIGHT = WORKFLOW_NODE_HEIGHT
const WORLD_MIN = -2400
const WORLD_MAX = 3200
const TEMPLATE_DRAG_MIME = 'application/x-hello-ui-node-template'
const ZOOM_MIN = 0.25
const ZOOM_MAX = 2.0
const ZOOM_STEP = 0.1
const GRID_BASE_SIZE = 20

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

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
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
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
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        nodeTypeLabel[t.type].toLowerCase().includes(q),
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
    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify({ nodes, edges }))
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
      if (!isWorkflowNodeType(droppedType)) return

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
      setDraggingNodeId(nodeId)
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
      setDraggingNodeId(null)
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

  const canvasGridStyle = useMemo<CSSProperties>(() => {
    const gridSize = GRID_BASE_SIZE * viewportScale
    return {
      backgroundPosition: `${viewportOffset.x}px ${viewportOffset.y}px`,
      backgroundSize: `${gridSize}px ${gridSize}px`,
    }
  }, [viewportOffset.x, viewportOffset.y, viewportScale])

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
            <Button
              size="small"
              onClick={() => {
                setViewportScale(1)
                setViewportOffset({ x: 0, y: 0 })
              }}
            >
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
        <WorkflowNodeLibrary
          filteredTemplates={filteredTemplates}
          isRunning={isRunning}
          leftPanelCollapsed={leftPanelCollapsed}
          nodeSearchQuery={nodeSearchQuery}
          onCollapse={() => setLeftPanelCollapsed(true)}
          onExpand={() => setLeftPanelCollapsed(false)}
          onSearchQueryChange={setNodeSearchQuery}
          onTemplateDragEnd={handleTemplateDragEnd}
          onTemplateDragStart={handleTemplateDragStart}
        />

        <div
          className={`workflow-canvas ${isPanning ? 'is-panning' : ''} ${isCanvasDragOver ? 'is-drag-over' : ''} ${isCtrlPressed && !isRunning ? 'is-pan-ready' : ''}`}
          ref={canvasRef}
          style={canvasGridStyle}
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
                    <path d={path} className="workflow-link-path" style={{ stroke: edgeColor }} />
                  </g>
                )
              })}
              {socketDrag &&
                (() => {
                  const x1 = socketDrag.side === 'out' ? socketDrag.startWorldX : socketDrag.currentX
                  const y1 = socketDrag.side === 'out' ? socketDrag.startWorldY : socketDrag.currentY
                  const x2 = socketDrag.side === 'out' ? socketDrag.currentX : socketDrag.startWorldX
                  const y2 = socketDrag.side === 'out' ? socketDrag.currentY : socketDrag.startWorldY
                  const midX = (x1 + x2) / 2
                  const path = `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`
                  return <path d={path} className="workflow-link-path is-dragging" />
                })()}
            </svg>

            {nodes.map((node) => {
              const status = getNodeStatus(node, validationMap, runningNodeId)
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`workflow-node ${node.id === selectedNodeId ? 'is-selected' : ''} ${node.id === draggingNodeId ? 'is-dragging' : ''}`}
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
                  <div
                    className="workflow-node-header"
                    style={{ '--node-color': nodeTypeColor[node.type] } as CSSProperties}
                  >
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
                        <span
                          key={`in-${f}`}
                          className="workflow-io-tag is-input"
                          style={{ borderColor: mediaFormatColor[f], color: mediaFormatColor[f] }}
                        >
                          {mediaFormatLabel[f]}
                        </span>
                      ))}
                    </span>
                    <span className="workflow-node-io-tags">
                      {nodeIOMap[node.type].outputs.map((f) => (
                        <span
                          key={`out-${f}`}
                          className="workflow-io-tag is-output"
                          style={{ background: mediaFormatColor[f] }}
                        >
                          {mediaFormatLabel[f]}
                        </span>
                      ))}
                    </span>
                  </div>
                  {nodeIOMap[node.type].inputs.length > 0 && (
                    <span
                      className="workflow-socket workflow-socket-in"
                      style={{
                        background: mediaFormatColor[nodeIOMap[node.type].inputs[0]],
                        boxShadow: `0 0 0 1px ${mediaFormatColor[nodeIOMap[node.type].inputs[0]]}`,
                      }}
                      onMouseDown={(e) => handleSocketMouseDown(e, node.id, 'in')}
                    />
                  )}
                  {nodeIOMap[node.type].outputs.length > 0 && (
                    <span
                      className="workflow-socket workflow-socket-out"
                      style={{
                        background: mediaFormatColor[nodeIOMap[node.type].outputs[0]],
                        boxShadow: `0 0 0 1px ${mediaFormatColor[nodeIOMap[node.type].outputs[0]]}`,
                      }}
                      onMouseDown={(e) => handleSocketMouseDown(e, node.id, 'out')}
                    />
                  )}
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
                    <Tag
                      color={
                        selectedStatus === 'ready' ? 'success' : selectedStatus === 'running' ? 'warning' : 'default'
                      }
                    >
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

                {selectedNode ? <WorkflowInspectorFields draft={draft} isRunning={isRunning} selectedNode={selectedNode} updateDraft={updateDraft} /> : null}

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
                    <Button size="small" onClick={handleConnectSelectedNode} disabled={isRunning || !connectTargetId}>
                      添加连线
                    </Button>
                  </div>

                  <div className="workflow-link-list">
                    {selectedOutgoingTargets.length === 0 ? (
                      <span className="workflow-empty-text">暂无输出连线</span>
                    ) : (
                      selectedOutgoingTargets.map((targetNode) => (
                        <Tag key={targetNode.id} closable={!isRunning} onClose={() => handleRemoveEdge(targetNode.id)}>
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
                  <Button
                    size="small"
                    danger
                    onClick={handleDeleteSelectedNode}
                    disabled={isRunning}
                    icon={<DeleteRegular />}
                  >
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
          <span className="workflow-shortcut-key">
            <kbd>Ctrl</kbd>+<kbd>LMB</kbd> 平移
          </span>
          <span className="workflow-shortcut-key">
            <kbd>Scroll</kbd> 缩放
          </span>
          <span className="workflow-shortcut-key">
            <kbd>RMB</kbd> 菜单
          </span>
          <span className="workflow-shortcut-key">
            <kbd>Space</kbd> 执行
          </span>
          <span className="workflow-shortcut-key">
            <kbd>Del</kbd> 删除
          </span>
        </div>
        <span className="workflow-status-message">{statusMessage}</span>
      </footer>
    </div>
  )
}

export default WorkflowStudioPage


