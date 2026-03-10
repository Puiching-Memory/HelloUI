import {
  autoArrangeNodes,
  buildDefaultWorkflow,
  buildNodeFromDraft,
  getExecutionPlan,
  getNextNodeSeed,
  loadWorkflowDocument,
  nodeToDraft,
  validateNode,
  WORKFLOW_STORAGE_KEY,
  wouldCreateCycle,
} from './workflowDomain'

describe('workflow domain', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('builds a valid default workflow', () => {
    const document = buildDefaultWorkflow()

    expect(document.nodes).toHaveLength(4)
    expect(document.edges).toHaveLength(3)
    expect(getNextNodeSeed(document.nodes)).toBe(5)
  })

  it('restores and sanitizes persisted workflow data', () => {
    window.localStorage.setItem(
      WORKFLOW_STORAGE_KEY,
      JSON.stringify({
        nodes: [
          { id: 'node-1', title: 'Prompt', type: 'prompt', x: 10, y: 20, description: '', config: { prompt: 'hello' } },
          { id: 'node-2', title: 'Generate', type: 'generate', x: 100, y: 20, description: '', config: { steps: 20 } },
        ],
        edges: [
          { from: 'node-1', to: 'node-2' },
          { from: 'node-2', to: 'node-1' },
          { from: 'missing', to: 'node-1' },
        ],
      }),
    )

    const restored = loadWorkflowDocument()

    expect(restored.restored).toBe(true)
    expect(restored.nodes).toHaveLength(2)
    expect(restored.edges).toEqual([{ from: 'node-1', to: 'node-2' }])
  })

  it('validates nodes and round-trips draft edits', () => {
    const document = buildDefaultWorkflow()
    const checkpoint = document.nodes[0]
    const draft = nodeToDraft(checkpoint)
    const updated = buildNodeFromDraft(checkpoint, { ...draft, modelPath: 'foo.safetensors' })

    expect(validateNode(updated).ready).toBe(true)
    expect(validateNode({ ...updated, config: { ...updated.config, modelPath: '' } }).ready).toBe(false)
  })

  it('detects cycles and builds execution order', () => {
    const document = buildDefaultWorkflow()
    const plan = getExecutionPlan(document.nodes, document.edges)

    expect(plan.hasCycle).toBe(false)
    expect(plan.orderedIds[0]).toBe('node-1')
    expect(wouldCreateCycle(document.edges, 'node-4', 'node-1')).toBe(true)
  })

  it('auto-arranges nodes left-to-right by dependency depth', () => {
    const document = buildDefaultWorkflow()
    const arranged = autoArrangeNodes(document.nodes, document.edges)
    const checkpoint = arranged.find((node) => node.id === 'node-1')
    const output = arranged.find((node) => node.id === 'node-4')

    expect(checkpoint?.x).toBeLessThan(output?.x ?? 0)
  })
})
