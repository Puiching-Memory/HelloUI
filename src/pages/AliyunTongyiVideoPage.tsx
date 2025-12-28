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
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  TabList,
  Tab,
} from '@fluentui/react-components';
import {
  VideoClipRegular,
  ArrowSyncRegular,
  DocumentArrowDownRegular,
} from '@fluentui/react-icons';
import { useState, useEffect, useRef } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
    paddingBottom: '120px',
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
    padding: tokens.spacingVerticalM,
  },
  previewVideo: {
    width: '100%',
    maxWidth: '800px',
    height: 'auto',
    maxHeight: '60vh',
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
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  field: {
    flex: '1 1 200px',
  },
  floatingControlPanel: {
    position: 'fixed',
    bottom: tokens.spacingVerticalL,
    left: `calc(240px + ${tokens.spacingVerticalL})`,
    right: tokens.spacingVerticalL,
    maxWidth: '1600px',
    width: 'auto',
    margin: '0 auto',
    zIndex: 1000,
    boxShadow: tokens.shadow28,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalM,
    backgroundColor: 'transparent',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
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
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    justifyContent: 'center',
  },
});

const MODELS = [
  { id: 'wan2.6-t2v', name: '万相 2.6 (有声视频)', specs: '720P/1080P, 5/10/15s' },
  { id: 'wan2.5-t2v-preview', name: '万相 2.5 preview (有声视频)', specs: '480P/720P/1080P, 5/10s' },
  { id: 'wan2.2-t2v-plus', name: '万相 2.2 专业版 (无声视频)', specs: '480P/1080P, 5s' },
  { id: 'wanx2.1-t2v-turbo', name: '万相 2.1 极速版 (无声视频)', specs: '480P/720P, 5s' },
  { id: 'wanx2.1-t2v-plus', name: '万相 2.1 专业版 (无声视频)', specs: '720P, 5s' },
];

const REGIONS = [
  { id: 'beijing', name: '北京 (DashScope)', endpoint: 'https://dashscope.aliyuncs.com/api/v1' },
  { id: 'singapore', name: '新加坡 (DashScope Intl)', endpoint: 'https://dashscope-intl.aliyuncs.com/api/v1' },
];

export const AliyunTongyiVideoPage = () => {
  const styles = useStyles();
  const [apiKey, setApiKey] = useState(localStorage.getItem('aliyun_api_key') || '');
  const [region, setRegion] = useState(localStorage.getItem('aliyun_region') || 'beijing');
  const [model, setModel] = useState('wan2.6-t2v');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1280*720');
  const [duration, setDuration] = useState(5);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [promptExtend, setPromptExtend] = useState(true);
  const [shotType, setShotType] = useState<'single' | 'multi'>('single');
  
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogContent, setMessageDialogContent] = useState<{ title: string; message: string } | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const saveSettings = () => {
    localStorage.setItem('aliyun_api_key', apiKey);
    localStorage.setItem('aliyun_region', region);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setMessageDialogContent({ title: '提示', message: '请先在配置中设置 API Key' });
      setMessageDialogOpen(true);
      return;
    }
    if (!prompt.trim()) {
      setMessageDialogContent({ title: '提示', message: '请输入提示词' });
      setMessageDialogOpen(true);
      return;
    }

    saveSettings();
    setError(null);
    setVideoUrl(null);
    setTaskId(null);
    setTaskStatus('正在创建任务...');
    setGenerating(true);

    const selectedRegion = REGIONS.find(r => r.id === region);
    const url = `${selectedRegion?.endpoint}/services/aigc/video-generation/video-synthesis`;

    try {
      const result = await window.ipcRenderer.invoke('aliyun-api:call', {
        method: 'POST',
        url,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: {
          model,
          input: {
            prompt: prompt.trim(),
          },
          parameters: {
            size,
            duration,
            seed,
            prompt_extend: promptExtend,
            shot_type: model === 'wan2.6-t2v' ? shotType : undefined,
          },
        },
      });

      if (result.status === 200 && result.data.output?.task_id) {
        const tid = result.data.output.task_id;
        setTaskId(tid);
        setTaskStatus('任务已创建，正在排队...');
        startPolling(tid);
      } else {
        throw new Error(result.data?.message || result.statusText || '创建任务失败');
      }
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(err instanceof Error ? err.message : String(err));
      setGenerating(false);
    }
  };

  const startPolling = (tid: string) => {
    const selectedRegion = REGIONS.find(r => r.id === region);
    const url = `${selectedRegion?.endpoint}/tasks/${tid}`;

    pollingRef.current = setInterval(async () => {
      try {
        const result = await window.ipcRenderer.invoke('aliyun-api:call', {
          method: 'GET',
          url,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (result.status === 200) {
          const status = result.data.output.task_status;
          setTaskStatus(status === 'PENDING' ? '排队中...' : status === 'RUNNING' ? '生成中...' : status);
          
          if (status === 'SUCCEEDED') {
            setVideoUrl(result.data.output.video_url);
            setGenerating(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
          } else if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
            setError(`任务状态: ${status}. ${result.data.output.message || ''}`);
            setGenerating(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch (err) {
        console.error('Polling failed:', err);
        setError('查询任务状态失败');
        setGenerating(false);
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    }, 5000); // 每5秒查询一次
  };

  const handleCancel = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setGenerating(false);
    setTaskStatus('已取消');
  };

  return (
    <div className={styles.container}>
      <Title1>阿里通义万相 - 文生视频</Title1>

      {error && (
        <MessageBar intent="error">
          <MessageBarTitle>错误</MessageBarTitle>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <Card className={styles.previewCard}>
        <Title2>生成结果</Title2>
        <div className={styles.previewSection}>
          {generating ? (
            <div className={styles.emptyState}>
              <Spinner size="large" label={taskStatus} />
              {taskId && <Body1 style={{ marginTop: tokens.spacingVerticalS }}>任务 ID: {taskId}</Body1>}
            </div>
          ) : videoUrl ? (
            <video src={videoUrl} controls className={styles.previewVideo} autoPlay loop />
          ) : (
            <div className={styles.emptyState}>
              <VideoClipRegular style={{ fontSize: '64px', marginBottom: tokens.spacingVerticalM }} />
              <Body1>生成的视频将显示在这里</Body1>
            </div>
          )}
        </div>
      </Card>

      <Card className={styles.configCard}>
        <Title2>配置参数</Title2>
        <div className={styles.formSection}>
          <div className={styles.row}>
            <Field label="API Key" className={styles.field} required>
              <Input
                type="password"
                value={apiKey}
                onChange={(_, data) => setApiKey(data.value)}
                placeholder="sk-..."
              />
            </Field>
            <Field label="地域" className={styles.field}>
              <Dropdown
                value={REGIONS.find(r => r.id === region)?.name}
                selectedOptions={[region]}
                onOptionSelect={(_, data) => setRegion(data.optionValue || 'beijing')}
              >
                {REGIONS.map(r => (
                  <Option key={r.id} value={r.id}>{r.name}</Option>
                ))}
              </Dropdown>
            </Field>
          </div>

          <Field label="模型选择" required>
            <Dropdown
              value={MODELS.find(m => m.id === model)?.name}
              selectedOptions={[model]}
              onOptionSelect={(_, data) => setModel(data.optionValue || 'wan2.6-t2v')}
            >
              {MODELS.map(m => (
                <Option key={m.id} value={m.id} text={`${m.name} (${m.specs})`}>
                  {m.name} ({m.specs})
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label="提示词 (Prompt)" required>
            <Textarea
              value={prompt}
              onChange={(_, data) => setPrompt(data.value)}
              placeholder="描述你想要生成的视频内容..."
              rows={4}
            />
          </Field>

          <div className={styles.row}>
            <Field label="分辨率" className={styles.field}>
              <Dropdown
                value={size}
                selectedOptions={[size]}
                onOptionSelect={(_, data) => setSize(data.optionValue || '1280*720')}
              >
                <Option value="1280*720">1280*720 (720P)</Option>
                <Option value="1920*1080">1920*1080 (1080P)</Option>
                <Option value="832*480">832*480 (480P)</Option>
              </Dropdown>
            </Field>
            <Field label="时长 (秒)" className={styles.field}>
              <Dropdown
                value={duration.toString()}
                selectedOptions={[duration.toString()]}
                onOptionSelect={(_, data) => setDuration(parseInt(data.optionValue || '5'))}
              >
                <Option value="5">5 秒</Option>
                <Option value="10">10 秒</Option>
                <Option value="15">15 秒</Option>
              </Dropdown>
            </Field>
            <Field label="随机种子 (可选)" className={styles.field}>
              <Input
                type="number"
                value={seed?.toString() || ''}
                onChange={(_, data) => setSeed(data.value ? parseInt(data.value) : undefined)}
                placeholder="留空则随机"
              />
            </Field>
          </div>

          <div className={styles.row}>
            <Checkbox
              label="提示词智能改写 (Prompt Extend)"
              checked={promptExtend}
              onChange={(_, data) => setPromptExtend(!!data.checked)}
            />
            {model === 'wan2.6-t2v' && (
              <Field label="镜头类型" orientation="horizontal">
                <TabList
                  selectedValue={shotType}
                  onTabSelect={(_, data) => setShotType(data.value as 'single' | 'multi')}
                >
                  <Tab value="single">单镜头</Tab>
                  <Tab value="multi">多镜头</Tab>
                </TabList>
              </Field>
            )}
          </div>
        </div>
      </Card>

      <div className={styles.floatingControlPanel}>
        <div className={styles.actions}>
          {generating ? (
            <Button
              appearance="secondary"
              size="large"
              onClick={handleCancel}
            >
              取消生成
            </Button>
          ) : (
            <Button
              appearance="primary"
              size="large"
              icon={<VideoClipRegular />}
              onClick={handleGenerate}
            >
              开始生成
            </Button>
          )}
          <Button
            icon={<ArrowSyncRegular />}
            onClick={() => {
              setVideoUrl(null);
              setError(null);
              setTaskId(null);
            }}
          >
            重置
          </Button>
          <Button
            icon={<DocumentArrowDownRegular />}
            disabled={!videoUrl}
            onClick={() => {
              if (videoUrl) window.open(videoUrl);
            }}
          >
            下载视频
          </Button>
        </div>
      </div>

      <Dialog open={messageDialogOpen} onOpenChange={(_, data) => setMessageDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{messageDialogContent?.title}</DialogTitle>
            <DialogContent>
              {messageDialogContent?.message}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setMessageDialogOpen(false)}>确定</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
