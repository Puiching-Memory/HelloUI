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
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  ChevronDownRegular,
  ChevronUpRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useEffect, useRef } from 'react';
import { useIpcListener } from '../hooks/useIpcListener';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    // 限制图片最大尺寸为屏幕的50%
    maxWidth: '50vw',
    maxHeight: '50vh',
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
  cliOutputCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    flex: '0 0 auto',
    maxHeight: '300px',
  },
  cliOutputHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
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
});

interface ModelGroup {
  id: string;
  name: string;
  sdModel?: string;
  vaeModel?: string;
  llmModel?: string;
  defaultSteps?: number;  // 推荐的默认采样步数
  defaultCfgScale?: number;  // 推荐的默认CFG Scale值
  defaultWidth?: number;  // 推荐的默认图片宽度
  defaultHeight?: number;  // 推荐的默认图片高度
  defaultSamplingMethod?: string;  // 推荐的默认采样方法
  defaultScheduler?: string;  // 推荐的默认调度器
  defaultSeed?: number;  // 推荐的默认种子（-1表示随机）
  createdAt: number;
  updatedAt: number;
}

type DeviceType = 'cpu' | 'vulkan' | 'cuda';

// 默认负面提示词（精简版，保留最核心的负面提示词）
const DEFAULT_NEGATIVE_PROMPT = '低质量, 最差质量, 模糊, 低分辨率, 手部错误, 脚部错误, 比例错误, 多余肢体, 缺失肢体, 水印';

// 清理 ANSI 转义序列（控制字符）
const stripAnsiCodes = (text: string): string => {
  // 移除 ANSI 转义序列
  // 匹配格式：\x1b[... 或 \u001b[... 或 \033[... 等
  // 包括常见的控制序列如 [K (清除到行尾), [A (上移), [2J (清屏) 等
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // 移除 CSI 序列 (Control Sequence Introducer)
    .replace(/\u001b[\(\)][0-9;]*[a-zA-Z]/g, '') // 移除其他转义序列
    .replace(/\u001b./g, '') // 移除其他单字符转义序列
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // 移除十六进制格式的转义序列
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''); // 移除八进制格式的转义序列（使用十六进制替代）
};

interface GeneratePageProps {
  onGeneratingStateChange?: (isGenerating: boolean) => void;
}

export const GeneratePage = ({ onGeneratingStateChange }: GeneratePageProps) => {
  const styles = useStyles();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [deviceType, setDeviceType] = useState<DeviceType>('cpu');
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
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [cliOutput, setCliOutput] = useState<Array<{ type: 'stdout' | 'stderr'; text: string; timestamp: number }>>([]);
  const [cliOutputExpanded, setCliOutputExpanded] = useState(false);
  const cliOutputRef = useRef<HTMLDivElement>(null);
  
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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // 加载模型组列表
  useEffect(() => {
    // 等待 ipcRenderer 可用（最多重试 50 次，即 5 秒）
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
    // 等待 ipcRenderer 可用（最多重试 50 次，即 5 秒）
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

  // 监听 CLI 输出
  useIpcListener<{ type: 'stdout' | 'stderr'; text: string }>(
    'generate:cli-output',
    (data) => {
      // 清理 ANSI 转义序列
      const cleanedText = stripAnsiCodes(data.text);
      // 如果清理后的文本不为空，才添加到输出中
      if (cleanedText.trim()) {
        setCliOutput(prev => [...prev, { ...data, text: cleanedText, timestamp: Date.now() }]);
      }
    }
  );

  // 监听预览图片更新
  useIpcListener<{ previewImage?: string }>(
    'generate:preview-update',
    (data) => {
      if (data?.previewImage) {
        setPreviewImage(data.previewImage);
      }
    }
  );

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

  const loadModelGroups = async () => {
    try {
      // 检查 ipcRenderer 是否可用
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        setModelGroups([]);
        return;
      }
      setLoading(true);
      const groups = await window.ipcRenderer.invoke('model-groups:list');
      setModelGroups(groups || []);
    } catch (error) {
      console.error('Failed to load model groups:', error);
      setModelGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceType = async () => {
    try {
      // 检查 ipcRenderer 是否可用
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      const device = await window.ipcRenderer.invoke('sdcpp:get-device');
      if (device) {
        setDeviceType(device as DeviceType);
      }
    } catch (error) {
      console.error('Failed to load device type:', error);
    }
  };

  const handleDeviceTypeChange = async (value: DeviceType) => {
    setDeviceType(value);
    try {
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      await window.ipcRenderer.invoke('sdcpp:set-device', value);
    } catch (error) {
      console.error('Failed to set device type:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedGroupId) {
      alert('请选择模型组');
      return;
    }
    if (!prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    // 检查 ipcRenderer 是否可用
    if (!window.ipcRenderer) {
      alert('IPC 通信不可用，请确保应用正常运行');
      return;
    }

      try {
      setGenerating(true);
      setGeneratedImage(null);
      setPreviewImage(null); // 清空预览图片
      setGenerationProgress('正在初始化...');
      setCliOutput([]); // 清空之前的输出

      // 监听生成进度
      const progressListener = (_event: unknown, data: { progress?: string; image?: string }) => {
        if (data.progress) {
          setGenerationProgress(data.progress);
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
        });

        if (result.success && result.image) {
          setGeneratedImage(result.image);
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
      alert(`生成图片失败: ${errorMessage}`);
      setGenerationProgress('');
      setGenerating(false);
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
    return parts.join(' | ');
  };

  return (
    <div className={styles.container}>
      <Title1>图片生成</Title1>

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

      {/* CLI 输出窗口 - 在第二个位置 */}
      <Card className={styles.cliOutputCard}>
        <div 
          className={styles.cliOutputHeader}
          onClick={() => setCliOutputExpanded(!cliOutputExpanded)}
        >
          <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0 }}>
            CLI 输出
          </Title2>
          {cliOutputExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
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

          {/* 推理引擎选择 */}
          <Field label="推理引擎" hint={`当前选择: ${getDeviceLabel(deviceType)}`}>
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

          {/* 提示词输入 */}
          <Field label="提示词" required>
            <Textarea
              value={prompt}
              onChange={(_, data) => setPrompt(data.value)}
              placeholder="输入图片描述，例如：a beautiful landscape with mountains and lakes"
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
                    // 对齐到64的倍数
                    const aligned = Math.round(val / 64) * 64;
                    setWidthInput(aligned.toString());
                    setWidth(aligned);
                  }
                }}
                min={64}
                max={2048}
                step={64}
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
                    // 对齐到64的倍数
                    const aligned = Math.round(val / 64) * 64;
                    setHeightInput(aligned.toString());
                    setHeight(aligned);
                  }
                }}
                min={64}
                max={2048}
                step={64}
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
              <Field label="卸载到CPU" hint="将权重放在RAM中以节省VRAM，需要时自动加载到VRAM">
                <Checkbox
                  checked={offloadToCpu}
                  onChange={(_, data) => setOffloadToCpu(data.checked === true)}
                />
              </Field>
            </div>
          )}

          {/* 生成按钮 */}
          <div className={styles.actions}>
            <Button
              icon={<ImageAddRegular />}
              onClick={handleGenerate}
              disabled={!selectedGroupId || !prompt.trim() || generating || loading}
              appearance="primary"
              size="large"
            >
              {generating ? '生成中...' : '开始生成'}
            </Button>
            <Button
              onClick={loadModelGroups}
              disabled={loading || generating}
            >
              刷新模型组列表
            </Button>
          </div>
        </div>
      </Card>

    </div>
  );
};

