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
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  ChevronDownRegular,
  ChevronUpRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useEffect, useRef } from 'react';

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
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
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

export const GeneratePage = () => {
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
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [cliOutput, setCliOutput] = useState<Array<{ type: 'stdout' | 'stderr'; text: string; timestamp: number }>>([]);
  const [cliOutputExpanded, setCliOutputExpanded] = useState(false);
  const cliOutputRef = useRef<HTMLDivElement>(null);
  const cliOutputListenerRef = useRef<((_event: unknown, data: { type: 'stdout' | 'stderr'; text: string }) => void) | null>(null);

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
  useEffect(() => {
    // 检查 ipcRenderer 是否可用
    if (!window.ipcRenderer) {
      console.error('window.ipcRenderer is not available');
      return;
    }

    // 如果监听器已存在，先移除它（防止重复注册）
    if (cliOutputListenerRef.current) {
      window.ipcRenderer.off('generate:cli-output', cliOutputListenerRef.current);
    }

    const cliOutputListener = (_event: unknown, data: { type: 'stdout' | 'stderr'; text: string }) => {
      // 清理 ANSI 转义序列
      const cleanedText = stripAnsiCodes(data.text);
      // 如果清理后的文本不为空，才添加到输出中
      if (cleanedText.trim()) {
        setCliOutput(prev => [...prev, { ...data, text: cleanedText, timestamp: Date.now() }]);
      }
    };

    // 保存监听器引用
    cliOutputListenerRef.current = cliOutputListener;

    window.ipcRenderer.on('generate:cli-output', cliOutputListener);

    return () => {
      if (window.ipcRenderer && cliOutputListenerRef.current) {
        window.ipcRenderer.off('generate:cli-output', cliOutputListenerRef.current);
        cliOutputListenerRef.current = null;
      }
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (cliOutputRef.current && cliOutputExpanded) {
      cliOutputRef.current.scrollTop = cliOutputRef.current.scrollHeight;
    }
  }, [cliOutput, cliOutputExpanded]);

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
        });

        if (result.success && result.image) {
          setGeneratedImage(result.image);
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
              <Spinner size="large" />
              <Body1 style={{ marginTop: tokens.spacingVerticalM }}>
                {generationProgress || '正在生成...'}
              </Body1>
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
          </div>

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

