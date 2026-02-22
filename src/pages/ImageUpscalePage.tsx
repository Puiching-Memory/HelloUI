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
  SpinButton,
  Checkbox,
  Text,
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  DocumentArrowDownRegular,
  ArrowUploadRegular,
  DismissRegular,
  ArrowDownloadRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIpcListener } from '../hooks/useIpcListener';
import { ipcInvoke, ipcListen } from '../lib/tauriIpc';
import { useAppStore } from '../hooks/useAppStore';
import { useCliOutput } from '../hooks/useCliOutput';
import { useModelGroups, useDeviceType } from '../hooks/useModelGroups';
import { useSharedStyles } from '../styles/sharedStyles';
import { CliOutputPanel } from '../components/CliOutputPanel';
import { MessageDialog, useMessageDialog } from '../components/MessageDialog';
import { getDeviceLabel, getEngineValue, getModelInfo } from '../utils/modelUtils';
import { toMediaUrl } from '@/utils/tauriPath';
import type { AvailableEngine } from '../../shared/types';

// 页面特有的样式（上传区域）
const useLocalStyles = makeStyles({
  uploadSection: {
    display: 'flex',
    flexDirection: 'column',
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
    display: 'inline-block',
    marginTop: tokens.spacingVerticalM,
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

export const ImageUpscalePage = () => {
  const styles = useSharedStyles();
  const localStyles = useLocalStyles();
  const navigate = useNavigate();
  const { setIsGenerating } = useAppStore();
  const { modelGroups, loading, selectedGroupId, setSelectedGroupId, selectedGroup, isGroupComplete, reloadModelGroups } = useModelGroups('upscale');
  const { deviceType, cpuVariant, handleDeviceTypeChange, availableEngines } = useDeviceType();
  const cli = useCliOutput('generate:cli-output');
  const msgDialog = useMessageDialog();
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [steps, setSteps] = useState<number>(20);
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [cfgScale, setCfgScale] = useState<number>(7.0);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImagePath, setGeneratedImagePath] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
  // 上采样相关参数
  const [scaleFactor, setScaleFactor] = useState<number>(2);
  
  // 其他参数状态
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');
  const [scheduler, setScheduler] = useState<string>('discrete');
  const [seed, setSeed] = useState<number>(-1);
  const [batchCount, setBatchCount] = useState<number>(1);
  const [threads, setThreads] = useState<number>(-1);
  const [preview, setPreview] = useState<string>('proj');
  const [previewInterval, setPreviewInterval] = useState<number>(1);
  const [verbose, setVerbose] = useState<boolean>(false);
  const [color, setColor] = useState<boolean>(true);
  const [offloadToCpu, setOffloadToCpu] = useState<boolean>(false);
  const [diffusionFa, setDiffusionFa] = useState<boolean>(true);
  const [controlNetCpu, setControlNetCpu] = useState<boolean>(false);
  const [clipOnCpu, setClipOnCpu] = useState<boolean>(false);
  const [vaeOnCpu, setVaeOnCpu] = useState<boolean>(false);
  const [diffusionConvDirect, setDiffusionConvDirect] = useState<boolean>(false);
  const [vaeConvDirect, setVaeConvDirect] = useState<boolean>(false);
  const [vaeTiling, setVaeTiling] = useState<boolean>(true);
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

  const handleUpscale = async () => {
    if (!selectedGroupId) {
      msgDialog.showMessage('提示', '请选择模型组');
      return;
    }
    if (!inputImagePath) {
      msgDialog.showMessage('提示', '请先选择要上采样的图片');
      return;
    }

    try {
      setGenerating(true);
      setGeneratedImage(null);
      setPreviewImage(null);
      setGenerationProgress('正在初始化...');
      cli.clearOutput(); // 清空之前的输出

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
        if (!selectedGroup.sdModel) {
          throw new Error('所选模型组中未配置SD模型');
        }

        // 计算上采样后的尺寸
        const upscaledWidth = Math.round(width * scaleFactor);
        const upscaledHeight = Math.round(height * scaleFactor);

        const result = await ipcInvoke('generate:start', {
          groupId: selectedGroupId,
          deviceType: cpuVariant ? `cpu-${cpuVariant}` : deviceType,
          prompt: prompt.trim() || 'upscale image, high quality, detailed',
          negativePrompt: negativePrompt.trim(),
          steps,
          width: upscaledWidth,
          height: upscaledHeight,
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
          inputImage: inputImagePath,
        });

        if (result.success && result.image) {
          setGeneratedImage(result.image);
          if (result.imagePath) {
            setGeneratedImagePath(result.imagePath);
          }
          setPreviewImage(null);
          setGenerationProgress('上采样完成');
        } else {
          throw new Error(result.error || '上采样失败');
        }
      } finally {
        unlisten();
        setGenerating(false);
      }
    } catch (error) {
      console.error('Failed to upscale image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('生成已取消') && !errorMessage.includes('cancelled')) {
        msgDialog.showMessage('上采样失败', `上采样失败: ${errorMessage}`);
      }
      setGenerationProgress('');
      setGenerating(false);
    }
  };

  const handleCancelUpscale = async () => {
    try {
      await ipcInvoke('generate:cancel');
      setGenerationProgress('正在取消...');
    } catch (error) {
      console.error('Failed to cancel upscale:', error);
    }
  };

  const handleSaveGeneratedImage = async () => {
    if (!generatedImagePath) return;
    try {
      await ipcInvoke('generated-images:download', generatedImagePath);
    } catch (error) {
      console.error('Failed to save image:', error);
    }
  };

  const handleSelectImage = async () => {
    try {
      const filePath = await ipcInvoke('edit-image:select-file');
      if (filePath) {
        setInputImagePath(filePath);
        const previewUrl = toMediaUrl(filePath);
        setInputImagePreview(previewUrl);
        
        // 加载图片尺寸
        const img = new Image();
        img.onload = () => {
          setWidth(img.width);
          setHeight(img.height);
        };
        img.src = previewUrl;
      }
    } catch (error) {
      console.error('Failed to select image:', error);
      msgDialog.showMessage('错误', '选择图片失败，请重试');
    }
  };

  const handleRemoveImage = () => {
    setInputImagePath(null);
    setInputImagePreview(null);
    setWidth(512);
    setHeight(512);
  };

  return (
    <div className={styles.container}>
      <Title1>图像超分辨率</Title1>

      {/* 浮动控制面板 - 固定在底部，集成 CLI 输出 */}
      <div className={styles.floatingControlPanelWithCli}>
        <div className={styles.floatingControlPanelActions}>
          {generating ? (
            <Button
              onClick={handleCancelUpscale}
              appearance="secondary"
              size="large"
            >
              取消上采样
            </Button>
          ) : (
            <Button
              icon={<ImageAddRegular />}
              onClick={handleUpscale}
              disabled={!selectedGroupId || !inputImagePath || loading}
              appearance="primary"
              size="large"
            >
              开始上采样
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

      {/* 预览区域 */}
      <Card className={styles.previewCard}>
        <Title2>上采样结果</Title2>
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
                    {generationProgress || '正在上采样...'}
                  </Body1>
                </>
              ) : (
                <>
                  <Spinner size="large" />
                  <Body1 style={{ marginTop: tokens.spacingVerticalM }}>
                    {generationProgress || '正在上采样...'}
                  </Body1>
                </>
              )}
            </div>
          ) : generatedImage ? (
            <>
              <PhotoView src={generatedImage}>
                <img 
                  src={generatedImage} 
                  alt="上采样后的图片" 
                  className={styles.previewImage}
                  title="点击放大查看"
                />
              </PhotoView>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                {generationProgress || '上采样完成'}
              </Body1>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Body1>上采样后的图片将显示在这里</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
                请先选择要上采样的图片，配置参数后点击"开始上采样"按钮
              </Body1>
            </div>
          )}
        </div>
      </Card>

      {/* 配置区域 */}
      <Card className={styles.configCard}>
        <Title2>上采样配置</Title2>
        <div className={styles.formSection}>
          {/* 图片上传区域 */}
          <Field label="待上采样图片" required>
            <div className={localStyles.uploadSection}>
              {inputImagePreview ? (
                <div className={localStyles.uploadedImageContainer}>
                  <PhotoView src={inputImagePreview}>
                    <img 
                      src={inputImagePreview} 
                      alt="待上采样图片" 
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
                    点击选择要上采样的图片
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

          {/* 上采样倍数 */}
          <Field label="上采样倍数" hint="默认: 2倍（2x）">
            <SpinButton
              value={scaleFactor}
              onChange={(_, data) => setScaleFactor(data.value ?? 2)}
              min={1}
              max={8}
              step={0.5}
            />
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
              上采样后尺寸: {inputImagePath ? `${Math.round(width * scaleFactor)} × ${Math.round(height * scaleFactor)}` : '未知'}
            </Body1>
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
                  const selectedGroup = modelGroups.find(g => g.id === data.optionValue);
                  if (selectedGroup) {
                    if (selectedGroup.defaultSteps !== undefined) {
                      setSteps(selectedGroup.defaultSteps);
                    }
                    if (selectedGroup.defaultCfgScale !== undefined) {
                      setCfgScale(selectedGroup.defaultCfgScale);
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
          <Field label="提示词（可选）" hint="留空将使用默认提示词">
            <Textarea
              value={prompt}
              onChange={(_, data) => setPrompt(data.value)}
              placeholder="输入图片描述，例如：high quality, detailed, sharp"
              rows={3}
              resize="vertical"
            />
          </Field>

          {/* 负面提示词 */}
          <Field label="负面提示词（可选）">
            <Textarea
              value={negativePrompt}
              onChange={(_, data) => setNegativePrompt(data.value)}
              placeholder="输入不希望出现在图片中的内容"
              rows={2}
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
