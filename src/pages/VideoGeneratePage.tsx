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
  TabList,
  Tab,
} from '@fluentui/react-components';
import {
  VideoClipRegular,
  DocumentArrowDownRegular,
  ImageAddRegular,
  ArrowUploadRegular,
  DismissRegular,
  ArrowDownloadRegular,
} from '@fluentui/react-icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../hooks/useAppStore';
import { ipcInvoke, ipcListen } from '../lib/tauriIpc';
import { useSharedStyles } from '@/styles/sharedStyles';
import { useCliOutput } from '@/hooks/useCliOutput';
import { useModelGroups, useDeviceType } from '@/hooks/useModelGroups';
import { CliOutputPanel } from '@/components/CliOutputPanel';
import { MessageDialog, useMessageDialog } from '@/components/MessageDialog';
import { getDeviceLabel, getModelInfo } from '@/utils/modelUtils';
import { toMediaUrl } from '@/utils/tauriPath';
import type { DeviceType } from '../../shared/types';

const useLocalStyles = makeStyles({
  previewVideo: {
    width: 'auto',
    height: 'auto',
    maxWidth: '50vw',
    maxHeight: '50vh',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  framePreviewLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    height: '100%',
  },
  framePreviewMain: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    minHeight: '260px',
  },
  framePreviewImage: {
    maxWidth: '100%',
    maxHeight: '50vh',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    objectFit: 'contain',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  frameTimeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  frameTimelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  frameTimelineTrack: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: 'auto',
  },
  frameThumbnailButton: {
    border: 'none',
    padding: 0,
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  frameThumbnail: {
    width: '72px',
    height: '72px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  frameThumbnailSelected: {
    outline: `2px solid ${tokens.colorBrandStroke1}`,
    outlineOffset: '1px',
  },
  frameTimecode: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
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
    width: '100%',
    boxSizing: 'border-box',
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
    maxHeight: '300px',
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
  modeSelector: {
    marginBottom: tokens.spacingVerticalM,
  },
});

// 默认负面提示词（针对视频生成优化）
const DEFAULT_NEGATIVE_PROMPT = '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';

export const VideoGeneratePage = () => {
  const styles = useSharedStyles();
  const localStyles = useLocalStyles();
  const navigate = useNavigate();
  const { setIsGenerating } = useAppStore();
  const models = useModelGroups('video');
  const device = useDeviceType();
  const cli = useCliOutput('generate-video:cli-output');
  const msgDialog = useMessageDialog();
  const [generationMode, setGenerationMode] = useState<'text2video' | 'image2video'>('text2video');
  const [initImage, setInitImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>(DEFAULT_NEGATIVE_PROMPT);
  const [steps, setSteps] = useState<number>(20);
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [cfgScale, setCfgScale] = useState<number>(7.0);
  const [generating, setGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generatedVideoPath, setGeneratedVideoPath] = useState<string | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
  // 视频生成特有参数
  const [frames, setFrames] = useState<number>(33); // 视频帧数 (Wan2.2 默认 33)
  const [fps, setFps] = useState<number>(8); // 帧率
  const [flowShift, setFlowShift] = useState<number>(3.0); // Flow Shift (Wan2.2 默认 3.0)
  
  // 其他参数
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');
  const [highNoiseSteps, setHighNoiseSteps] = useState<number | undefined>(undefined);
  const [highNoiseCfgScale, setHighNoiseCfgScale] = useState<number | undefined>(undefined);
  const [highNoiseSamplingMethod, setHighNoiseSamplingMethod] = useState<string | undefined>(undefined);
  const [scheduler, setScheduler] = useState<string>('discrete');
  const [seed, setSeed] = useState<number>(-1);
  const [batchCount, setBatchCount] = useState<number>(1);
  const [threads, setThreads] = useState<number>(-1);
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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // 通知父组件生成状态变化
  useEffect(() => {
    setIsGenerating(generating);
  }, [generating, setIsGenerating]);

  // 当选择的模型组变化时，更新默认参数
  useEffect(() => {
    if (models.selectedGroupId) {
      const group = models.modelGroups.find(g => g.id === models.selectedGroupId);
      if (group) {
        if (group.defaultSteps) setSteps(group.defaultSteps);
        if (group.defaultCfgScale) setCfgScale(group.defaultCfgScale);
        if (group.defaultWidth) {
          setWidth(group.defaultWidth);
        }
        if (group.defaultHeight) {
          setHeight(group.defaultHeight);
        }
        if (group.defaultFlowShift) setFlowShift(group.defaultFlowShift);
      }
    }
  }, [models.selectedGroupId, models.modelGroups]);

  const handleImageUpload = async () => {
    try {
      const result = await ipcInvoke('dialog:open-image');
      if (result) {
        // 使用 media:/// 协议加载本地图片
        setInitImage(toMediaUrl(result));
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const handleRemoveImage = () => {
    setInitImage(null);
  };

  const handleGenerate = async () => {
    if (!models.selectedGroupId || !prompt.trim()) {
      msgDialog.showMessage('提示', '请选择模型组并输入提示词');
      return;
    }

    try {
      setGenerating(true);
      setGeneratedVideo(null);
      setVideoFrames([]);
      setSelectedFrameIndex(0);
      setGenerationProgress('');
      cli.clearOutput();

      // 监听进度更新
      const unlisten = await ipcListen('generate-video:progress', (data) => {
        if (data.progress) {
          setGenerationProgress(String(data.progress));
        }
        if (data.video) {
          setGeneratedVideo(data.video);
        }
        if (data.frames && Array.isArray(data.frames) && data.frames.length > 0) {
          setVideoFrames(data.frames);
          setSelectedFrameIndex(prev => {
            if (prev < 0 || prev >= data.frames!.length) {
              return 0;
            }
            return prev;
          });
        }
      });

      try {
        const result = await ipcInvoke('generate-video:start', {
          groupId: models.selectedGroupId,
          deviceType: device.deviceType,
          mode: generationMode,
          initImage: generationMode === 'image2video' ? (initImage || undefined) : undefined,
          prompt,
          negativePrompt: negativePrompt || undefined,
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
          frames, // 视频帧数
          fps, // 帧率
          flowShift, // Flow Shift
          highNoiseSteps,
          highNoiseCfgScale,
          highNoiseSamplingMethod,
        });

        if (result.success && (result.video || (result.frames && result.frames.length > 0))) {
          if (result.video) {
            setGeneratedVideo(result.video);
            if (result.videoPath) {
              setGeneratedVideoPath(result.videoPath);
            }
          }
          if (result.frames && Array.isArray(result.frames) && result.frames.length > 0) {
            setVideoFrames(result.frames);
            setSelectedFrameIndex(0);
          }
          setGenerationProgress('生成完成');
        } else {
          throw new Error(result.error || '生成失败');
        }
      } finally {
        unlisten();
        setGenerating(false);
      }
    } catch (error) {
      console.error('Failed to generate video:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('生成已取消') && !errorMessage.includes('cancelled')) {
        msgDialog.showMessage('生成失败', `生成视频失败: ${errorMessage}`);
      }
      setGenerationProgress('');
      setGenerating(false);
    }
  };

  const handleCancelGenerate = async () => {
    try {
      await ipcInvoke('generate-video:cancel');
      setGenerationProgress('正在取消...');
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    }
  };

  const handleSaveGeneratedVideo = async () => {
    if (!generatedVideoPath) return;
    try {
      await ipcInvoke('generated-images:download', generatedVideoPath);
    } catch (error) {
      console.error('Failed to save video:', error);
    }
  };

  return (
    <div className={styles.container}>
      <Title1>视频生成</Title1>

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
              icon={<VideoClipRegular />}
              onClick={handleGenerate}
              disabled={!models.selectedGroupId || !prompt.trim() || models.loading}
              appearance="primary"
              size="large"
            >
              开始生成
            </Button>
          )}
          <Button
            icon={<DocumentArrowDownRegular />}
            onClick={handleSaveGeneratedVideo}
            disabled={models.loading || generating || !generatedVideoPath}
          >
            保存最新视频
          </Button>
          <Button
            onClick={models.reloadModelGroups}
            disabled={models.loading || generating}
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
          emptyMessage="暂无输出，开始生成后将显示 SD.cpp 的 CLI 输出"
          variant="floating"
        />
      </div>

      {/* 预览区域 */}
      <Card className={styles.previewCard}>
        <Title2>生成结果</Title2>
        <div className={styles.previewSection}>
          {generating ? (
            <div className={styles.emptyState}>
              <Spinner size="large" />
              <Body1 style={{ marginTop: tokens.spacingVerticalM }}>
                {generationProgress || '正在生成视频...'}
              </Body1>
            </div>
          ) : videoFrames.length > 0 ? (
            <div className={localStyles.framePreviewLayout}>
              <div className={localStyles.framePreviewMain}>
                <img
                  src={videoFrames[Math.min(selectedFrameIndex, videoFrames.length - 1)]}
                  alt={`第 ${selectedFrameIndex + 1} 帧预览`}
                  className={localStyles.framePreviewImage}
                />
              </div>
              <div className={localStyles.frameTimeline}>
                <div className={localStyles.frameTimelineHeader}>
                  <Body1>帧预览时间线</Body1>
                  <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                    第 {selectedFrameIndex + 1}/{videoFrames.length} 帧 · {fps} FPS
                  </Body1>
                </div>
                <div className={localStyles.frameTimelineTrack}>
                  {videoFrames.map((frame, index) => {
                    const isSelected = index === selectedFrameIndex;
                    const timeInSeconds = (index / Math.max(fps, 1)).toFixed(2);
                    return (
                      <button
                        key={index}
                        type="button"
                        className={localStyles.frameThumbnailButton}
                        onClick={() => setSelectedFrameIndex(index)}
                      >
                        <img
                          src={frame}
                          alt={`第 ${index + 1} 帧`}
                          className={`${localStyles.frameThumbnail} ${isSelected ? localStyles.frameThumbnailSelected : ''}`}
                        />
                        <span className={localStyles.frameTimecode}>{timeInSeconds}s</span>
                      </button>
                    );
                  })}
                </div>
                <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                  {generationProgress || '生成完成'}
                </Body1>
              </div>
            </div>
          ) : generatedVideo ? (
            <>
              <video
                src={generatedVideo}
                controls
                className={localStyles.previewVideo}
                style={{ maxWidth: '50vw', maxHeight: '50vh' }}
              />
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                {generationProgress || '生成完成'}
              </Body1>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Body1>生成的视频将显示在这里</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
                请在下方配置生成参数并点击"开始生成"按钮
              </Body1>
            </div>
          )}
        </div>
      </Card>

      {/* 配置区域 */}
      <Card className={styles.configCard}>
        <Title2>生成配置</Title2>
        <div className={styles.formSection}>
          {/* 模型组选择 */}
          <Field label="选择模型组" required>
            <Dropdown
              placeholder={models.loading ? '加载中...' : '请选择模型组'}
              disabled={models.loading || models.modelGroups.length === 0}
              value={models.selectedGroup?.name || ''}
              selectedOptions={[models.selectedGroupId]}
              onOptionSelect={(_, data) => {
                if (data.optionValue) {
                  models.setSelectedGroupId(data.optionValue);
                  const group = models.modelGroups.find(g => g.id === data.optionValue);
                  if (group) {
                    if (group.defaultSteps !== undefined) {
                      setSteps(group.defaultSteps);
                    }
                    if (group.defaultCfgScale !== undefined) {
                      setCfgScale(group.defaultCfgScale);
                    }
                    if (group.defaultWidth !== undefined) {
                      setWidth(group.defaultWidth);
                    }
                    if (group.defaultHeight !== undefined) {
                      setHeight(group.defaultHeight);
                    }
                    if (group.defaultSamplingMethod !== undefined) {
                      setSamplingMethod(group.defaultSamplingMethod);
                    }
                    if (group.defaultHighNoiseSteps !== undefined) {
                      setHighNoiseSteps(group.defaultHighNoiseSteps);
                    } else {
                      setHighNoiseSteps(undefined);
                    }
                    if (group.defaultHighNoiseCfgScale !== undefined) {
                      setHighNoiseCfgScale(group.defaultHighNoiseCfgScale);
                    } else {
                      setHighNoiseCfgScale(undefined);
                    }
                    if (group.defaultHighNoiseSamplingMethod !== undefined) {
                      setHighNoiseSamplingMethod(group.defaultHighNoiseSamplingMethod);
                    } else {
                      setHighNoiseSamplingMethod(undefined);
                    }
                    if (group.defaultScheduler !== undefined) {
                      setScheduler(group.defaultScheduler);
                    }
                    if (group.defaultSeed !== undefined) {
                      if (group.defaultSeed >= 0) {
                        setSeed(group.defaultSeed);
                      } else {
                        setSeed(-1);
                      }
                    }
                  }
                }
              }}
            >
              {models.modelGroups.map((group) => {
                const complete = models.isGroupComplete(group.id)
                return (
                  <Option 
                    key={group.id} 
                    value={group.id} 
                    text={group.name}
                    disabled={!complete}
                  >
                    {group.name}{!complete ? ' (文件缺失)' : ''}
                  </Option>
                )
              })}
            </Dropdown>
          </Field>
          <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
            {models.modelGroups.length === 0
              ? '暂无可用模型组，请先在"模型权重管理"页面创建支持视频生成的模型组'
              : models.selectedGroup
              ? `已选择: ${models.selectedGroup.name}${getModelInfo(models.selectedGroup) ? ` (${getModelInfo(models.selectedGroup)})` : ''}`
              : models.modelGroups.some(g => !models.isGroupComplete(g.id))
              ? '部分模型组文件缺失，请先在"模型权重管理"页面下载缺失文件'
              : '请选择模型组'}
          </Body1>

          {/* 生成模式选择 */}
          <div className={localStyles.modeSelector}>
            <TabList
              selectedValue={generationMode}
              onTabSelect={(_, data) => setGenerationMode(data.value as 'text2video' | 'image2video')}
            >
              <Tab value="text2video">文字生成视频 (Text to Video)</Tab>
              <Tab value="image2video">图片生成视频 (Image to Video)</Tab>
            </TabList>
          </div>

          {/* 图片上传区域 (仅在 image2video 模式下显示) */}
          {generationMode === 'image2video' && (
            <div className={localStyles.uploadSection}>
              {!initImage ? (
                <div className={localStyles.uploadArea} onClick={handleImageUpload}>
                  <ImageAddRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                  <div style={{ textAlign: 'center' }}>
                    <Text block weight="semibold">点击上传参考图片</Text>
                    <Body1 block style={{ color: tokens.colorNeutralForeground3 }}>支持 JPG, PNG, WebP 格式</Body1>
                  </div>
                </div>
              ) : (
                <div className={localStyles.uploadedImageContainer}>
                  <img src={initImage} alt="参考图片" className={localStyles.uploadedImage} />
                  <Button
                    className={localStyles.removeImageButton}
                    icon={<DismissRegular />}
                    appearance="subtle"
                    onClick={handleRemoveImage}
                    title="移除图片"
                  />
                  <div style={{ position: 'absolute', bottom: tokens.spacingVerticalS, left: '50%', transform: 'translateX(-50%)' }}>
                    <Button
                      size="small"
                      icon={<ArrowUploadRegular />}
                      onClick={handleImageUpload}
                    >
                      更换图片
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 提示词输入 */}
          <Field label="提示词" required>
            <Textarea
              value={prompt}
              onChange={(_, data) => setPrompt(data.value)}
              placeholder="输入视频描述，例如：一幅美丽的山水画，有山峰和湖泊，平滑的镜头移动"
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
              placeholder="输入不希望出现在视频中的内容"
              rows={3}
              resize="vertical"
            />
          </Field>

          {/* 视频生成特有参数 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacingHorizontalM }}>
            <Field label="视频帧数" hint="默认: 16">
              <SpinButton
                value={frames}
                onChange={(_, data) => setFrames(data.value ?? 16)}
                min={1}
                max={128}
                step={1}
              />
            </Field>
            <Field label="帧率 (FPS)" hint="默认: 8">
              <SpinButton
                value={fps}
                onChange={(_, data) => setFps(data.value ?? 8)}
                min={1}
                max={60}
                step={1}
              />
            </Field>
          </div>

          {/* 推理引擎和模型设备分配 */}
          <div className={styles.modelDeviceCard}>
            <div className={styles.modelDeviceHeader}>
              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase400 }}>
                推理引擎和模型设备分配
              </Text>
            </div>
            <div style={{ marginBottom: tokens.spacingVerticalM }}>
              <Field label="推理引擎" hint={device.availableEngines.length === 0 ? "请先在「SD.cpp 管理」页面下载推理引擎" : "选择主要的推理引擎（CUDA/Vulkan/CPU）"}>
                {device.availableEngines.length === 0 ? (
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
                    value={getDeviceLabel(device.deviceType)}
                    selectedOptions={[device.deviceType]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        device.handleDeviceTypeChange(data.optionValue as DeviceType);
                      }
                    }}
                  >
                    <Option disabled={!device.availableEngines.includes('cpu')} value="cpu">CPU</Option>
                    <Option disabled={!device.availableEngines.includes('vulkan')} value="vulkan">Vulkan</Option>
                    <Option disabled={!device.availableEngines.includes('cuda')} value="cuda">CUDA</Option>
                    <Option disabled={!device.availableEngines.includes('rocm')} value="rocm">ROCm</Option>
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
                </div>
                <div className={styles.modelDeviceItemRight}>
                  <Dropdown
                    className={styles.modelDeviceSelector}
                    value={controlNetCpu ? 'CPU' : getDeviceLabel(device.deviceType)}
                    selectedOptions={[controlNetCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setControlNetCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(device.deviceType)}</Option>
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
                </div>
                <div className={styles.modelDeviceItemRight}>
                  <Dropdown
                    className={styles.modelDeviceSelector}
                    value={clipOnCpu ? 'CPU' : getDeviceLabel(device.deviceType)}
                    selectedOptions={[clipOnCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setClipOnCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(device.deviceType)}</Option>
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
                </div>
                <div className={styles.modelDeviceItemRight}>
                  <Dropdown
                    className={styles.modelDeviceSelector}
                    value={vaeOnCpu ? 'CPU' : getDeviceLabel(device.deviceType)}
                    selectedOptions={[vaeOnCpu ? 'force-cpu' : 'main-device']}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setVaeOnCpu(data.optionValue === 'force-cpu');
                      }
                    }}
                  >
                    <Option value="force-cpu">CPU</Option>
                    <Option value="main-device">{getDeviceLabel(device.deviceType)}</Option>
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
            <Field label="视频宽度" hint="默认: 512，自动对齐到 16 的倍数">
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
            <Field label="视频高度" hint="默认: 512，自动对齐到 16 的倍数">
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
            <Field label="采样方法" hint="默认: euler">
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

            <Field label="Flow Shift" hint="Wan2.2 默认: 3.0">
              <SpinButton
                value={flowShift}
                onChange={(_, data) => setFlowShift(data.value ?? 3.0)}
                step={0.1}
              />
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
      <MessageDialog
        open={msgDialog.open}
        title={msgDialog.title}
        message={msgDialog.message}
        onClose={msgDialog.close}
      />
    </div>
  );
};
