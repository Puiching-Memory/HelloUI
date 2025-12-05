/// <reference types="../vite-env" />
import {
  Card,
  Title1,
  Title2,
  Body1,
  Button,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  makeStyles,
  tokens,
  Spinner,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  Field,
  ProgressBar,
  RadioGroup,
  Radio,
  Label,
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  DeleteRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import { useState, useEffect } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1400px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  folderPath: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  deviceSelection: {
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
  tableContainer: {
    overflowX: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
});

interface EngineFile {
  name: string;
  size: number;
  path: string;
  modified: number;
}

type DeviceType = 'cpu' | 'vulkan' | 'cuda';

interface SDCppPageProps {
  onUploadStateChange?: (isUploading: boolean) => void;
}

export const SDCppPage = ({ onUploadStateChange }: SDCppPageProps) => {
  const styles = useStyles();
  const [engineFolder, setEngineFolder] = useState<string>('');
  const [deviceType, setDeviceType] = useState<DeviceType>('cpu');
  const [files, setFiles] = useState<EngineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<EngineFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    progress: number;
    fileName: string;
    copied: number;
    total: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 加载引擎文件夹路径和设备类型
  useEffect(() => {
    loadEngineFolder().catch(console.error);
    loadDeviceType().catch(console.error);
  }, []);

  // 当文件夹路径或设备类型改变时，加载文件列表
  useEffect(() => {
    if (engineFolder && deviceType) {
      loadFiles();
    }
  }, [engineFolder, deviceType]);

  const loadEngineFolder = async () => {
    try {
      let folder = await window.ipcRenderer.invoke('sdcpp:get-folder');
      
      if (!folder) {
        folder = await window.ipcRenderer.invoke('sdcpp:init-default-folder');
        await window.ipcRenderer.invoke('sdcpp:set-folder', folder);
      }
      
      if (folder) {
        setEngineFolder(folder);
      }
    } catch (error) {
      console.error('加载引擎文件夹失败:', error);
    }
  };

  const loadDeviceType = async () => {
    try {
      const device = await window.ipcRenderer.invoke('sdcpp:get-device');
      if (device) {
        setDeviceType(device as DeviceType);
      }
    } catch (error) {
      console.error('加载设备类型失败:', error);
    }
  };

  const loadFiles = async () => {
    if (!engineFolder || !deviceType) return;
    setLoading(true);
    try {
      const fileList = await window.ipcRenderer.invoke('sdcpp:list-files', engineFolder, deviceType);
      setFiles(fileList || []);
    } catch (error) {
      console.error('加载文件列表失败:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSetFolder = async () => {
    if (!engineFolder.trim()) {
      alert('请输入有效的文件夹路径');
      return;
    }
    
    try {
      const exists = await window.ipcRenderer.invoke('sdcpp:check-folder', engineFolder.trim());
      if (!exists) {
        alert('文件夹不存在，请检查路径是否正确');
        return;
      }
      
      await window.ipcRenderer.invoke('sdcpp:set-folder', engineFolder.trim());
      await loadFiles();
    } catch (error) {
      console.error('设置文件夹失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`设置文件夹失败: ${errorMessage}`);
    }
  };

  const handleDeviceTypeChange = async (value: DeviceType) => {
    setDeviceType(value);
    try {
      await window.ipcRenderer.invoke('sdcpp:set-device', value);
      await loadFiles();
    } catch (error) {
      console.error('设置设备类型失败:', error);
    }
  };

  const handleFolderPathChange = (value: string) => {
    setEngineFolder(value);
  };

  const handleCancelUpload = async () => {
    try {
      await window.ipcRenderer.invoke('sdcpp:cancel-upload');
      
      setUploadProgress(null);
      setLoading(false);
      setIsUploading(false);
      onUploadStateChange?.(false);
    } catch (error) {
      console.error('取消上传失败:', error);
    }
  };

  const handleUpload = async () => {
    if (!engineFolder || !deviceType) return;
    try {
      const filePath = await window.ipcRenderer.invoke('sdcpp:select-file');
      if (filePath) {
        const fileName = filePath.split(/[/\\]/).pop() || '文件';
        setLoading(true);
        setIsUploading(true);
        setUploadProgress({ progress: 0, fileName, copied: 0, total: 0 });
        
        onUploadStateChange?.(true);
        
        const progressListener = (_: any, data: { progress: number; fileName: string; copied: number; total: number }) => {
          setUploadProgress(data);
        };
        
        window.ipcRenderer.on('sdcpp:upload-progress', progressListener);
        
        try {
          const result = await window.ipcRenderer.invoke('sdcpp:upload-file', filePath, engineFolder, deviceType);
          
          if (result && result.cancelled) {
            setUploadProgress(null);
            setLoading(false);
            setIsUploading(false);
            window.ipcRenderer.off('sdcpp:upload-progress', progressListener);
            onUploadStateChange?.(false);
            return;
          }
          
          if (result && result.skipped && result.reason === 'duplicate') {
            setUploadProgress(null);
            setLoading(false);
            setIsUploading(false);
            window.ipcRenderer.off('sdcpp:upload-progress', progressListener);
            onUploadStateChange?.(false);
            alert(`文件已存在，跳过上传。\n\n已存在的文件: ${result.existingFile}\n当前文件: ${fileName}\n\n这两个文件的内容完全相同（哈希值一致）。`);
            await loadFiles();
            return;
          }
          
          setUploadProgress((prev) => prev ? { ...prev, progress: 100 } : null);
          await loadFiles();
        } finally {
          window.ipcRenderer.off('sdcpp:upload-progress', progressListener);
          setLoading(false);
          setIsUploading(false);
          onUploadStateChange?.(false);
          setTimeout(() => setUploadProgress(null), 1000);
        }
      }
    } catch (error) {
      console.error('上传文件失败:', error);
      setUploadProgress(null);
      setLoading(false);
      setIsUploading(false);
      onUploadStateChange?.(false);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code
      const isCancellationError = errorMessage.includes('上传已取消') || 
        errorMessage.includes('Premature close') ||
        errorMessage.includes('ERR_STREAM_PREMATURE_CLOSE') ||
        errorCode === 'ERR_STREAM_PREMATURE_CLOSE';
      
      if (!isCancellationError) {
        alert(`上传文件失败: ${errorMessage}`);
      }
    }
  };

  const handleDownload = async (file: EngineFile) => {
    try {
      setLoading(true);
      await window.ipcRenderer.invoke('sdcpp:download-file', file.path);
    } catch (error) {
      console.error('下载文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (file: EngineFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    try {
      setLoading(true);
      await window.ipcRenderer.invoke('sdcpp:delete-file', fileToDelete.path);
      await loadFiles();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (error) {
      console.error('删除文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
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

  return (
    <div className={styles.container}>
      <Title1>SD.cpp 推理引擎</Title1>

      {/* 设备类型选择 */}
      <Card className={styles.section}>
        <Title2>推理设备选择</Title2>
        <div className={styles.deviceSelection}>
          <Label>选择推理设备类型</Label>
          <RadioGroup
            value={deviceType}
            onChange={(_, data) => handleDeviceTypeChange(data.value as DeviceType)}
          >
            <Radio value="cpu" label="CPU" />
            <Radio value="vulkan" label="Vulkan" />
            <Radio value="cuda" label="CUDA" />
          </RadioGroup>
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          当前选择: {getDeviceLabel(deviceType)}。引擎文件将根据选择的设备类型存放在对应的子文件夹中。
        </Body1>
      </Card>

      {/* 文件夹路径输入区域 */}
      <Card className={styles.section}>
        <Title2>引擎文件夹路径</Title2>
        <div className={styles.folderPath}>
          <Field label="引擎文件夹路径" style={{ flex: 1 }}>
            <Input
              value={engineFolder}
              onChange={(_, data) => handleFolderPathChange(data.value)}
              placeholder="默认使用应用数据目录下的 sdcpp-engines 文件夹"
              style={{ flex: 1 }}
              readOnly={!!engineFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.currentTarget.readOnly) {
                  handleSetFolder();
                }
              }}
            />
          </Field>
          {!engineFolder ? (
            <Button
              onClick={handleSetFolder}
              appearance="primary"
              disabled={!engineFolder || loading}
            >
              使用自定义路径
            </Button>
          ) : null}
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          {engineFolder 
            ? `使用文件夹: ${engineFolder}。引擎文件将根据设备类型存放在 ${deviceType} 子文件夹中。支持格式：exe, dll, so, dylib, bin`
            : '默认使用应用数据目录下的 sdcpp-engines 文件夹，也可以输入自定义路径。支持格式：exe, dll, so, dylib, bin'}
        </Body1>
      </Card>

      {/* 操作按钮 */}
      <Card className={styles.section}>
        <div className={styles.actions}>
          <Button
            icon={<ArrowUploadRegular />}
            onClick={handleUpload}
            disabled={!engineFolder || !deviceType || loading}
            appearance="primary"
          >
            上传引擎
          </Button>
          <Button
            onClick={loadFiles}
            disabled={!engineFolder || !deviceType || loading}
          >
            刷新列表
          </Button>
        </div>
        {/* 上传进度条 */}
        {uploadProgress && (
          <div style={{ marginTop: tokens.spacingVerticalM }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalXS }}>
              <Body1>
                正在上传: {uploadProgress.fileName || '文件'} ({uploadProgress.progress}%)
              </Body1>
              {isUploading && (
                <Button
                  icon={<DismissRegular />}
                  size="small"
                  appearance="secondary"
                  onClick={handleCancelUpload}
                >
                  取消
                </Button>
              )}
            </div>
            <ProgressBar value={uploadProgress.progress} max={100} />
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
              {formatFileSize(uploadProgress.copied)} / {formatFileSize(uploadProgress.total)}
            </Body1>
          </div>
        )}
      </Card>

      {/* 文件列表 */}
      <Card className={styles.section}>
        <Title2>引擎文件列表 ({getDeviceLabel(deviceType)})</Title2>
        {loading && files.length === 0 ? (
          <div className={styles.emptyState}>
            <Spinner size="large" />
            <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
          </div>
        ) : files.length === 0 ? (
          <div className={styles.emptyState}>
            <Body1>暂无引擎文件</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              {engineFolder && deviceType ? '请上传引擎文件' : '请先选择引擎文件夹和设备类型'}
            </Body1>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>文件名</TableHeaderCell>
                  <TableHeaderCell>大小</TableHeaderCell>
                  <TableHeaderCell>修改时间</TableHeaderCell>
                  <TableHeaderCell>操作</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.path}>
                    <TableCell>
                      <Body1>{file.name}</Body1>
                    </TableCell>
                    <TableCell>
                      <Body1>{formatFileSize(file.size)}</Body1>
                    </TableCell>
                    <TableCell>
                      <Body1>{formatDate(file.modified)}</Body1>
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                        <Button
                          icon={<ArrowDownloadRegular />}
                          size="small"
                          onClick={() => handleDownload(file)}
                          disabled={loading}
                        >
                          下载
                        </Button>
                        <Button
                          icon={<DeleteRegular />}
                          size="small"
                          appearance="secondary"
                          onClick={() => handleDeleteClick(file)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(_, data) => setDeleteDialogOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>确认删除</DialogTitle>
          <DialogBody>
            <DialogContent>
              <Body1>
                确定要删除文件 "{fileToDelete?.name}" 吗？此操作无法撤销。
              </Body1>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setFileToDelete(null);
                }}
              >
                取消
              </Button>
              <Button
                appearance="primary"
                onClick={handleDeleteConfirm}
                disabled={loading}
              >
                删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

    </div>
  );
};

