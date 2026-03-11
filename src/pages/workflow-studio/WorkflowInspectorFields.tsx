import { Input, Select, Switch } from 'antd'
import type { InspectorDraft, WorkflowNode } from '@/features/workflow-studio/types'

interface WorkflowInspectorFieldsProps {
  draft: InspectorDraft
  isRunning: boolean
  selectedNode: WorkflowNode | null
  updateDraft: (patch: Partial<InspectorDraft>) => void
}

export function WorkflowInspectorFields({ draft, isRunning, selectedNode, updateDraft }: WorkflowInspectorFieldsProps) {
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

