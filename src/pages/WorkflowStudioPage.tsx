import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Body1,
} from '@/ui/components';
import {
  AddRegular,
  ArrowRightRegular,
  CheckmarkCircleFilled,
  ImageRegular,
  VideoClipRegular,
  ZoomInRegular,
  EditRegular,
  GridRegular,
  SettingsRegular,
} from '@/ui/icons';
import './WorkflowStudioPage.css';

type WorkflowNodeType =
  | 'text2image'
  | 'imageEdit'
  | 'videoGen'
  | 'upscale'
  | 'sampler'
  | 'saveOutput';

type WorkflowNode = {
  id: string;
  title: string;
  type: WorkflowNodeType;
  x: number;
  y: number;
  status: 'ready' | 'running' | 'idle';
  detail: string;
};

type WorkflowEdge = {
  from: string;
  to: string;
};

const initialNodes: WorkflowNode[] = [
  { id: 'n1', title: 'Text Prompt', type: 'text2image', x: 72, y: 84, status: 'ready', detail: '正向提示词 + 负向提示词' },
  { id: 'n2', title: 'Model Loader', type: 'sampler', x: 336, y: 96, status: 'ready', detail: '模型组: flux-dev / device: cuda' },
  { id: 'n3', title: 'Image Edit', type: 'imageEdit', x: 620, y: 88, status: 'idle', detail: '局部重绘 / Inpaint 参数' },
  { id: 'n4', title: 'Video Compose', type: 'videoGen', x: 620, y: 256, status: 'idle', detail: '图生视频时长、fps、镜头' },
  { id: 'n5', title: 'Upscale', type: 'upscale', x: 336, y: 276, status: 'ready', detail: '2x/4x 超分和锐化策略' },
  { id: 'n6', title: 'Output Save', type: 'saveOutput', x: 880, y: 172, status: 'ready', detail: '写入图库并记录参数快照' },
];

const edges: WorkflowEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n2', to: 'n5' },
  { from: 'n3', to: 'n6' },
  { from: 'n4', to: 'n6' },
  { from: 'n5', to: 'n6' },
];

const nodeTypeLabel: Record<WorkflowNodeType, string> = {
  text2image: '文生图',
  imageEdit: '图片编辑',
  videoGen: '视频生成',
  upscale: '图像超分',
  sampler: '采样流程',
  saveOutput: '输出',
};

const nodeTypeIcon: Record<WorkflowNodeType, ReactNode> = {
  text2image: <ImageRegular />,
  imageEdit: <EditRegular />,
  videoGen: <VideoClipRegular />,
  upscale: <ZoomInRegular />,
  sampler: <GridRegular />,
  saveOutput: <CheckmarkCircleFilled />,
};

const statusText: Record<WorkflowNode['status'], string> = {
  ready: '就绪',
  running: '运行中',
  idle: '待配置',
};

export const WorkflowStudioPage = () => {
  const [nodes] = useState<WorkflowNode[]>(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNodes[0].id);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];

  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  return (
    <div className="workflow-page pencil-page">
      <header className="pencil-page-header">
        <div className="pencil-page-title-row">
          <h1 className="pencil-page-title">工作流工作台</h1>
          <span className="pencil-page-kicker">COMFY-LIKE NODE EDITOR</span>
        </div>
        <p className="pencil-page-description">
          将图片生成、图片编辑、视频生成、图像超分等能力统一到单一节点流中，支持参数复用与可视化编排。
        </p>
      </header>

      <div className="workflow-toolbar">
        <span className="workflow-badge">ComfyUI 风格</span>
        <div className="workflow-toolbar-actions">
          <button type="button" className="workflow-btn workflow-btn-secondary">
            <AddRegular />
            添加节点
          </button>
          <button type="button" className="workflow-btn workflow-btn-primary">
            <ArrowRightRegular />
            执行工作流
          </button>
        </div>
      </div>

      <section className="workflow-body">
        <aside className="workflow-panel workflow-left">
          <h3>节点库</h3>
          <p>按任务类型快速插入节点</p>
          <div className="workflow-node-list">
            <button type="button" className="workflow-node-template">
              <ImageRegular /> 文生图
            </button>
            <button type="button" className="workflow-node-template">
              <EditRegular /> 图片编辑
            </button>
            <button type="button" className="workflow-node-template">
              <VideoClipRegular /> 视频生成
            </button>
            <button type="button" className="workflow-node-template">
              <ZoomInRegular /> 图像超分辨率
            </button>
            <button type="button" className="workflow-node-template">
              <SettingsRegular /> 参数合并器
            </button>
          </div>
          <div className="workflow-queue">
            <h4>执行队列</h4>
            <Body1>1. Text Prompt + Model Loader</Body1>
            <Body1>2. Image Edit (待配置)</Body1>
            <Body1>3. Output Save</Body1>
          </div>
        </aside>

        <div className="workflow-canvas">
          <svg className="workflow-links" viewBox="0 0 1200 520" preserveAspectRatio="none">
            {edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + 210;
              const y1 = fromNode.y + 44;
              const x2 = toNode.x;
              const y2 = toNode.y + 44;
              const midX = (x1 + x2) / 2;
              const path = `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
              return <path key={`${edge.from}-${edge.to}`} d={path} className="workflow-link-path" />;
            })}
          </svg>

          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`workflow-node ${node.id === selectedNodeId ? 'is-selected' : ''}`}
              style={{ left: node.x, top: node.y }}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <div className="workflow-node-head">
                <span className="workflow-node-icon">{nodeTypeIcon[node.type]}</span>
                <span>{node.title}</span>
              </div>
              <p>{node.detail}</p>
              <div className={`workflow-node-status is-${node.status}`}>{statusText[node.status]}</div>
            </button>
          ))}
        </div>

        <aside className="workflow-panel workflow-inspector">
          <h3>节点参数</h3>
          <p>选中节点后在此编辑参数，支持预设切换与批量复制。</p>
          <div className="workflow-inspector-group">
            <label>节点名称</label>
            <input value={selectedNode.title} readOnly />
          </div>
          <div className="workflow-inspector-group">
            <label>节点类型</label>
            <input value={nodeTypeLabel[selectedNode.type]} readOnly />
          </div>
          <div className="workflow-inspector-group">
            <label>状态</label>
            <input value={statusText[selectedNode.status]} readOnly />
          </div>
          <div className="workflow-inspector-group">
            <label>说明</label>
            <textarea value={selectedNode.detail} readOnly />
          </div>
          <button type="button" className="workflow-btn workflow-btn-primary workflow-apply-btn">
            应用更改
          </button>
        </aside>
      </section>

      <footer className="pencil-page-statusbar">
        <div className="pencil-page-status-main">
          <span className="pencil-page-status-dot" />
          工作流状态：已就绪（6 节点 / 6 连线）
        </div>
        <button type="button" className="workflow-btn workflow-btn-secondary">
          [ Space ] 运行当前图
        </button>
      </footer>
    </div>
  );
};

export default WorkflowStudioPage;

