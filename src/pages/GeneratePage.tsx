import {
  Card,
  Title1,
  Title2,
  Body1,
  Button,
  tokens,
  Spinner,
  Field,
  Textarea,
  Dropdown,
  Option,
  SpinButton,
  Checkbox,
  Text,
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  DocumentArrowDownRegular,
  ArrowDownloadRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIpcListener } from '../hooks/useIpcListener';
import { useTaskbarProgress } from '../hooks/useTaskbarProgress';
import { ipcInvoke, ipcListen } from '../lib/tauriIpc';
import { useAppStore } from '../hooks/useAppStore';
import { useCliOutput } from '../hooks/useCliOutput';
import { useModelGroups, useDeviceType } from '../hooks/useModelGroups';
import { useSharedStyles } from '../styles/sharedStyles';
import { CliOutputPanel } from '../components/CliOutputPanel';
import { MessageDialog, useMessageDialog } from '../components/MessageDialog';
import { getDeviceLabel, getEngineValue, getModelInfo, DEFAULT_NEGATIVE_PROMPT } from '../utils/modelUtils';
import type { AvailableEngine } from '../../shared/types';

export const GeneratePage = () => {
  const styles = useSharedStyles();
  const navigate = useNavigate();
  const { setIsGenerating } = useAppStore();
  const { modelGroups, loading, selectedGroupId, setSelectedGroupId, selectedGroup, isGroupComplete, reloadModelGroups } = useModelGroups('generate');
  const { deviceType, cpuVariant, handleDeviceTypeChange, availableEngines } = useDeviceType();
  const cli = useCliOutput('generate:cli-output');
  const msgDialog = useMessageDialog();
  const { setIndeterminate, clearProgress } = useTaskbarProgress();
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>(DEFAULT_NEGATIVE_PROMPT);
  const [steps, setSteps] = useState<number>(20);
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [cfgScale, setCfgScale] = useState<number>(7.0);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImagePath, setGeneratedImagePath] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
  // 参数状态
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');
  const [scheduler, setScheduler] = useState<string>('discrete');
  const [seed, setSeed] = useState<number>(-1);
  const [batchCount, setBatchCount] = useState<number>(1);
  const [threads, setThreads] = useState<number>(-1); // -1 表示自动
  const [preview, setPreview] = useState<string>('proj');
  const [previewInterval, setPreviewInterval] = useState<number>(1);
  const [verbose, setVerbose] = useState<boolean>(false);
  const [color, setColor] = useState<boolean>(false);
  const [offloadToCpu, setOffloadToCpu] = useState<boolean>(false);
  const [diffusionFa, setDiffusionFa] = useState<boolean>(true);
  const [controlNetCpu, setControlNetCpu] = useState<boolean>(false);
  const [clipOnCpu, setClipOnCpu] = useState<boolean>(false);
  const [vaeOnCpu, setVaeOnCpu] = useState<boolean>(false);
  const [diffusionConvDirect, setDiffusionConvDirect] = useState<boolean>(false);
  const [vaeConvDirect, setVaeConvDirect] = useState<boolean>(false);
  const [vaeTiling, setVaeTiling] = useState<boolean>(true);
  const [flowShift, setFlowShift] = useState<number>(0); // 0 表示不传（使用模型默认值）
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // 监听预览图片更新
  useIpcListener(
    'generate:preview-update',
    (data) => {
      if (data?.previewImage) {
        setPreviewImage(data.previewImage);
      }
    }
  );

  // 通知父组件生成状态变化
  useEffect(() => {
    setIsGenerating(generating);
  }, [generating, setIsGenerating]);

  // 当选择的模型组变化时，更新默认参数
  useEffect(() => {
    if (selectedGroupId) {
      const group = modelGroups.find(g => g.id === selectedGroupId);
      if (group) {
        if (group.defaultSteps) setSteps(group.defaultSteps);
        if (group.defaultCfgScale) setCfgScale(group.defaultCfgScale);
        if (group.defaultWidth) {
          setWidth(group.defaultWidth);
        }
        if (group.defaultHeight) {
          setHeight(group.defaultHeight);
        }
        if (typeof group.defaultSamplingMethod === 'string') {
          setSamplingMethod(group.defaultSamplingMethod);
        }
        if (typeof group.defaultScheduler === 'string') {
          setScheduler(group.defaultScheduler);
        }
        // Flow Shift：有明确值（非零）时设置，否则重置为 0
        setFlowShift(typeof group.defaultFlowShift === 'number' && group.defaultFlowShift > 0 ? group.defaultFlowShift : 0);
      }
    }
  }, [selectedGroupId, modelGroups]);

  const handleGenerate = async () => {
    if (!selectedGroupId) {
      msgDialog.showMessage('提示', '请选择模型组');
      return;
    }
    if (!prompt.trim()) {
      msgDialog.showMessage('提示', '请输入提示词');
      return;
    }

    try {
      setGenerating(true);
      setGeneratedImage(null);
      setGeneratedImagePath(null);
      setPreviewImage(null); // 清空预览图片
      setGenerationProgress('正在初始化...');
      cli.clearOutput(); // 清空之前的输出
      setIndeterminate(); // 设置任务栏进度条为不确定状态

      // 监听生成进度
      const unlisten = await ipcListen('generate:progress', (data) => {
        if (data.progress) {
          setGenerationProgress(String(data.progress));
        }
        if (data.image) {
          setGeneratedImage(data.image);
        }
      });

      try {
        const selectedGroup = modelGroups.find(g => g.id === selectedGroupId);
        if (!selectedGroup) {
          throw new Error('所选模型组不存在');
        }
        if (!selectedGroup.sdModel && !selectedGroup.diffusionModel) {
          throw new Error('所选模型组中未配置SD模型或扩散模型');
        }

        const result = await ipcInvoke('generate:start', {
          groupId: selectedGroupId,
          sdModel: selectedGroup.sdModel,
          diffusionModel: selectedGroup.diffusionModel,
          vaeModel: selectedGroup.vaeModel,
          llmModel: selectedGroup.llmModel,
          clipLModel: selectedGroup.clipLModel,
          t5xxlModel: selectedGroup.t5xxlModel,
          deviceType: cpuVariant ? `cpu-${cpuVariant}` : deviceType,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim(),
          steps,
          width,
          height,
          cfgScale,
          samplingMethod,
          scheduler,
          seed: seed < 0 ? undefined : seed,
          batchCount,
          threads: threads < 0 ? undefined : threads,
          preview: preview !== 'none' ? preview : undefined,
          previewInterval: preview !== 'none' ? previewInterval : undefined,
          verbose,
          color,
          offloadToCpu,
          diffusionFa,
          controlNetCpu,
          clipOnCpu,
          vaeOnCpu,
          diffusionConvDirect,
          vaeConvDirect,
          vaeTiling,
          flowShift: flowShift > 0 ? flowShift : undefined,
        });

        if (result.success && result.image) {
          setGeneratedImage(result.image);
          // 记录生成图片在 outputs 目录中的实际路径，便于在本页直接保存
          if (result.imagePath && typeof result.imagePath === 'string') {
            setGeneratedImagePath(result.imagePath);
          }
          setPreviewImage(null); // 清除预览图片，显示最终图片
          setGenerationProgress('生成完成');
        } else {
          throw new Error(result.error || '生成失败');
        }
      } finally {
        unlisten();
        setGenerating(false);
        clearProgress();
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 检查是否是取消操作
      if (!errorMessage.includes('生成已取消') && !errorMessage.includes('cancelled')) {
        msgDialog.showMessage('生成失败', `生成图片失败: ${errorMessage}`);
      }
      setGenerationProgress('');
      setGenerating(false);
      clearProgress();
    }
  };

  const handleCancelGenerate = async () => {
    try {
      await ipcInvoke('generate:cancel');
      setGenerationProgress('正在取消...');
      clearProgress();
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    }
  };

  // 直接在生成页面保存最新生成的图片
  const handleSaveGeneratedImage = async () => {
    if (!generatedImagePath) {
      msgDialog.showMessage('提示', '当前还没有可保存的生成结果，请先生成一张图片。');
      return;
    }

    try {
      const success = await ipcInvoke('generated-images:download', generatedImagePath);
      if (!success) {
        msgDialog.showMessage('保存失败', '保存图片失败，请稍后重试。');
      }
    } catch (error) {
      console.error('Failed to save generated image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      msgDialog.showMessage('保存失败', `保存图片失败: ${errorMessage}`);
    }
  };

  return (
    <div className={styles.container}>
      <Title1>图片生成</Title1>

      {/* 浮动控制面板 - 固定在底部，集成 CLI 输出 */}
      <div className={styles.floatingControlPanelWithCli}>
        <div className={styles.floatingControlPanelActions}>
          {generating ? (
            <Button
              onClick={handleCancelGenerate}
              appearance="secondary"
              size="large"
            >
              取消生成
            </Button>
          ) : (
            <Button
              icon={<ImageAddRegular />}
              onClick={handleGenerate}
              disabled={!selectedGroupId || !prompt.trim() || loading}
              appearance="primary"
              size="large"
            >
              开始生成
            </Button>
          )}
          <Button
            icon={<DocumentArrowDownRegular />}
            onClick={handleSaveGeneratedImage}
            disabled={loading || generating || !generatedImagePath}
          >
            保存最新图片
          </Button>
          <Button
            onClick={reloadModelGroups}
            disabled={loading || generating}
          >
            刷新模型组列表
          </Button>
        </div>
        <CliOutputPanel
          cliOutput={cli.cliOutput}
          cliOutputExpanded={cli.cliOutputExpanded}
          unreadCount={cli.unreadCount}
          copySuccess={cli.copySuccess}
          cliOutputRef={cli.cliOutputRef}
          onToggleExpanded={cli.toggleExpanded}
          onCopy={cli.handleCopyOutput}
          onExport={cli.handleExportOutput}
          onClear={cli.clearOutput}
          variant="floating"
        />
      </div>

      {/* 预览区域 - 在上方，占据主要区域 */}
      <Card className={styles.previewCard}>
        <Title2>生成结果</Title2>
        <div className={styles.previewSection}>
          {generating ? (
            <div className={styles.emptyState}>
              {previewImage ? (
                <>
                  <PhotoView src={previewImage}>
                    <img 
                      src={previewImage} 
                      alt="预览图片" 
                      className={styles.previewImage}
                      title="点击放大查看预览"
                    />
                  </PhotoView>
                  <Body1 style={{ marginTop: tokens.spacingVerticalM }}>
                    {generationProgress || '正在生成...'}
                  </Body1>
                </>
              ) : (
                <>
                  <Spinner size="large" />
                  <Body1 style={{ marginTop: tokens.spacingVerticalM }}>
                    {generationProgress || '正在生成...'}
                  </Body1>
                </>
              )}
            </div>
          ) : generatedImage ? (
            <>
              <PhotoView src={generatedImage}>
                <img 
                  src={generatedImage} 
                  alt="生成的图片" 
                  className={styles.previewImage}
                  title="点击放大查看"
                />
              </PhotoView>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                {generationProgress || '生成完成'}
              </Body1>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Body1>生成的图片将显示在这里</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
                请在下方配置生成参数并点击"开始生成"按钮
              </Body1>
            </div>
          )}
        </div>
      </Card>

      {/* 配置区域 - 在下方 */}
      <Card className={styles.configCard}>
        <Title2>生成配置</Title2>
        <div className={styles.formSection}>
          {/* 模型组选择 */}
          <Field label="选择模型组" required>
            <Dropdown
              placeholder={loading ? '加载中...' : '请选择模型组'}
              disabled={loading || modelGroups.length === 0}
              value={selectedGroup?.name || ''}
              selectedOptions={[selectedGroupId]}
              onOptionSelect={(_, data) => {
                if (data.optionValue) {
                  setSelectedGroupId(data.optionValue);
                  // 应用模型组的默认设置
                  const selectedGroup = modelGroups.find(g => g.id === data.optionValue);
                  if (selectedGroup) {
                    if (typeof selectedGroup.defaultSteps === 'number') {
                      setSteps(selectedGroup.defaultSteps);
                    }
                    if (typeof selectedGroup.defaultCfgScale === 'number') {
                      setCfgScale(selectedGroup.defaultCfgScale);
                    }
                    if (typeof selectedGroup.defaultWidth === 'number') {
                      setWidth(selectedGroup.defaultWidth);
                    }
                    if (typeof selectedGroup.defaultHeight === 'number') {
                      setHeight(selectedGroup.defaultHeight);
                    }
                    if (typeof selectedGroup.defaultSamplingMethod === 'string') {
                      setSamplingMethod(selectedGroup.defaultSamplingMethod);
                    }
                    if (typeof selectedGroup.defaultScheduler === 'string') {
                      setScheduler(selectedGroup.defaultScheduler);
                    }
                    if (typeof selectedGroup.defaultFlowShift === 'number') {
                      setFlowShift(selectedGroup.defaultFlowShift > 0 ? selectedGroup.defaultFlowShift : 0);
                    } else {
                      setFlowShift(0);
                    }
                    if (typeof selectedGroup.defaultSeed === 'number') {
                      if (selectedGroup.defaultSeed >= 0) {
                        setSeed(selectedGroup.defaultSeed);
                      } else {
                        setSeed(-1);
                      }
                    }
                  }
                }
              }}
            >
              {modelGroups.filter(group => isGroupComplete(group.id)).map((group) => (
                <Option 
                  key={group.id} 
                  value={group.id} 
                  text={group.name}
                >
                  {group.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
            {modelGroups.filter(g => isGroupComplete(g.id)).length === 0
              ? '暂无可用模型组，请先在"模型权重管理"页面创建模型组并下载所需文件'
              : selectedGroup
              ? `已选择: ${selectedGroup.name}${getModelInfo(selectedGroup) ? ` (${getModelInfo(selectedGroup)})` : ''}`
              : '请选择模型组'}
          </Body1>

          {/* 提示词输入 */}
          <Field label="提示词" required>
            <Textarea
              value={prompt}
              onChange={(_, data) => setPrompt(data.value)}
              placeholder="输入图片描述，例如：一幅美丽的山水画，有山峰和湖泊"
              rows={4}
              resize="vertical"
            />
          </Field>

          {/* 负面提示词 */}
          <Field 
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>负面提示词（可选）</span>
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={() => setNegativePrompt(DEFAULT_NEGATIVE_PROMPT)}
                  style={{ minWidth: 'auto' }}
                >
                  恢复默认
                </Button>
              </div>
            }
            hint="已提供通用默认值，可根据需要修改"
          >
            <Textarea
              value={negativePrompt}
              onChange={(_, data) => setNegativePrompt(data.value)}
              placeholder="输入不希望出现在图片中的内容，或使用默认的通用负面提示词"
              rows={3}
              resize="vertical"
            />
          </Field>

          {/* 推理引擎和模型设备分配 */}
          <div className={styles.modelDeviceCard}>
            <div className={styles.modelDeviceHeader}>
              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase400 }}>
                推理引擎和模型设备分配
              </Text>
            </div>
            <div style={{ marginBottom: tokens.spacingVerticalM }}>
              <Field label="推理引擎" hint={availableEngines.length === 0 ? "请先在「SD.cpp 管理」页面下载推理引擎" : "选择主要的推理引擎（CUDA/Vulkan/CPU）"}>
                {availableEngines.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                    <Body1 style={{ color: tokens.colorPaletteRedForeground2, fontStyle: 'italic' }}>
                      未检测到已安装的推理引擎
                    </Body1>
                    <Button
                      size="small"
                      appearance="primary"
                      icon={<ArrowDownloadRegular />}
                      onClick={() => navigate('/sdcpp')}
                    >
                      前往下载
                    </Button>
                  </div>
                ) : (
                  <Dropdown
                    value={getDeviceLabel(deviceType, cpuVariant)}
                    selectedOptions={[getEngineValue({ deviceType, cpuVariant } as AvailableEngine)]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        const engine = availableEngines.find(e => getEngineValue(e) === data.optionValue);
                        if (engine) {
                          handleDeviceTypeChange(engine);
                        }
                      }
                    }}
                  >
                    {availableEngines.map(engine => (
                      <Option key={getEngineValue(engine)} value={getEngineValue(engine)}>
                        {engine.label}
                      </Option>
                    ))}
                  </Dropdown>
                )}
              </Field>
            </div>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }}>
              为每个模型组件选择使用的设备。强制使用CPU的模型将始终在CPU上运行。
            </Body1>
            <div className={styles.modelDeviceList}>
              <div className={styles.modelDeviceItem}>
                <div className={styles.modelDeviceItemLeft}>
                  <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase300 }}>
                    ControlNet
                  </Text>
                  <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                    控制网络模型
                  </Body1>
                  {controlNetCpu && (
                    <div className={styles.modelDeviceInfo}>
                      <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorPaletteBlueForeground2 }}>
                        ⚠️ 强制使用CPU，将始终在CPU上运行
                      </Text>
                    </div>
                  )}
                  {!controlNetCpu && offloadToCpu && (
                    <div className={styles.modelDeviceInfo}>
                      <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                        💾 未使用时将卸载到CPU（RAM）
                      </Text>
                    </div>
                  )}
                </div>
                <div className={styles.modelDeviceItemRight}>
                  <Dropdown
                    className={styles.modelDeviceSelector}
                    value={controlNetCpu ? 'CPU' : getDeviceLabel(deviceType, cpuVariant)}
                    selectedOptions={[controlNetCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setControlNetCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(deviceType, cpuVariant)}</Option>
                  </Dropdown>
                </div>
              </div>
              <div className={styles.modelDeviceItem}>
                <div className={styles.modelDeviceItemLeft}>
                  <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase300 }}>
                    CLIP
                  </Text>
                  <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                    文本编码器模型
                  </Body1>
                  {clipOnCpu && (
                    <div className={styles.modelDeviceInfo}>
                      <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorPaletteBlueForeground2 }}>
                        ⚠️ 强制使用CPU，将始终在CPU上运行
                      </Text>
                    </div>
                  )}
                  {!clipOnCpu && offloadToCpu && (
                    <div className={styles.modelDeviceInfo}>
                      <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                        💾 未使用时将卸载到CPU（RAM）
                      </Text>
                    </div>
                  )}
                </div>
                <div className={styles.modelDeviceItemRight}>
                  <Dropdown
                    className={styles.modelDeviceSelector}
                    value={clipOnCpu ? 'CPU' : getDeviceLabel(deviceType, cpuVariant)}
                    selectedOptions={[clipOnCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setClipOnCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(deviceType, cpuVariant)}</Option>
                  </Dropdown>
                </div>
              </div>
              <div className={styles.modelDeviceItem}>
                <div className={styles.modelDeviceItemLeft}>
                  <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase300 }}>
                    VAE
                  </Text>
                  <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                    变分自编码器模型
                  </Body1>
                  {vaeOnCpu && (
                    <div className={styles.modelDeviceInfo}>
                      <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorPaletteBlueForeground2 }}>
                        ⚠️ 强制使用CPU，将始终在CPU上运行
                      </Text>
                    </div>
                  )}
                  {!vaeOnCpu && offloadToCpu && (
                    <div className={styles.modelDeviceInfo}>
                      <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                        💾 未使用时将卸载到CPU（RAM）
                      </Text>
                    </div>
                  )}
                </div>
                <div className={styles.modelDeviceItemRight}>
                  <Dropdown
                    className={styles.modelDeviceSelector}
                    value={vaeOnCpu ? 'CPU' : getDeviceLabel(deviceType, cpuVariant)}
                    selectedOptions={[vaeOnCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setVaeOnCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(deviceType, cpuVariant)}</Option>
                  </Dropdown>
                </div>
              </div>
            </div>
            <div className={styles.offloadToCpuSection}>
              <Field label="卸载到CPU" hint="启用后，未强制使用CPU的模型在未使用时将卸载到RAM，需要时自动加载到VRAM。强制使用CPU的模型不受此选项影响。">
                <Checkbox
                  checked={offloadToCpu}
                  onChange={(_, data) => setOffloadToCpu(data.checked === true)}
                />
              </Field>
            </div>
          </div>

          {/* 高级参数 */}
          <Title2 style={{ fontSize: tokens.fontSizeBase400, marginTop: tokens.spacingVerticalM }}>
            高级参数
          </Title2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacingHorizontalM }}>
            <Field label="采样步数" hint="默认: 20">
              <SpinButton
                value={steps}
                onChange={(_, data) => setSteps(data.value ?? 20)}
                min={1}
                max={100}
                step={1}
              />
            </Field>
            <Field label="CFG Scale" hint="默认: 7.0">
              <SpinButton
                value={cfgScale}
                onChange={(_, data) => setCfgScale(data.value ?? 7.0)}
                min={0.1}
                max={30}
                step={0.1}
              />
            </Field>
            <Field label="Flow Shift" hint="Flow 模型（Z-Image/Wan 等）使用，0 表示不传（使用模型内置默认值）">
              <SpinButton
                value={flowShift}
                onChange={(_, data) => setFlowShift(data.value ?? 0)}
                min={0}
                max={20}
                step={0.1}
              />
            </Field>
            <Field label="图片宽度" hint="默认: 512，自动对齐到 16 的倍数">
              <SpinButton
                value={width}
                onChange={(_, data) => {
                  const val = data.value ?? 512;
                  const aligned = Math.round(val / 16) * 16;
                  const clamped = Math.max(64, Math.min(2048, aligned));
                  setWidth(clamped);
                }}
                min={64}
                max={2048}
                step={16}
              />
            </Field>
            <Field label="图片高度" hint="默认: 512，自动对齐到 16 的倍数">
              <SpinButton
                value={height}
                onChange={(_, data) => {
                  const val = data.value ?? 512;
                  const aligned = Math.round(val / 16) * 16;
                  const clamped = Math.max(64, Math.min(2048, aligned));
                  setHeight(clamped);
                }}
                min={64}
                max={2048}
                step={16}
              />
            </Field>
            <Field label="采样方法" hint="默认: euler_a">
              <Dropdown
                value={samplingMethod}
                selectedOptions={[samplingMethod]}
                onOptionSelect={(_, data) => {
                  if (data.optionValue) {
                    setSamplingMethod(data.optionValue);
                  }
                }}
              >
                <Option value="euler">Euler</Option>
                <Option value="euler_a">Euler A</Option>
                <Option value="heun">Heun</Option>
                <Option value="dpm2">DPM2</Option>
                <Option value="dpm++2s_a">DPM++ 2S A</Option>
                <Option value="dpm++2m">DPM++ 2M</Option>
                <Option value="dpm++2mv2">DPM++ 2M V2</Option>
                <Option value="ipndm">IPNDM</Option>
                <Option value="ipndm_v">IPNDM V</Option>
                <Option value="lcm">LCM</Option>
                <Option value="ddim_trailing">DDIM Trailing</Option>
                <Option value="tcd">TCD</Option>
              </Dropdown>
            </Field>
            <Field label="调度器" hint="默认: discrete">
              <Dropdown
                value={scheduler}
                selectedOptions={[scheduler]}
                onOptionSelect={(_, data) => {
                  if (data.optionValue) {
                    setScheduler(data.optionValue);
                  }
                }}
              >
                <Option value="discrete">Discrete</Option>
                <Option value="karras">Karras</Option>
                <Option value="exponential">Exponential</Option>
                <Option value="ays">AYS</Option>
                <Option value="gits">GITS</Option>
                <Option value="smoothstep">Smoothstep</Option>
                <Option value="sgm_uniform">SGM Uniform</Option>
                <Option value="simple">Simple</Option>
                <Option value="lcm">LCM</Option>
              </Dropdown>
            </Field>
            <Field label="种子" hint="-1 表示随机">
              <SpinButton
                value={seed}
                onChange={(_, data) => setSeed(data.value ?? -1)}
                min={-1}
              />
            </Field>
            <Field label="批次数量" hint="默认: 1">
              <SpinButton
                value={batchCount}
                onChange={(_, data) => setBatchCount(data.value ?? 1)}
                min={1}
                max={10}
                step={1}
              />
            </Field>
          </div>

          {/* 展开更多选项按钮 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: tokens.spacingVerticalM }}>
            <Button
              size="medium"
              appearance="subtle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '收起更多选项' : '展开更多选项'}
            </Button>
          </div>

          {/* 更多高级选项 */}
          {showAdvanced && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacingHorizontalM, marginTop: tokens.spacingVerticalM }}>
              <Field label="线程数" hint="-1 表示自动">
                <SpinButton
                  value={threads}
                  onChange={(_, data) => setThreads(data.value ?? -1)}
                  min={-1}
                />
              </Field>
              <Field label="预览方法" hint="默认: proj">
                <Dropdown
                  value={preview}
                  selectedOptions={[preview]}
                  onOptionSelect={(_, data) => {
                    if (data.optionValue) {
                      setPreview(data.optionValue);
                    }
                  }}
                >
                  <Option value="none">无</Option>
                  <Option value="proj">Proj</Option>
                  <Option value="tae">TAE</Option>
                  <Option value="vae">VAE</Option>
                </Dropdown>
              </Field>
              {preview !== 'none' && (
                <Field label="预览间隔" hint="默认: 1">
                  <SpinButton
                    value={previewInterval}
                    onChange={(_, data) => setPreviewInterval(data.value ?? 1)}
                    min={1}
                    max={100}
                    step={1}
                  />
                </Field>
              )}
              <Field label="详细输出" hint="打印额外信息">
                <Checkbox
                  checked={verbose}
                  onChange={(_, data) => setVerbose(data.checked === true)}
                />
              </Field>
              <Field label="彩色日志" hint="按级别着色日志标签">
                <Checkbox
                  checked={color}
                  onChange={(_, data) => setColor(data.checked === true)}
                />
              </Field>
              <Field label="启用 Flash Attention" hint="启用 Flash Attention（推荐启用，可提升性能）">
                <Checkbox
                  checked={diffusionFa}
                  onChange={(_, data) => setDiffusionFa(data.checked === true)}
                />
              </Field>
              <Field label="Diffusion Conv Direct" hint="在扩散模型中使用ggml_conv2d_direct">
                <Checkbox
                  checked={diffusionConvDirect}
                  onChange={(_, data) => setDiffusionConvDirect(data.checked === true)}
                />
              </Field>
              <Field label="VAE Conv Direct" hint="在VAE模型中使用ggml_conv2d_direct">
                <Checkbox
                  checked={vaeConvDirect}
                  onChange={(_, data) => setVaeConvDirect(data.checked === true)}
                />
              </Field>
              <Field label="VAE Tiling" hint="分块处理VAE以减少内存使用">
                <Checkbox
                  checked={vaeTiling}
                  onChange={(_, data) => setVaeTiling(data.checked === true)}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      {/* 消息对话框 */}
      <MessageDialog open={msgDialog.open} title={msgDialog.title} message={msgDialog.message} onClose={msgDialog.close} />
    </div>
  );
};

