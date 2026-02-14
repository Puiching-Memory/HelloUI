import {
  Card,
  Title1,
  Title2,
  Title3,
  Body1,
  Body2,
  Caption1,
  Text,
  makeStyles,
  tokens,
  Spinner,
  Button,
  Dropdown,
  Option,
  ProgressBar,
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
  Field,
  Tooltip,
  Divider,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular,
  ArrowSyncRegular,
  AddRegular,
  PlugConnectedRegular,
  DismissRegular,
  CheckmarkCircleFilled,
  GlobeRegular,
  TopSpeedRegular,
} from '@fluentui/react-icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useIpcListener } from '../hooks/useIpcListener';
import { ipcInvoke } from '../lib/tauriIpc';
import type { DeviceType, MirrorSource, SDCppRelease, SDCppReleaseAsset, SDCppDownloadProgress, MirrorTestResult } from '../../shared/types';
import { formatFileSize } from '@/utils/format';
import { getDeviceLabel } from '@/utils/modelUtils';
import { MessageDialog } from '@/components/MessageDialog';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1400px',
    margin: '0 auto',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingVerticalL,
  },
  engineCard: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  engineInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  infoValue: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mirrorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  mirrorRowSelected: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  mirrorInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  mirrorLatency: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  downloadSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  releaseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacingVerticalS,
  },
  assetCard: {
    padding: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  assetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mirrorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  addMirrorForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  toolbarRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  folderPath: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
});

interface EngineFile {
  name: string;
  size: number;
  path: string;
  modified: number;
  deviceType: DeviceType;
  cpuVariant?: 'avx2' | 'avx' | 'avx512' | 'noavx';
}

type CpuVariant = 'avx2' | 'avx' | 'avx512' | 'noavx';

interface CpuVariantInfo {
  variant: CpuVariant;
  label: string;
  files: EngineFile[];
  totalSize: number;
  hasFiles: boolean;
  version: string | null;
}

interface EngineSummary {
  type: DeviceType;
  label: string;
  hasFiles: boolean;
  cpuVariants?: CpuVariantInfo[];
  cudaRuntime?: {
    hasFiles: boolean;
    totalSize: number;
  };
  totalSize: number;
  version: string | null;
}

// ─── 辅助函数 ─────────────────────────────────────────────────────

function getAssetLabel(asset: SDCppReleaseAsset): string {
  if (asset.deviceType === 'cuda') return 'CUDA 12';
  if (asset.deviceType === 'vulkan') return 'Vulkan';
  if (asset.deviceType === 'rocm') return 'ROCm';
  if (asset.cpuVariant === 'avx2') return 'CPU (AVX2)';
  if (asset.cpuVariant === 'avx') return 'CPU (AVX)';
  if (asset.cpuVariant === 'avx512') return 'CPU (AVX512)';
  if (asset.cpuVariant === 'noavx') return 'CPU (无AVX)';
  return 'CPU';
}

function getAssetBadgeColor(asset: SDCppReleaseAsset): 'brand' | 'success' | 'warning' | 'informative' {
  if (asset.deviceType === 'cuda') return 'success';
  if (asset.deviceType === 'vulkan') return 'brand';
  if (asset.deviceType === 'rocm') return 'warning';
  return 'informative';
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '';
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

// ─── 组件 ──────────────────────────────────────────────────────────

export const SDCppPage = () => {
  const styles = useStyles();

  // 引擎文件状态
  const [engineFolder, setEngineFolder] = useState<string>('');
  const [engineFolderInput, setEngineFolderInput] = useState<string>('');
  const [files, setFiles] = useState<EngineFile[]>([]);
  const [deviceVersions, setDeviceVersions] = useState<Record<DeviceType, string | null>>({
    cpu: null, vulkan: null, cuda: null, rocm: null,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 下载相关状态
  const [releases, setReleases] = useState<SDCppRelease[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<SDCppRelease | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<SDCppDownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 镜像源状态
  const [mirrors, setMirrors] = useState<MirrorSource[]>([]);
  const [selectedMirrorId, setSelectedMirrorId] = useState<string>('github');
  const [mirrorTestResults, setMirrorTestResults] = useState<Record<string, MirrorTestResult>>({});
  const [testingMirrors, setTestingMirrors] = useState(false);

  // 添加镜像对话框
  const [addMirrorOpen, setAddMirrorOpen] = useState(false);
  const [newMirrorName, setNewMirrorName] = useState('');
  const [newMirrorUrl, setNewMirrorUrl] = useState('');

  // 消息对话框
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogContent, setMessageDialogContent] = useState<{ title: string; message: string } | null>(null);

  const loadFilesRef = useRef<() => Promise<void>>(undefined);

  // ─── 初始化 ────────────────────────────────────────────────────

  useEffect(() => {
    const initialize = async () => {
      await loadEngineFolder().catch(console.error);
      await loadMirrors().catch(console.error);
      setIsInitialized(true);
    };
    initialize();
  }, []);

  useEffect(() => {
    if (isInitialized && engineFolder) {
      loadFiles();
    }
  }, [engineFolder, isInitialized]);

  // 保持 loadFilesRef 始终指向最新的 loadFiles
  useEffect(() => {
    loadFilesRef.current = loadFiles;
  });

  // 监听下载进度事件
  useIpcListener(
    'sdcpp:download-progress',
    (data) => {
      setDownloadProgress(data);
      if (data.stage === 'done') {
        // 下载完成后自动重新扫描引擎版本号
        setTimeout(() => {
          loadFilesRef.current?.();
          setDownloadProgress(null);
        }, 1500);
      }
      if (data.stage === 'error') {
        setDownloadError(data.error || '下载失败');
      }
    },
  );

  // ─── 数据加载 ──────────────────────────────────────────────────

  const loadEngineFolder = async () => {
    try {
      let folder = await ipcInvoke('sdcpp:get-folder');
      if (!folder) {
        folder = await ipcInvoke('sdcpp:init-default-folder');
      }
      if (folder) {
        setEngineFolder(folder);
        setEngineFolderInput(folder);
      }
    } catch (error) {
      console.error('Failed to load engine folder:', error);
    }
  };

  const loadFiles = async () => {
    if (!engineFolder) return;
    setLoading(true);
    try {
      const deviceTypes: DeviceType[] = ['cpu', 'vulkan', 'cuda', 'rocm'];
      const allFilesPromises = deviceTypes.map(async (deviceType) => {
        try {
          const result = await ipcInvoke('sdcpp:list-files', engineFolder, deviceType);
          const files = (result?.files || []).map((file: Omit<EngineFile, 'deviceType'>) => ({
            ...file,
            deviceType,
          }));
          return { files, version: result?.version || null, deviceType };
        } catch (error) {
          console.error(`Failed to load files for ${deviceType}:`, error);
          return { files: [], version: null, deviceType };
        }
      });

      const results = await Promise.all(allFilesPromises);
      const allFiles = results.flatMap(r => r.files);
      const versions: Record<DeviceType, string | null> = { cpu: null, vulkan: null, cuda: null, rocm: null };
      results.forEach(r => { versions[r.deviceType] = r.version; });
      allFiles.sort((a, b) => b.modified - a.modified);

      setFiles(allFiles);
      setDeviceVersions(versions);
    } catch (error) {
      console.error('Failed to load file list:', error);
      setFiles([]);
      setDeviceVersions({ cpu: null, vulkan: null, cuda: null, rocm: null });
    } finally {
      setLoading(false);
    }
  };

  const handleSetFolder = async () => {
    const nextFolder = engineFolderInput.trim();

    if (!nextFolder) {
      setMessageDialogContent({ title: '提示', message: '请输入有效的文件夹路径' });
      setMessageDialogOpen(true);
      return;
    }

    const exists = await ipcInvoke('sdcpp:check-folder', nextFolder);
    if (!exists) {
      setMessageDialogContent({ title: '错误', message: '文件夹不存在，请检查路径是否正确' });
      setMessageDialogOpen(true);
      return;
    }

    const setResult = await ipcInvoke('sdcpp:set-folder', nextFolder);
    if (!setResult) {
      setMessageDialogContent({ title: '错误', message: '设置文件夹路径失败，请重试' });
      setMessageDialogOpen(true);
      return;
    }

    setEngineFolder(nextFolder);
    setEngineFolderInput(nextFolder);
  };

  const handleFolderPathChange = (value: string) => {
    setEngineFolderInput(value);
  };

  const loadMirrors = async () => {
    try {
      const result = await ipcInvoke('sdcpp:get-mirrors');
      setMirrors(result);
    } catch (error) {
      console.error('Failed to load mirrors:', error);
    }
  };

  // ─── Release 操作 ──────────────────────────────────────────────

  const fetchReleaseList = useCallback(async () => {
    setLoadingReleases(true);
    setDownloadError(null);
    try {
      const result = await ipcInvoke('sdcpp:fetch-releases', {
        mirrorId: selectedMirrorId,
        count: 10,
      });
      setReleases(result);
      if (result.length > 0 && !selectedRelease) {
        setSelectedRelease(result[0]);
      }
    } catch (error: any) {
      console.error('Failed to fetch releases:', error);
      const errorMsg = error?.message || error?.toString() || '未知错误';
      setDownloadError(`获取版本列表失败: ${errorMsg}`);
    } finally {
      setLoadingReleases(false);
    }
  }, [selectedMirrorId]);

  // ─── 下载操作 ──────────────────────────────────────────────────

  const handleDownload = useCallback(async (asset: SDCppReleaseAsset) => {
    if (!selectedRelease) return;
    setDownloadError(null);
    setDownloadProgress({
      stage: 'downloading',
      downloadedBytes: 0,
      totalBytes: asset.size,
      speed: 0,
      fileName: asset.name,
    });

    try {
      const result = await ipcInvoke('sdcpp:download-engine', {
        asset,
        release: selectedRelease,
        mirrorId: selectedMirrorId,
      });
      if (!result.success) {
        setDownloadError(result.error || '下载失败');
        setDownloadProgress(null);
      }
    } catch (error: any) {
      setDownloadError(error?.message || '下载失败');
      setDownloadProgress(null);
    }
  }, [selectedRelease, selectedMirrorId]);

  const handleCancelDownload = useCallback(async () => {
    try {
      await ipcInvoke('sdcpp:cancel-download');
      setDownloadProgress(null);
    } catch (error) {
      console.error('Failed to cancel download:', error);
    }
  }, []);

  // ─── 镜像操作 ──────────────────────────────────────────────────

  const handleTestMirrors = useCallback(async () => {
    setTestingMirrors(true);
    try {
      const results = await ipcInvoke('sdcpp:test-mirrors');
      const resultMap: Record<string, MirrorTestResult> = {};
      results.forEach(r => { resultMap[r.mirrorId] = r; });
      setMirrorTestResults(resultMap);
    } catch (error) {
      console.error('Failed to test mirrors:', error);
    } finally {
      setTestingMirrors(false);
    }
  }, []);

  const handleAutoSelectMirror = useCallback(async () => {
    setTestingMirrors(true);
    try {
      const best = await ipcInvoke('sdcpp:auto-select-mirror');
      setSelectedMirrorId(best.id);
      // 同时更新测速结果
      await handleTestMirrors();
    } catch (error) {
      console.error('Failed to auto-select mirror:', error);
    } finally {
      setTestingMirrors(false);
    }
  }, [handleTestMirrors]);

  const handleAddMirror = useCallback(async () => {
    if (!newMirrorName || !newMirrorUrl) return;
    try {
      const mirror = await ipcInvoke('sdcpp:add-mirror', {
        name: newMirrorName,
        type: 'proxy' as const,
        url: newMirrorUrl.replace(/\/+$/, ''),
        proxyApi: false,
      });
      setMirrors(prev => [...prev, mirror]);
      setNewMirrorName('');
      setNewMirrorUrl('');
      setAddMirrorOpen(false);
    } catch (error) {
      console.error('Failed to add mirror:', error);
    }
  }, [newMirrorName, newMirrorUrl]);

  const handleRemoveMirror = useCallback(async (mirrorId: string) => {
    try {
      await ipcInvoke('sdcpp:remove-mirror', mirrorId);
      setMirrors(prev => prev.filter(m => m.id !== mirrorId));
      if (selectedMirrorId === mirrorId) {
        setSelectedMirrorId('github');
      }
    } catch (error) {
      console.error('Failed to remove mirror:', error);
    }
  }, [selectedMirrorId]);

  // ─── 渲染引擎概览 ─────────────────────────────────────────────

  const cpuVariantLabels: Record<CpuVariant, string> = {
    avx2: 'AVX2',
    avx: 'AVX',
    avx512: 'AVX512',
    noavx: '无AVX',
  };

  const engineSummaries: EngineSummary[] = (['cpu', 'vulkan', 'cuda', 'rocm'] as const).map((deviceType) => {
    const deviceFiles = files.filter(f => f.deviceType === deviceType);

    if (deviceType === 'cpu') {
      const cpuVariants: CpuVariant[] = ['avx2', 'avx512', 'avx', 'noavx'];
      const variantInfos = cpuVariants.map((variant) => {
        const variantFiles = deviceFiles.filter(f => f.cpuVariant === variant);
        return {
          variant,
          label: cpuVariantLabels[variant],
          files: variantFiles,
          totalSize: variantFiles.reduce((sum, file) => sum + file.size, 0),
          hasFiles: variantFiles.length > 0,
          version: deviceVersions.cpu,
        };
      });
      return {
        type: deviceType,
        label: 'CPU',
        hasFiles: deviceFiles.length > 0,
        cpuVariants: variantInfos,
        totalSize: deviceFiles.reduce((sum, file) => sum + file.size, 0),
        version: deviceVersions.cpu,
      };
    }

    if (deviceType === 'cuda') {
      const cudaRuntimeFiles = ['cudart64', 'cublas64', 'cublasLt64'];
      const cudartFiles = deviceFiles.filter(f => {
        const lower = f.name.toLowerCase();
        return cudaRuntimeFiles.some(ext => lower.includes(ext.toLowerCase()));
      });
      return {
        type: deviceType,
        label: 'CUDA',
        hasFiles: deviceFiles.length > 0,
        cudaRuntime: {
          hasFiles: cudartFiles.length > 0,
          totalSize: cudartFiles.reduce((sum, file) => sum + file.size, 0),
        },
        totalSize: deviceFiles.reduce((sum, file) => sum + file.size, 0),
        version: deviceVersions.cuda,
      };
    }

    return {
      type: deviceType,
      label: getDeviceLabel(deviceType),
      hasFiles: deviceFiles.length > 0,
      totalSize: deviceFiles.reduce((sum, file) => sum + file.size, 0),
      version: deviceVersions[deviceType],
    };
  });

  const isDownloading = downloadProgress !== null && downloadProgress.stage !== 'done' && downloadProgress.stage !== 'error';

  return (
    <div className={styles.container}>
      <Title1>SD.cpp 推理引擎</Title1>

      {/* 引擎文件夹路径输入区域 */}
      <Card className={styles.section}>
        <Title2>引擎文件夹路径</Title2>
        <div className={styles.folderPath}>
          <Field label="引擎文件夹路径" style={{ flex: 1 }}>
            <Input
              value={engineFolderInput}
              onChange={(_, data) => handleFolderPathChange(data.value)}
              placeholder="默认使用应用数据目录下的 engines/sdcpp 文件夹"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetFolder();
                }
              }}
            />
          </Field>
          <Button
            onClick={handleSetFolder}
            appearance="primary"
            disabled={!engineFolderInput.trim() || loading || engineFolderInput.trim() === engineFolder}
          >
            应用路径
          </Button>
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          {engineFolder
            ? `使用文件夹: ${engineFolder}。引擎文件将按设备类型子目录（cpu/vulkan/cuda）自动扫描。`
            : '默认使用应用数据目录下的 engines/sdcpp 文件夹，也可以输入自定义路径。'}
        </Body1>
      </Card>

      {/* 引擎概览 */}
      {loading && files.length === 0 ? (
        <div className={styles.emptyState}>
          <Spinner size="large" />
          <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
        </div>
      ) : (
        <div className={styles.summaryGrid}>
          {engineSummaries.map((summary) => (
            <Card className={styles.engineCard} key={summary.type}>
              <div className={styles.engineInfoRow}>
                <Title2>{summary.label} 引擎</Title2>
              </div>
              {!summary.hasFiles ? (
                <Body1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                  暂无相关文件
                </Body1>
              ) : (
                <>
                  {summary.type === 'cpu' && summary.cpuVariants && (
                    <div style={{ marginTop: tokens.spacingVerticalM }}>
                      <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, marginBottom: tokens.spacingVerticalS }}>
                        CPU 变体
                      </Text>
                      {summary.cpuVariants.map((variant) => (
                        <div key={variant.variant} className={styles.engineInfoRow}>
                          <span className={styles.infoLabel}>{variant.label}</span>
                          <span className={styles.infoValue}>
                            {variant.hasFiles ? formatFileSize(variant.totalSize) : '未安装'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {summary.type === 'cuda' && summary.cudaRuntime && (
                    <div style={{ marginTop: tokens.spacingVerticalM }}>
                      <div className={styles.engineInfoRow}>
                        <span className={styles.infoLabel}>CUDA 引擎</span>
                        <span className={styles.infoValue}>{formatFileSize(summary.totalSize - summary.cudaRuntime.totalSize)}</span>
                      </div>
                      <div className={styles.engineInfoRow}>
                        <span className={styles.infoLabel}>CUDA Runtime</span>
                        <span className={styles.infoValue}>
                          {summary.cudaRuntime.hasFiles ? formatFileSize(summary.cudaRuntime.totalSize) : '未安装'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className={styles.engineInfoRow}>
                    <span className={styles.infoLabel}>占用空间</span>
                    <span className={styles.infoValue}>{formatFileSize(summary.totalSize)}</span>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      <Divider />

      {/* 镜像源设置 */}
      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <Title2>下载源</Title2>
          <div className={styles.toolbarRow}>
            <Tooltip content="自动选择最快的镜像源" relationship="label">
              <Button
                icon={<TopSpeedRegular />}
                appearance="subtle"
                onClick={handleAutoSelectMirror}
                disabled={testingMirrors}
              >
                {testingMirrors ? '测速中...' : '自动选择'}
              </Button>
            </Tooltip>
            <Tooltip content="测试所有镜像源" relationship="label">
              <Button
                icon={<PlugConnectedRegular />}
                appearance="subtle"
                onClick={handleTestMirrors}
                disabled={testingMirrors}
              >
                测速
              </Button>
            </Tooltip>
            <Dialog open={addMirrorOpen} onOpenChange={(_, data) => setAddMirrorOpen(data.open)}>
              <DialogTrigger disableButtonEnhancement>
                <Button icon={<AddRegular />} appearance="subtle">添加镜像</Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>添加自定义镜像源</DialogTitle>
                  <DialogContent>
                    <div className={styles.addMirrorForm}>
                      <Field label="名称" required>
                        <Input
                          value={newMirrorName}
                          onChange={(_, data) => setNewMirrorName(data.value)}
                          placeholder="例: 我的镜像站"
                        />
                      </Field>
                      <Field label="代理 URL" required>
                        <Input
                          value={newMirrorUrl}
                          onChange={(_, data) => setNewMirrorUrl(data.value)}
                          placeholder="例: https://ghfast.top"
                        />
                      </Field>
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        代理 URL 为前缀式 GitHub 代理地址，下载时会自动拼接为：代理URL/原始GitHub下载地址
                      </Caption1>
                    </div>
                  </DialogContent>
                  <DialogActions>
                    <DialogTrigger disableButtonEnhancement>
                      <Button appearance="secondary">取消</Button>
                    </DialogTrigger>
                    <Button
                      appearance="primary"
                      onClick={handleAddMirror}
                      disabled={!newMirrorName || !newMirrorUrl}
                    >
                      添加
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          </div>
        </div>

        <div className={styles.mirrorList}>
          {mirrors.map((mirror) => {
            const testResult = mirrorTestResults[mirror.id];
            const isSelected = selectedMirrorId === mirror.id;
            return (
              <div
                key={mirror.id}
                className={`${styles.mirrorRow} ${isSelected ? styles.mirrorRowSelected : ''}`}
                onClick={() => setSelectedMirrorId(mirror.id)}
              >
                <div className={styles.mirrorInfo}>
                  {isSelected && <CheckmarkCircleFilled style={{ color: tokens.colorBrandForeground1 }} />}
                  <GlobeRegular />
                  <div>
                    <Body1 style={{ fontWeight: isSelected ? tokens.fontWeightSemibold : undefined }}>
                      {mirror.name}
                    </Body1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {mirror.type === 'github' ? 'GitHub 直连' : mirror.url}
                    </Caption1>
                  </div>
                </div>
                <div className={styles.mirrorInfo}>
                  {testResult && (
                    <span className={styles.mirrorLatency} style={{
                      color: testResult.success
                        ? (testResult.latency! < 1000 ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteYellowForeground1)
                        : tokens.colorPaletteRedForeground1,
                    }}>
                      {testResult.success ? `${testResult.latency}ms` : '不可用'}
                    </span>
                  )}
                  {!mirror.builtin && (
                    <Button
                      icon={<DismissRegular />}
                      appearance="subtle"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMirror(mirror.id);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Divider />

      {/* 下载引擎 */}
      <Card className={styles.downloadSection}>
        <div className={styles.sectionHeader}>
          <Title2>下载引擎</Title2>
          <Button
            icon={<ArrowSyncRegular />}
            appearance="primary"
            onClick={fetchReleaseList}
            disabled={loadingReleases || isDownloading}
          >
            {loadingReleases ? '获取中...' : '获取版本列表'}
          </Button>
        </div>

        {downloadError && (
          <MessageBar intent="error">
            <MessageBarBody>{downloadError}</MessageBarBody>
          </MessageBar>
        )}

        {/* 下载进度 */}
        {downloadProgress && downloadProgress.stage !== 'done' && downloadProgress.stage !== 'error' && (
          <div className={styles.progressContainer}>
            <div className={styles.progressInfo}>
              <Body2 style={{ fontWeight: tokens.fontWeightSemibold }}>
                {downloadProgress.stage === 'downloading' ? '正在下载' : '正在解压'}: {downloadProgress.fileName}
              </Body2>
              <Button
                appearance="subtle"
                size="small"
                icon={<DismissRegular />}
                onClick={handleCancelDownload}
              >
                取消
              </Button>
            </div>
            <ProgressBar
              value={downloadProgress.totalBytes > 0 ? downloadProgress.downloadedBytes / downloadProgress.totalBytes : undefined}
              max={1}
            />
            <div className={styles.progressInfo}>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                {formatFileSize(downloadProgress.downloadedBytes)} / {formatFileSize(downloadProgress.totalBytes)}
              </Caption1>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                {formatSpeed(downloadProgress.speed)}
              </Caption1>
            </div>
          </div>
        )}

        {/* 版本选择器 */}
        {releases.length > 0 && (
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
              <Body1>选择版本:</Body1>
              <Dropdown
                value={selectedRelease?.name || ''}
                selectedOptions={selectedRelease ? [selectedRelease.tagName] : []}
                onOptionSelect={(_, data) => {
                  const release = releases.find(r => r.tagName === data.optionValue);
                  if (release) setSelectedRelease(release);
                }}
                style={{ minWidth: '300px' }}
              >
                {releases.map((release) => {
                  const label = `${release.name} (${new Date(release.publishedAt).toLocaleDateString('zh-CN')})`;
                  return (
                    <Option key={release.tagName} value={release.tagName} text={label}>
                      {label}
                    </Option>
                  );
                })}
              </Dropdown>
            </div>

            {selectedRelease && (
              <>
                <Title3 style={{ marginTop: tokens.spacingVerticalM }}>
                  可用资源 ({selectedRelease.assets.length})
                </Title3>
                <div className={styles.assetGrid}>
                  {selectedRelease.assets.map((asset) => (
                    <div className={styles.assetCard} key={asset.name}>
                      <div className={styles.assetHeader}>
                        <Badge color={getAssetBadgeColor(asset)} appearance="filled">
                          {getAssetLabel(asset)}
                        </Badge>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                          {formatFileSize(asset.size)}
                        </Caption1>
                      </div>
                      <Caption1 style={{
                        color: tokens.colorNeutralForeground3,
                        wordBreak: 'break-all',
                      }}>
                        {asset.name}
                      </Caption1>
                      <Button
                        icon={<ArrowDownloadRegular />}
                        appearance="primary"
                        size="small"
                        onClick={() => handleDownload(asset)}
                        disabled={isDownloading}
                        style={{ alignSelf: 'flex-end', marginTop: tokens.spacingVerticalXS }}
                      >
                        下载并安装
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {releases.length === 0 && !loadingReleases && (
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
            点击"获取版本列表"来查看可用的引擎版本
          </Body1>
        )}

        {loadingReleases && (
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
            <Spinner size="small" />
            <Body1>正在获取版本列表...</Body1>
          </div>
        )}
      </Card>

      <MessageDialog
        open={messageDialogOpen}
        title={messageDialogContent?.title || ''}
        message={messageDialogContent?.message || ''}
        onClose={() => setMessageDialogOpen(false)}
      />
    </div>
  );
};
