import type { DragEvent as ReactDragEvent } from 'react'
import { Input } from 'antd'
import { ChevronLeftRegular, GridRegular, SearchRegular } from '@/ui/icons'
import { nodeIOMap } from '@/features/workflow-studio/domain/workflowDomain'
import type { WorkflowNodeType } from '@/features/workflow-studio/types'
import { mediaFormatColor, mediaFormatLabel, nodeTypeColor } from './workflowStudioConfig'

type NodeTemplate = {
  description: string
  title: string
  type: WorkflowNodeType
}

interface WorkflowNodeLibraryProps {
  filteredTemplates: NodeTemplate[]
  isRunning: boolean
  leftPanelCollapsed: boolean
  nodeSearchQuery: string
  onCollapse: () => void
  onExpand: () => void
  onSearchQueryChange: (value: string) => void
  onTemplateDragEnd: () => void
  onTemplateDragStart: (event: ReactDragEvent<HTMLDivElement>, type: WorkflowNodeType) => void
}

export function WorkflowNodeLibrary({
  filteredTemplates,
  isRunning,
  leftPanelCollapsed,
  nodeSearchQuery,
  onCollapse,
  onExpand,
  onSearchQueryChange,
  onTemplateDragEnd,
  onTemplateDragStart,
}: WorkflowNodeLibraryProps) {
  if (leftPanelCollapsed) {
    return (
      <button
        type="button"
        className="workflow-panel-dock workflow-panel-dock-left"
        onClick={onExpand}
        title="展开节点库"
        aria-label="展开节点库"
      >
        <GridRegular />
      </button>
    )
  }

  return (
    <aside className="workflow-panel workflow-left">
      <div className="workflow-panel-header">
        <div className="workflow-panel-header-copy">
          <h3>节点库</h3>
          <p>拖到画布中创建；按住 Ctrl 拖动画布，右键打开菜单。</p>
        </div>
        <button
          type="button"
          className="workflow-panel-collapse"
          onClick={onCollapse}
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
        onChange={(event) => onSearchQueryChange(event.target.value)}
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
                onDragStart={(event) => onTemplateDragStart(event, template.type)}
                onDragEnd={onTemplateDragEnd}
              >
                <span className="workflow-node-template-dot" style={{ background: nodeTypeColor[template.type] }} />
                <span className="workflow-node-template-copy">
                  <strong>{template.title}</strong>
                  <span>{template.description}</span>
                  <span className="workflow-node-template-io">
                    {io.inputs.map((format) => (
                      <span
                        key={`in-${format}`}
                        className="workflow-io-tag is-input"
                        style={{ borderColor: mediaFormatColor[format], color: mediaFormatColor[format] }}
                      >
                        {mediaFormatLabel[format]}
                      </span>
                    ))}
                    {io.outputs.length > 0 ? <span className="workflow-io-arrow">→</span> : null}
                    {io.outputs.map((format) => (
                      <span
                        key={`out-${format}`}
                        className="workflow-io-tag is-output"
                        style={{ background: mediaFormatColor[format] }}
                      >
                        {mediaFormatLabel[format]}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
