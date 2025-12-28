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
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  CounterBadge,
  TabList,
  Tab,
  TabValue,
} from '@fluentui/react-components';
import {
  VideoClipRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  CopyRegular,
  DocumentArrowDownRegular,
  ImageAddRegular,
  ArrowUploadRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useIpcListener } from '../hooks/useIpcListener';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
    paddingBottom: '120px', // 为浮动控制面板留出空间
    minHeight: '100%',
    maxWidth: '1600px',
    margin: '0 auto',
  },
  previewCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
  },
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: tokens.spacingVerticalM,
  },
  previewVideo: {
    width: 'auto',
    height: 'auto',
    maxWidth: '50vw',
    maxHeight: '50vh',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  configCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    flex: '0 0 auto',
    maxHeight: '50%',
    overflow: 'auto',
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  floatingControlPanel: {
    position: 'fixed',
    bottom: tokens.spacingVerticalL,
    // 与 container 对齐：container 在 mainContent 中（从 240px 开始）居中，maxWidth: 1600px
    // 使用与 container 相同的布局逻辑
    left: `calc(240px + ${tokens.spacingVerticalL})`,
    right: tokens.spacingVerticalL,
    maxWidth: '1600px',
    width: 'auto',
    margin: '0 auto',
    zIndex: 1000,
    boxShadow: tokens.shadow28,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalM,
    // 云母 / 亚克力效果：使用伪元素实现半透明背景，保持内容不透明
    backgroundColor: 'transparent',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    // 根据主题自动调整的高光描边
    outline: `1px solid ${tokens.colorNeutralStroke1}`,
    boxSizing: 'border-box',
    // 使用伪元素创建半透明背景层
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tokens.colorNeutralBackground1,
      opacity: 0.7,
      zIndex: -1,
      borderRadius: tokens.borderRadiusLarge,
    },
  },
  cliOutputCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    flex: '0 0 auto',
    maxHeight: '300px',
  },
  cliOutputCardWithNewMessage: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    flex: '0 0 auto',
    maxHeight: '300px',
    border: `2px solid ${tokens.colorBrandStroke1}`,
    boxShadow: `0 0 8px ${tokens.colorBrandStroke1}40`,
    transition: 'all 0.3s ease-in-out',
  },
  cliOutputHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    minHeight: '44px',
  },
  cliOutputHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
    padding: tokens.spacingVerticalXS,
    margin: `-${tokens.spacingVerticalXS}`,
    borderRadius: tokens.borderRadiusSmall,
    position: 'relative',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  cliOutputTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    position: 'relative',
  },
  cliOutputTitle: {
    position: 'relative',
  },
  cliOutputHeaderActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
    flexShrink: 0,
  },
  cliOutputContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: tokens.fontSizeBase200,
    maxHeight: '250px',
    overflowY: 'auto',
    overflowX: 'auto',
  },
  modelDeviceCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  modelDeviceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalXS,
  },
  modelDeviceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  modelDeviceItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusSmall,
  },
  modelDeviceItemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    flex: 1,
  },
  modelDeviceItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexShrink: 0,
  },
  modelDeviceSelector: {
    minWidth: '120px',
  },
  modelDeviceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXXS,
  },
  offloadToCpuSection: {
    marginTop: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  cliOutputLine: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: '1.5',
  },
  cliOutputLineStdout: {
    color: tokens.colorNeutralForeground1,
  },
  cliOutputLineStderr: {
    color: tokens.colorPaletteRedForeground1,
  },
  cliOutputEmpty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: tokens.spacingVerticalM,
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

interface ModelGroup {
  id: string;
  name: string;
  taskType?: 'generate' | 'edit' | 'video' | 'all';
  sdModel?: string;
  vaeModel?: string;
  llmModel?: string;
  clipVisionModel?: string;
  defaultSteps?: number;
  defaultCfgScale?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultSamplingMethod?: string;
  defaultScheduler?: string;
  defaultSeed?: number;
  defaultHighNoiseSteps?: number;
  defaultHighNoiseCfgScale?: number;
  defaultHighNoiseSamplingMethod?: string;
  createdAt: number;
  updatedAt: number;
}

type DeviceType = 'cpu' | 'vulkan' | 'cuda';

// 默认负面提示词（针对视频生成优化）
const DEFAULT_NEGATIVE_PROMPT = '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';

// 清理 ANSI 转义序列
const stripAnsiCodes = (text: string): string => {
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b[\(\)][0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b./g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
};

interface VideoGeneratePageProps {
  onGeneratingStateChange?: (isGenerating: boolean) => void;
}

export const VideoGeneratePage = ({ onGeneratingStateChange }: VideoGeneratePageProps) => {
  const styles = useStyles();
  const [generationMode, setGenerationMode] = useState<'text2video' | 'image2video'>('text2video');
  const [initImage, setInitImage] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [deviceType, setDeviceType] = useState<DeviceType>('cuda');
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>(DEFAULT_NEGATIVE_PROMPT);
  const [steps, setSteps] = useState<number>(20);
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [widthInput, setWidthInput] = useState<string>('512');
  const [heightInput, setHeightInput] = useState<string>('512');
  const [cfgScale, setCfgScale] = useState<number>(7.0);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generatedVideoPath, setGeneratedVideoPath] = useState<string | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [cliOutput, setCliOutput] = useState<Array<{ type: 'stdout' | 'stderr'; text: string; timestamp: number }>>([]);
  const [cliOutputExpanded, setCliOutputExpanded] = useState(false);
  const [hasUserCollapsed, setHasUserCollapsed] = useState(false); // 跟踪用户是否手动收起过
  const [lastViewedOutputCount, setLastViewedOutputCount] = useState(0); // 跟踪最后查看的输出行数
  const [copySuccess, setCopySuccess] = useState(false);
  const cliOutputRef = useRef<HTMLDivElement>(null);
  
  // 视频生成特有参数
  const [frames, setFrames] = useState<number>(33); // 视频帧数 (Wan2.2 默认 33)
  const [fps, setFps] = useState<number>(8); // 帧率
  const [flowShift, setFlowShift] = useState<number>(3.0); // Flow Shift (Wan2.2 默认 3.0)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogContent, setMessageDialogContent] = useState<{ title: string; message: string } | null>(null);
  
  // 其他参数
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');
  const [highNoiseSteps, setHighNoiseSteps] = useState<number | undefined>(undefined);
  const [highNoiseCfgScale, setHighNoiseCfgScale] = useState<number | undefined>(undefined);
  const [highNoiseSamplingMethod, setHighNoiseSamplingMethod] = useState<string | undefined>(undefined);
  const [scheduler, setScheduler] = useState<string>('discrete');
  const [seed, setSeed] = useState<number>(-1);
  const [seedInput, setSeedInput] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(1);
  const [threads, setThreads] = useState<number>(-1);
  const [threadsInput, setThreadsInput] = useState<string>('');
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

  // 加载模型组列表
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50;
    const checkAndLoad = () => {
      if (window.ipcRenderer) {
        loadModelGroups().catch(console.error);
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(checkAndLoad, 100);
      } else {
        console.error('window.ipcRenderer is not available after maximum retries');
      }
    };
    checkAndLoad();
  }, []);

  // 加载设备类型
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50;
    const checkAndLoad = () => {
      if (window.ipcRenderer) {
        loadDeviceType().catch(console.error);
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(checkAndLoad, 100);
      } else {
        console.error('window.ipcRenderer is not available after maximum retries');
      }
    };
    checkAndLoad();
  }, []);

  // 处理 CLI 输出
  const handleCliOutput = useCallback((data: { type: 'stdout' | 'stderr'; text: string }) => {
    const cleanedText = stripAnsiCodes(data.text);
    if (cleanedText.trim()) {
      setCliOutput(prev => {
        const lastLine = prev[prev.length - 1];
        if (lastLine && lastLine.text === cleanedText && lastLine.type === data.type) {
          return prev;
        }
        return [...prev, { ...data, text: cleanedText, timestamp: Date.now() }];
      });
    }
  }, []);

  // 监听 CLI 输出
  useIpcListener<{ type: 'stdout' | 'stderr'; text: string }>(
    'generate-video:cli-output',
    handleCliOutput
  );

  // 当 CLI 输出从无内容变为有内容时，自动展开（仅在初始状态下，即用户未手动收起过）
  useEffect(() => {
    if (cliOutput.length > 0 && !cliOutputExpanded && !hasUserCollapsed) {
      setCliOutputExpanded(true);
      setLastViewedOutputCount(cliOutput.length); // 自动展开时更新已查看数量
    }
  }, [cliOutput.length, cliOutputExpanded, hasUserCollapsed]);

  // 当展开时，更新最后查看的输出数量
  useEffect(() => {
    if (cliOutputExpanded) {
      setLastViewedOutputCount(cliOutput.length);
    }
  }, [cliOutputExpanded, cliOutput.length]);

  // 计算未读消息数
  const unreadCount = cliOutput.length - lastViewedOutputCount;

  // 自动滚动到底部
  useEffect(() => {
    if (cliOutputRef.current && cliOutputExpanded) {
      cliOutputRef.current.scrollTop = cliOutputRef.current.scrollHeight;
    }
  }, [cliOutput, cliOutputExpanded]);

  // 通知父组件生成状态变化
  useEffect(() => {
    if (onGeneratingStateChange) {
      onGeneratingStateChange(generating);
    }
  }, [generating, onGeneratingStateChange]);

  // 当选择的模型组变化时，更新默认参数
  useEffect(() => {
    if (selectedGroupId) {
      const group = modelGroups.find(g => g.id === selectedGroupId);
      if (group) {
        if (group.defaultSteps) setSteps(parseInt(group.defaultSteps));
        if (group.defaultCfgScale) setCfgScale(parseFloat(group.defaultCfgScale));
        if (group.defaultWidth) {
          setWidth(parseInt(group.defaultWidth));
          setWidthInput(group.defaultWidth);
        }
        if (group.defaultHeight) {
          setHeight(parseInt(group.defaultHeight));
          setHeightInput(group.defaultHeight);
        }
        if (group.defaultFlowShift) setFlowShift(parseFloat(group.defaultFlowShift));
      }
    }
  }, [selectedGroupId, modelGroups]);

  const loadModelGroups = async () => {
    try {
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      setLoading(true);
      const groups = await window.ipcRenderer.invoke('model-groups:list') as ModelGroup[];
      // 只显示支持视频生成的模型组（taskType 为 'video'）
      const videoGroups = groups.filter((g: ModelGroup) => g.taskType === 'video');
      setModelGroups(videoGroups);
    } catch (error) {
      console.error('Failed to load model groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceType = async () => {
    try {
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      const device = await window.ipcRenderer.invoke('sdcpp:get-device') as DeviceType;
      setDeviceType(device);
    } catch (error) {
      console.error('Failed to load device type:', error);
    }
  };

  const handleDeviceTypeChange = async (newDevice: DeviceType) => {
    try {
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      await window.ipcRenderer.invoke('sdcpp:set-device', newDevice);
      setDeviceType(newDevice);
    } catch (error) {
      console.error('Failed to set device type:', error);
    }
  };

  const handleImageUpload = async () => {
    try {
      if (!window.ipcRenderer) return;
      const result = await window.ipcRenderer.invoke('dialog:open-image');
      if (result) {
        // 使用 media:/// 协议加载本地图片，避免 Electron 安全限制
        setInitImage(`media:///${result.replace(/\\/g, '/')}`);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const handleRemoveImage = () => {
    setInitImage(null);
  };

  const handleGenerate = async () => {
    if (!window.ipcRenderer) {
      setMessageDialogContent({ title: '错误', message: 'IPC 渲染器不可用' });
      setMessageDialogOpen(true);
      return;
    }

    if (!selectedGroupId || !prompt.trim()) {
      setMessageDialogContent({ title: '提示', message: '请选择模型组并输入提示词' });
      setMessageDialogOpen(true);
      return;
    }

    try {
      setGenerating(true);
      setGeneratedVideo(null);
      setVideoFrames([]);
      setSelectedFrameIndex(0);
      setGenerationProgress('');
      setCliOutput([]); // 清空之前的输出
      setHasUserCollapsed(false); // 重置用户收起状态，允许新的自动展开
      setLastViewedOutputCount(0); // 重置已查看数量

      // 监听进度更新
      const progressListener = (data: { progress?: string; video?: string; frames?: string[] }) => {
        if (data.progress) {
          setGenerationProgress(data.progress);
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
      };

      if (window.ipcRenderer) {
        window.ipcRenderer.on('generate-video:progress', progressListener);
      }

      try {
        const result = await window.ipcRenderer.invoke('generate-video:start', {
          groupId: selectedGroupId,
          deviceType,
          mode: generationMode,
          initImage: generationMode === 'image2video' ? initImage : undefined,
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
        if (window.ipcRenderer) {
          window.ipcRenderer.off('generate-video:progress', progressListener);
        }
        setGenerating(false);
      }
    } catch (error) {
      console.error('Failed to generate video:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('生成已取消') && !errorMessage.includes('cancelled')) {
        setMessageDialogContent({ title: '生成失败', message: `生成视频失败: ${errorMessage}` });
        setMessageDialogOpen(true);
      }
      setGenerationProgress('');
      setGenerating(false);
    }
  };

  const handleCancelGenerate = async () => {
    if (!window.ipcRenderer) return;
    
    try {
      await window.ipcRenderer.invoke('generate-video:cancel');
      setGenerationProgress('正在取消...');
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    }
  };

  const handleSaveGeneratedVideo = async () => {
    if (!generatedVideoPath) return;
    try {
      await window.ipcRenderer.invoke('generated-images:download', generatedVideoPath);
    } catch (error) {
      console.error('Failed to save video:', error);
    }
  };

  const getDeviceLabel = (device: DeviceType): string => {
    switch (device) {
      case 'cpu':
        return 'CPU';
      case 'vulkan':
        return 'Vulkan';
      case 'cuda':
        return 'CUDA';
      default:
        return device;
    }
  };

  const selectedGroup = modelGroups.find(g => g.id === selectedGroupId);
  const getModelInfo = (group: ModelGroup | undefined): string => {
    if (!group) return '';
    const parts: string[] = [];
    if (group.sdModel) {
      const sdName = group.sdModel.split(/[/\\]/).pop() || 'SD模型';
      parts.push(`SD: ${sdName}`);
    }
    if (group.vaeModel) {
      const vaeName = group.vaeModel.split(/[/\\]/).pop() || 'VAE模型';
      parts.push(`VAE: ${vaeName}`);
    }
    if (group.llmModel) {
      const llmName = group.llmModel.split(/[/\\]/).pop() || 'LLM模型';
      parts.push(`LLM: ${llmName}`);
    }
    if (group.clipVisionModel) {
      const clipVisionName = group.clipVisionModel.split(/[/\\]/).pop() || 'CLIP Vision';
      parts.push(`CLIP Vision: ${clipVisionName}`);
    }
    return parts.join(' | ');
  };

  return (
    <div className={styles.container}>
      <Title1>视频生成</Title1>

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
              icon={<VideoClipRegular />}
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
            onClick={handleSaveGeneratedVideo}
            disabled={loading || generating || !generatedVideoPath}
          >
            保存最新视频
          </Button>
          <Button
            onClick={loadModelGroups}
            disabled={loading || generating}
          >
            刷新模型组列表
          </Button>
        </div>
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
            <div className={styles.framePreviewLayout}>
              <div className={styles.framePreviewMain}>
                <img
                  src={videoFrames[Math.min(selectedFrameIndex, videoFrames.length - 1)]}
                  alt={`第 ${selectedFrameIndex + 1} 帧预览`}
                  className={styles.framePreviewImage}
                />
              </div>
              <div className={styles.frameTimeline}>
                <div className={styles.frameTimelineHeader}>
                  <Body1>帧预览时间线</Body1>
                  <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                    第 {selectedFrameIndex + 1}/{videoFrames.length} 帧 · {fps} FPS
                  </Body1>
                </div>
                <div className={styles.frameTimelineTrack}>
                  {videoFrames.map((frame, index) => {
                    const isSelected = index === selectedFrameIndex;
                    const timeInSeconds = (index / Math.max(fps, 1)).toFixed(2);
                    return (
                      <button
                        key={index}
                        type="button"
                        className={styles.frameThumbnailButton}
                        onClick={() => setSelectedFrameIndex(index)}
                      >
                        <img
                          src={frame}
                          alt={`第 ${index + 1} 帧`}
                          className={`${styles.frameThumbnail} ${isSelected ? styles.frameThumbnailSelected : ''}`}
                        />
                        <span className={styles.frameTimecode}>{timeInSeconds}s</span>
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
                className={styles.previewVideo}
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

      {/* CLI 输出窗口 */}
      <Card className={!cliOutputExpanded && unreadCount > 0 ? styles.cliOutputCardWithNewMessage : styles.cliOutputCard}>
        <div className={styles.cliOutputHeader}>
          <div 
            className={styles.cliOutputHeaderLeft}
            onClick={() => {
              const newExpanded = !cliOutputExpanded;
              setCliOutputExpanded(newExpanded);
              // 如果用户手动收起，记录这个状态
              if (!newExpanded) {
                setHasUserCollapsed(true);
              } else {
                // 展开时更新已查看数量
                setLastViewedOutputCount(cliOutput.length);
              }
            }}
          >
            <div className={styles.cliOutputTitleContainer}>
              <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0, whiteSpace: 'nowrap' }} className={styles.cliOutputTitle}>
                CLI 输出
              </Title2>
              {!cliOutputExpanded && unreadCount > 0 && (
                <CounterBadge 
                  count={unreadCount} 
                  color="brand" 
                  size="small"
                  style={{ position: 'absolute', top: '-4px', right: '-8px' }}
                />
              )}
            </div>
            {cliOutputExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
          </div>
          <div className={styles.cliOutputHeaderActions}>
            <Button
              size="small"
              icon={<CopyRegular />}
              onClick={(e) => {
                e.stopPropagation();
                const text = cliOutput.map(line => line.text).join('');
                navigator.clipboard.writeText(text).then(() => {
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }).catch((error) => {
                  console.error('复制失败:', error);
                });
              }}
              disabled={cliOutput.length === 0}
              appearance="subtle"
              style={copySuccess ? { color: tokens.colorPaletteGreenForeground1 } : undefined}
            >
              {copySuccess ? '已复制' : '复制'}
            </Button>
            <Button
              size="small"
              icon={<DocumentArrowDownRegular />}
              onClick={(e) => {
                e.stopPropagation();
                const text = cliOutput.map(line => line.text).join('');
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const a = document.createElement('a');
                a.href = url;
                a.download = `cli-output-${timestamp}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={cliOutput.length === 0}
              appearance="subtle"
            >
              导出
            </Button>
          </div>
        </div>
        {cliOutputExpanded && (
          <div 
            ref={cliOutputRef}
            className={styles.cliOutputContent}
          >
            {cliOutput.length === 0 ? (
              <div className={styles.cliOutputEmpty}>
                暂无输出，开始生成后将显示 SD.cpp 的 CLI 输出
              </div>
            ) : (
              cliOutput.map((line, index) => (
                <div
                  key={index}
                  className={`${styles.cliOutputLine} ${
                    line.type === 'stderr' 
                      ? styles.cliOutputLineStderr 
                      : styles.cliOutputLineStdout
                  }`}
                >
                  {line.text}
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* 配置区域 */}
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
                    if (selectedGroup.defaultHighNoiseSteps !== undefined) {
                      setHighNoiseSteps(selectedGroup.defaultHighNoiseSteps);
                    } else {
                      setHighNoiseSteps(undefined);
                    }
                    if (selectedGroup.defaultHighNoiseCfgScale !== undefined) {
                      setHighNoiseCfgScale(selectedGroup.defaultHighNoiseCfgScale);
                    } else {
                      setHighNoiseCfgScale(undefined);
                    }
                    if (selectedGroup.defaultHighNoiseSamplingMethod !== undefined) {
                      setHighNoiseSamplingMethod(selectedGroup.defaultHighNoiseSamplingMethod);
                    } else {
                      setHighNoiseSamplingMethod(undefined);
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
              ? '暂无可用模型组，请先在"模型权重管理"页面创建支持视频生成的模型组'
              : selectedGroup
              ? `已选择: ${selectedGroup.name}${getModelInfo(selectedGroup) ? ` (${getModelInfo(selectedGroup)})` : ''}`
              : '未选择'}
          </Body1>

          {/* 生成模式选择 */}
          <div className={styles.modeSelector}>
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
            <div className={styles.uploadSection}>
              {!initImage ? (
                <div className={styles.uploadArea} onClick={handleImageUpload}>
                  <ImageAddRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                  <div style={{ textAlign: 'center' }}>
                    <Body1 block weight="semibold">点击上传参考图片</Body1>
                    <Body1 block style={{ color: tokens.colorNeutralForeground3 }}>支持 JPG, PNG, WebP 格式</Body1>
                  </div>
                </div>
              ) : (
                <div className={styles.uploadedImageContainer}>
                  <img src={initImage} alt="参考图片" className={styles.uploadedImage} />
                  <Button
                    className={styles.removeImageButton}
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
              <Input
                type="number"
                value={frames.toString()}
                onChange={(_, data) => {
                  const val = parseInt(data.value) || 16;
                  setFrames(Math.max(1, Math.min(128, val)));
                }}
                min={1}
                max={128}
              />
            </Field>
            <Field label="帧率 (FPS)" hint="默认: 8">
              <Input
                type="number"
                value={fps.toString()}
                onChange={(_, data) => {
                  const val = parseInt(data.value) || 8;
                  setFps(Math.max(1, Math.min(60, val)));
                }}
                min={1}
                max={60}
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
            <Field label="视频宽度" hint="默认: 512">
              <Input
                type="number"
                value={widthInput}
                onChange={(_, data) => {
                  setWidthInput(data.value);
                  const val = parseInt(data.value);
                  if (!isNaN(val) && val >= 64 && val <= 2048) {
                    setWidth(val);
                  }
                }}
                onBlur={() => {
                  const val = parseInt(widthInput);
                  if (isNaN(val) || val < 64) {
                    setWidthInput('512');
                    setWidth(512);
                  } else if (val > 2048) {
                    setWidthInput('2048');
                    setWidth(2048);
                  } else {
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
            <Field label="视频高度" hint="默认: 512">
              <Input
                type="number"
                value={heightInput}
                onChange={(_, data) => {
                  setHeightInput(data.value);
                  const val = parseInt(data.value);
                  if (!isNaN(val) && val >= 64 && val <= 2048) {
                    setHeight(val);
                  }
                }}
                onBlur={() => {
                  const val = parseInt(heightInput);
                  if (isNaN(val) || val < 64) {
                    setHeightInput('512');
                    setHeight(512);
                  } else if (val > 2048) {
                    setHeightInput('2048');
                    setHeight(2048);
                  } else {
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
              <Input
                type="number"
                value={flowShift.toString()}
                onChange={(_, data) => {
                  const val = parseFloat(data.value) || 3.0;
                  setFlowShift(val);
                }}
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
      <Dialog open={messageDialogOpen} onOpenChange={(_, data) => setMessageDialogOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>{messageDialogContent?.title || '提示'}</DialogTitle>
          <DialogBody>
            <DialogContent>
              <Body1 style={{ whiteSpace: 'pre-line' }}>{messageDialogContent?.message || ''}</Body1>
            </DialogContent>
          </DialogBody>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => setMessageDialogOpen(false)}
            >
              确定
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
