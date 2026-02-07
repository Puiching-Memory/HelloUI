import {
  Card,
  Title1,
  Title2,
  Body1,
  Button,
  makeStyles,
  tokens,
  Spinner,
  Field,
  Textarea,
  Dropdown,
  Option,
  Input,
  Checkbox,
  Text,
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  DocumentArrowDownRegular,
  ArrowUploadRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useEffect } from 'react';
import { useIpcListener } from '../hooks/useIpcListener';
import { useAppStore } from '../hooks/useAppStore';
import { useCliOutput } from '../hooks/useCliOutput';
import { useModelGroups, useDeviceType } from '../hooks/useModelGroups';
import { useSharedStyles } from '../styles/sharedStyles';
import { CliOutputPanel } from '../components/CliOutputPanel';
import { MessageDialog, useMessageDialog } from '../components/MessageDialog';
import { getDeviceLabel, getModelInfo, DEFAULT_NEGATIVE_PROMPT } from '../utils/modelUtils';
import type { DeviceType } from '../../shared/types';

// 页面特有的样式（上传区域）
const useLocalStyles = makeStyles({
  uploadSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  uploadedImageContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.spacingVerticalM,
    width: '100%',
  },
  uploadedImage: {
    maxWidth: '100%',
    maxHeight: '400px',
    objectFit: 'contain',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  removeImageButton: {
    position: 'absolute',
    top: tokens.spacingVerticalXS,
    right: tokens.spacingVerticalXS,
    minWidth: 'auto',
  },
});

export const EditImagePage = () => {
  const styles = useSharedStyles();
  const localStyles = useLocalStyles();
  const { setIsGenerating } = useAppStore();
  const { modelGroups, loading, selectedGroupId, setSelectedGroupId, selectedGroup, reloadModelGroups } = useModelGroups('edit');
  const { deviceType, handleDeviceTypeChange } = useDeviceType();
  const cli = useCliOutput('generate:cli-output');
  const msgDialog = useMessageDialog();
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>(DEFAULT_NEGATIVE_PROMPT);
  const [steps, setSteps] = useState<number>(20);
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [widthInput, setWidthInput] = useState<string>('512');
  const [heightInput, setHeightInput] = useState<string>('512');
  const [cfgScale, setCfgScale] = useState<number>(7.0);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImagePath, setGeneratedImagePath] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
  // 新增参数状态
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');
  const [scheduler, setScheduler] = useState<string>('discrete');
  const [seed, setSeed] = useState<number>(-1); // -1 表示随机种子
  const [seedInput, setSeedInput] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(1);
  const [threads, setThreads] = useState<number>(-1); // -1 表示自动
  const [threadsInput, setThreadsInput] = useState<string>('');
  const [preview, setPreview] = useState<string>('proj');
  const [previewInterval, setPreviewInterval] = useState<number>(1);
  const [verbose, setVerbose] = useState<boolean>(false);
  const [color, setColor] = useState<boolean>(false);
  const [offloadToCpu, setOffloadToCpu] = useState<boolean>(false);
  const [diffusionFa, setDiffusionFa] = useState<boolean>(true); // 默认启用
  const [controlNetCpu, setControlNetCpu] = useState<boolean>(false);
  const [clipOnCpu, setClipOnCpu] = useState<boolean>(false);
  const [vaeOnCpu, setVaeOnCpu] = useState<boolean>(false);
  const [diffusionConvDirect, setDiffusionConvDirect] = useState<boolean>(false);
  const [vaeConvDirect, setVaeConvDirect] = useState<boolean>(false);
  const [vaeTiling, setVaeTiling] = useState<boolean>(true);
  const [flowShift, setFlowShift] = useState<number>(3.0); // 默认 3.0
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [inputImagePath, setInputImagePath] = useState<string | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    if (!selectedGroupId) {
      msgDialog.showMessage('提示', '请选择模型组');
      return;
    }
    if (!inputImagePath) {
      msgDialog.showMessage('提示', '请先上传待编辑的图片');
      return;
    }
    if (!prompt.trim()) {
      msgDialog.showMessage('提示', '请输入提示词');
      return;
    }

    // 检查 ipcRenderer 是否可用
    if (!window.ipcRenderer) {
      msgDialog.showMessage('错误', 'IPC 通信不可用，请确保应用正常运行');
      return;
    }

      try {
      setGenerating(true);
      setGeneratedImage(null);
      setPreviewImage(null); // 清空预览图片
      setGenerationProgress('正在初始化...');
      cli.clearOutput(); // 清空之前的输出

      // 监听生成进度
      const progressListener = (_event: unknown, data: { progress: string | number; image?: string }) => {
        if (data.progress) {
          setGenerationProgress(String(data.progress));
        }
        if (data.image) {
          setGeneratedImage(data.image);
        }
      };

      window.ipcRenderer.on('generate:progress', progressListener);

      try {
        const selectedGroup = modelGroups.find(g => g.id === selectedGroupId);
        if (!selectedGroup) {
          throw new Error('所选模型组不存在');
        }
        if (!selectedGroup.sdModel) {
          throw new Error('所选模型组中未配置SD模型');
        }

        const result = await window.ipcRenderer.invoke('generate:start', {
          groupId: selectedGroupId,
          deviceType,
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
          flowShift,
          inputImage: inputImagePath, // 添加输入图片路径
        });

        if (result.success && result.image) {
          setGeneratedImage(result.image);
          if (result.imagePath) {
            setGeneratedImagePath(result.imagePath);
          }
          setPreviewImage(null); // 清除预览图片，显示最终图片
          setGenerationProgress('生成完成');
        } else {
          throw new Error(result.error || '生成失败');
        }
      } finally {
        if (window.ipcRenderer) {
          window.ipcRenderer.off('generate:progress', progressListener);
        }
        setGenerating(false);
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
    }
  };

  const handleCancelGenerate = async () => {
    if (!window.ipcRenderer) return;
    
    try {
      await window.ipcRenderer.invoke('generate:cancel');
      setGenerationProgress('正在取消...');
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    }
  };

  const handleSaveGeneratedImage = async () => {
    if (!generatedImagePath) return;
    try {
      await window.ipcRenderer.invoke('generated-images:download', generatedImagePath);
    } catch (error) {
      console.error('Failed to save image:', error);
    }
  };

  const handleSelectImage = async () => {
    if (!window.ipcRenderer) {
      msgDialog.showMessage('错误', 'IPC 通信不可用，请确保应用正常运行');
      return;
    }

    try {
      const filePath = await window.ipcRenderer.invoke('edit-image:select-file');
      if (filePath) {
        setInputImagePath(filePath);
        // 使用 media:/// 协议加载本地图片，避免 Electron 安全限制且性能更好
        const normalizedPath = filePath.replace(/\\/g, '/');
        setInputImagePreview(`media:///${normalizedPath}`);
      }
    } catch (error) {
      console.error('Failed to select image:', error);
      msgDialog.showMessage('错误', '选择图片失败，请重试');
    }
  };

  const handleRemoveImage = () => {
    setInputImagePath(null);
    setInputImagePreview(null);
  };

  return (
    <div className={styles.container}>
      <Title1>图片编辑</Title1>

      {/* 浮动控制面板 - 固定在底部 */}
      <div className={styles.floatingControlPanel}>
        <div className={styles.actions}>
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
              disabled={!selectedGroupId || !inputImagePath || !prompt.trim() || loading}
              appearance="primary"
              size="large"
            >
              开始编辑
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
      </div>

      {/* 预览区域 - 在上方，占据主要区域 */}
      <Card className={styles.previewCard}>
        <Title2>编辑结果</Title2>
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
              <Body1>编辑后的图片将显示在这里</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
                请先上传待编辑的图片，配置编辑参数后点击"开始编辑"按钮
              </Body1>
            </div>
          )}
        </div>
      </Card>

      {/* CLI 输出窗口 - 在第二个位置 */}
      <CliOutputPanel
        cliOutput={cli.cliOutput}
        cliOutputExpanded={cli.cliOutputExpanded}
        unreadCount={cli.unreadCount}
        copySuccess={cli.copySuccess}
        cliOutputRef={cli.cliOutputRef}
        onToggleExpanded={cli.toggleExpanded}
        onCopy={cli.handleCopyOutput}
        onExport={cli.handleExportOutput}
      />

      {/* 配置区域 - 在下方 */}
      <Card className={styles.configCard}>
        <Title2>编辑配置</Title2>
        <div className={styles.formSection}>
          {/* 图片上传区域 */}
          <Field label="待编辑图片" required>
            <div className={localStyles.uploadSection}>
              {inputImagePreview ? (
                <div className={localStyles.uploadedImageContainer}>
                  <PhotoView src={inputImagePreview}>
                    <img 
                      src={inputImagePreview} 
                      alt="待编辑图片" 
                      className={localStyles.uploadedImage}
                      title="点击放大查看"
                    />
                  </PhotoView>
                  <Button
                    icon={<DismissRegular />}
                    appearance="subtle"
                    className={localStyles.removeImageButton}
                    onClick={handleRemoveImage}
                    title="移除图片"
                  />
                </div>
              ) : (
                <div className={localStyles.uploadArea} onClick={handleSelectImage}>
                  <ArrowUploadRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                  <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
                    点击选择要编辑的图片
                  </Body1>
                  <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                    支持 PNG、JPG、JPEG、BMP、WEBP、GIF 格式
                  </Body1>
                </div>
              )}
              {!inputImagePreview && (
                <Button
                  icon={<ArrowUploadRegular />}
                  onClick={handleSelectImage}
                  appearance="primary"
                >
                  选择图片
                </Button>
              )}
            </div>
          </Field>
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
                    if (selectedGroup.defaultSteps !== undefined) {
                      setSteps(selectedGroup.defaultSteps);
                    }
                    if (selectedGroup.defaultCfgScale !== undefined) {
                      setCfgScale(selectedGroup.defaultCfgScale);
                    }
                    if (selectedGroup.defaultWidth !== undefined) {
                      setWidth(selectedGroup.defaultWidth);
                      setWidthInput(selectedGroup.defaultWidth.toString());
                    }
                    if (selectedGroup.defaultHeight !== undefined) {
                      setHeight(selectedGroup.defaultHeight);
                      setHeightInput(selectedGroup.defaultHeight.toString());
                    }
                    if (selectedGroup.defaultSamplingMethod !== undefined) {
                      setSamplingMethod(selectedGroup.defaultSamplingMethod);
                    }
                    if (selectedGroup.defaultScheduler !== undefined) {
                      setScheduler(selectedGroup.defaultScheduler);
                    }
                    if (selectedGroup.defaultSeed !== undefined) {
                      if (selectedGroup.defaultSeed >= 0) {
                        setSeed(selectedGroup.defaultSeed);
                        setSeedInput(selectedGroup.defaultSeed.toString());
                      } else {
                        setSeed(-1);
                        setSeedInput('');
                      }
                    }
                  }
                }
              }}
            >
              {modelGroups.map((group) => (
                <Option key={group.id} value={group.id} text={group.name}>
                  {group.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
            {modelGroups.length === 0
              ? '暂无可用模型组，请先在"模型权重管理"页面创建模型组'
              : selectedGroup
              ? `已选择: ${selectedGroup.name}${getModelInfo(selectedGroup) ? ` (${getModelInfo(selectedGroup)})` : ''}`
              : '未选择'}
          </Body1>
          {selectedGroup?.sdModel?.toLowerCase().includes('qwen-image-edit-2511') && (
            <div style={{ 
              marginTop: tokens.spacingVerticalS, 
              padding: tokens.spacingVerticalS, 
              backgroundColor: tokens.colorBrandBackground2, 
              borderRadius: tokens.borderRadiusMedium,
              border: `1px solid ${tokens.colorBrandStroke2}`
            }}>
              <Text style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorBrandForeground2 }}>
                ✨ 检测到 Qwen Image Edit 2511 模型。已自动启用优化参数：参考图模式 (-r)、零条件 T 标志 (--qwen-image-zero-cond-t) 和 Flow Shift (3.0)。
              </Text>
            </div>
          )}

          {/* 提示词输入 */}
          <Field label="提示词" required>
            <Textarea
              value={prompt}
              onChange={(_, data) => setPrompt(data.value)}
              placeholder="输入图片描述，例如：将背景改为日落场景"
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
              <Field label="推理引擎" hint="选择主要的推理引擎（CUDA/Vulkan/CPU）">
                <Dropdown
                  value={getDeviceLabel(deviceType)}
                  selectedOptions={[deviceType]}
                  onOptionSelect={(_, data) => {
                    if (data.optionValue) {
                      handleDeviceTypeChange(data.optionValue as DeviceType);
                    }
                  }}
                >
                  <Option value="cpu">CPU</Option>
                  <Option value="vulkan">Vulkan</Option>
                  <Option value="cuda">CUDA</Option>
                </Dropdown>
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
                    value={controlNetCpu ? 'CPU' : getDeviceLabel(deviceType)}
                    selectedOptions={[controlNetCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setControlNetCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(deviceType)}</Option>
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
                    value={clipOnCpu ? 'CPU' : getDeviceLabel(deviceType)}
                    selectedOptions={[clipOnCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setClipOnCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(deviceType)}</Option>
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
                    value={vaeOnCpu ? 'CPU' : getDeviceLabel(deviceType)}
                    selectedOptions={[vaeOnCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setVaeOnCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(deviceType)}</Option>
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
              <Input
                type="number"
                value={steps.toString()}
                onChange={(_, data) => {
                  const val = parseInt(data.value) || 20;
                  setSteps(Math.max(1, Math.min(100, val)));
                }}
                min={1}
                max={100}
              />
            </Field>
            <Field label="CFG Scale" hint="默认: 7.0">
              <Input
                type="number"
                value={cfgScale.toString()}
                onChange={(_, data) => {
                  const val = parseFloat(data.value) || 7.0;
                  setCfgScale(Math.max(0.1, Math.min(30, val)));
                }}
                min={0.1}
                max={30}
                step={0.1}
              />
            </Field>
            <Field label="Flow Shift" hint="默认: 3.0 (仅适用于 Qwen 2511)">
              <Input
                type="number"
                value={flowShift.toString()}
                onChange={(_, data) => {
                  const val = parseFloat(data.value) || 3.0;
                  setFlowShift(Math.max(0.1, Math.min(10, val)));
                }}
                min={0.1}
                max={10}
                step={0.1}
              />
            </Field>
            <Field label="图片宽度" hint="默认: 512">
              <Input
                type="number"
                value={widthInput}
                onChange={(_, data) => {
                  // 允许用户自由输入，不立即限制
                  setWidthInput(data.value);
                  const val = parseInt(data.value);
                  // 如果输入是有效数字且在范围内，更新实际值
                  if (!isNaN(val) && val >= 64 && val <= 2048) {
                    setWidth(val);
                  }
                }}
                onBlur={() => {
                  const val = parseInt(widthInput);
                  if (isNaN(val) || val < 64) {
                    // 无效值或小于最小值，重置为默认值
                    setWidthInput('512');
                    setWidth(512);
                  } else if (val > 2048) {
                    // 超过最大值，设置为最大值
                    setWidthInput('2048');
                    setWidth(2048);
                  } else {
                    // 对齐到16的倍数
                    const aligned = Math.round(val / 16) * 16;
                    setWidthInput(aligned.toString());
                    setWidth(aligned);
                  }
                }}
                min={64}
                max={2048}
                step={16}
              />
            </Field>
            <Field label="图片高度" hint="默认: 512">
              <Input
                type="number"
                value={heightInput}
                onChange={(_, data) => {
                  // 允许用户自由输入，不立即限制
                  setHeightInput(data.value);
                  const val = parseInt(data.value);
                  // 如果输入是有效数字且在范围内，更新实际值
                  if (!isNaN(val) && val >= 64 && val <= 2048) {
                    setHeight(val);
                  }
                }}
                onBlur={() => {
                  const val = parseInt(heightInput);
                  if (isNaN(val) || val < 64) {
                    // 无效值或小于最小值，重置为默认值
                    setHeightInput('512');
                    setHeight(512);
                  } else if (val > 2048) {
                    // 超过最大值，设置为最大值
                    setHeightInput('2048');
                    setHeight(2048);
                  } else {
                    // 对齐到16的倍数
                    const aligned = Math.round(val / 16) * 16;
                    setHeightInput(aligned.toString());
                    setHeight(aligned);
                  }
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
            <Field label="种子" hint="留空或-1表示随机">
              <Input
                type="number"
                value={seedInput}
                placeholder="随机"
                onChange={(_, data) => {
                  setSeedInput(data.value);
                  const val = parseInt(data.value);
                  if (!isNaN(val) && val >= 0) {
                    setSeed(val);
                  } else {
                    setSeed(-1);
                  }
                }}
                onBlur={() => {
                  const val = parseInt(seedInput);
                  if (isNaN(val) || val < 0) {
                    setSeedInput('');
                    setSeed(-1);
                  } else {
                    setSeed(val);
                  }
                }}
                min={0}
              />
            </Field>
            <Field label="批次数量" hint="默认: 1">
              <Input
                type="number"
                value={batchCount.toString()}
                onChange={(_, data) => {
                  const val = parseInt(data.value) || 1;
                  setBatchCount(Math.max(1, Math.min(10, val)));
                }}
                min={1}
                max={10}
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
              <Field label="线程数" hint="留空或-1表示自动">
                <Input
                  type="number"
                  value={threadsInput}
                  placeholder="自动"
                  onChange={(_, data) => {
                    setThreadsInput(data.value);
                    const val = parseInt(data.value);
                    if (!isNaN(val) && val > 0) {
                      setThreads(val);
                    } else {
                      setThreads(-1);
                    }
                  }}
                  onBlur={() => {
                    const val = parseInt(threadsInput);
                    if (isNaN(val) || val <= 0) {
                      setThreadsInput('');
                      setThreads(-1);
                    } else {
                      setThreads(val);
                    }
                  }}
                  min={1}
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
                  <Input
                    type="number"
                    value={previewInterval.toString()}
                    onChange={(_, data) => {
                      const val = parseInt(data.value) || 1;
                      setPreviewInterval(Math.max(1, Math.min(100, val)));
                    }}
                    min={1}
                    max={100}
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

