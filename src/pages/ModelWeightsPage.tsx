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
  Tooltip,
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
  truncatedText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    width: '100%',
  },
  tableCellFileName: {
    maxWidth: '400px',
    minWidth: '200px',
    overflow: 'hidden',
  },
  tableCellSize: {
    maxWidth: '150px',
    minWidth: '100px',
    overflow: 'hidden',
  },
  tableCellDate: {
    maxWidth: '200px',
    minWidth: '150px',
    overflow: 'hidden',
  },
});

interface WeightFile {
  name: string;
  size: number;
  path: string;
  modified: number;
}

interface ModelWeightsPageProps {
  onUploadStateChange?: (isUploading: boolean) => void;
}

export const ModelWeightsPage = ({ onUploadStateChange }: ModelWeightsPageProps) => {
  const styles = useStyles();
  const [weightsFolder, setWeightsFolder] = useState<string>('');
  const [files, setFiles] = useState<WeightFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<WeightFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    progress: number;
    fileName: string;
    copied: number;
    total: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 加载权重文件夹路径
  useEffect(() => {
    loadWeightsFolder().catch(console.error);
  }, []);

  // 当文件夹路径改变时，加载文件列表
  useEffect(() => {
    if (weightsFolder) {
      loadFiles();
    }
  }, [weightsFolder]);

  const loadWeightsFolder = async () => {
    try {
      // 先尝试获取已保存的文件夹路径
      let folder = await window.ipcRenderer.invoke('weights:get-folder');
      
      // 如果没有保存的路径，则使用默认文件夹
      if (!folder) {
        folder = await window.ipcRenderer.invoke('weights:init-default-folder');
        // 保存默认文件夹路径
        await window.ipcRenderer.invoke('weights:set-folder', folder);
      }
      
      if (folder) {
        setWeightsFolder(folder);
      }
    } catch (error) {
      console.error('Failed to load weights folder:', error);
    }
  };

  const loadFiles = async () => {
    if (!weightsFolder) return;
    setLoading(true);
    try {
      const fileList = await window.ipcRenderer.invoke('weights:list-files', weightsFolder);
      setFiles(fileList || []);
    } catch (error) {
      console.error('Failed to load file list:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSetFolder = async () => {
    if (!weightsFolder.trim()) {
      alert('请输入有效的文件夹路径');
      return;
    }
    
    try {
      // 验证文件夹是否存在
      const exists = await window.ipcRenderer.invoke('weights:check-folder', weightsFolder.trim());
      if (!exists) {
        alert('文件夹不存在，请检查路径是否正确');
        return;
      }
      
      await window.ipcRenderer.invoke('weights:set-folder', weightsFolder.trim());
      await loadFiles();
    } catch (error) {
      console.error('Failed to set folder:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`设置文件夹失败: ${errorMessage}`);
    }
  };

  const handleFolderPathChange = (value: string) => {
    setWeightsFolder(value);
  };

  const handleCancelUpload = async () => {
    try {
      await window.ipcRenderer.invoke('weights:cancel-upload');
      
      // 清理状态
      setUploadProgress(null);
      setLoading(false);
      setIsUploading(false);
      // 通知父组件上传结束，恢复导航
      onUploadStateChange?.(false);
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  };

  const handleUpload = async () => {
    if (!weightsFolder) return;
    try {
      const filePath = await window.ipcRenderer.invoke('weights:select-file');
      if (filePath) {
        const fileName = filePath.split(/[/\\]/).pop() || '文件';
        setLoading(true);
        setIsUploading(true);
        setUploadProgress({ progress: 0, fileName, copied: 0, total: 0 });
        
        // 通知父组件开始上传，禁用导航
        onUploadStateChange?.(true);
        
        // 监听上传进度
        const progressListener = (_: any, data: { progress: number; fileName: string; copied: number; total: number }) => {
          setUploadProgress(data);
        };
        
        window.ipcRenderer.on('weights:upload-progress', progressListener);
        
        try {
          const result = await window.ipcRenderer.invoke('weights:upload-file', filePath, weightsFolder);
          
          // 检查是否已取消
          if (result && result.cancelled) {
            // 清除进度显示和加载状态
            setUploadProgress(null);
            setLoading(false);
            setIsUploading(false);
            window.ipcRenderer.off('weights:upload-progress', progressListener);
            // 通知父组件上传结束，恢复导航
            onUploadStateChange?.(false);
            return;
          }
          
          // 检查是否因为重复文件而跳过
          if (result && result.skipped && result.reason === 'duplicate') {
            // 清除进度显示和加载状态
            setUploadProgress(null);
            setLoading(false);
            setIsUploading(false);
            window.ipcRenderer.off('weights:upload-progress', progressListener);
            // 通知父组件上传结束，恢复导航
            onUploadStateChange?.(false);
            // 显示提示信息
            alert(`文件已存在，跳过上传。\n\n已存在的文件: ${result.existingFile}\n当前文件: ${fileName}\n\n这两个文件的内容完全相同（哈希值一致）。`);
            await loadFiles();
            return;
          }
          
          // 确保显示 100%
          setUploadProgress((prev) => prev ? { ...prev, progress: 100 } : null);
          await loadFiles();
        } finally {
          window.ipcRenderer.off('weights:upload-progress', progressListener);
          setLoading(false);
          setIsUploading(false);
          // 通知父组件上传结束，恢复导航
          onUploadStateChange?.(false);
          // 延迟清除进度，让用户看到 100%
          setTimeout(() => setUploadProgress(null), 1000);
        }
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      setUploadProgress(null);
      setLoading(false);
      setIsUploading(false);
      // 通知父组件上传结束，恢复导航
      onUploadStateChange?.(false);
      
      // 检查是否是取消操作导致的错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code
      const isCancellationError = errorMessage.includes('上传已取消') || 
        errorMessage.includes('Premature close') ||
        errorMessage.includes('ERR_STREAM_PREMATURE_CLOSE') ||
        errorCode === 'ERR_STREAM_PREMATURE_CLOSE';
      
      // 如果是取消操作，不显示错误提示
      if (!isCancellationError) {
        alert(`上传文件失败: ${errorMessage}`);
      }
    }
  };

  const handleDownload = async (file: WeightFile) => {
    try {
      setLoading(true);
      await window.ipcRenderer.invoke('weights:download-file', file.path);
    } catch (error) {
      console.error('Failed to download file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (file: WeightFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    try {
      setLoading(true);
      await window.ipcRenderer.invoke('weights:delete-file', fileToDelete.path);
      await loadFiles();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (error) {
      console.error('Failed to delete file:', error);
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

  return (
    <div className={styles.container}>
      <Title1>模型权重管理</Title1>

      {/* 文件夹路径输入区域 */}
      <Card className={styles.section}>
        <Title2>权重文件夹路径</Title2>
        <div className={styles.folderPath}>
          <Field label="权重文件夹路径" style={{ flex: 1 }}>
            <Input
              value={weightsFolder}
              onChange={(_, data) => handleFolderPathChange(data.value)}
              placeholder="默认使用应用数据目录下的 models 文件夹"
              style={{ flex: 1 }}
              readOnly={!!weightsFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.currentTarget.readOnly) {
                  handleSetFolder();
                }
              }}
            />
          </Field>
          {!weightsFolder ? (
            <Button
              onClick={handleSetFolder}
              appearance="primary"
              disabled={!weightsFolder || loading}
            >
              使用自定义路径
            </Button>
          ) : null}
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          {weightsFolder 
            ? `使用文件夹: ${weightsFolder}。权重文件将自动扫描并显示在下方，可以上传（复制）权重文件到此文件夹。支持格式：bin, safetensors, pt, pth, onnx, ckpt, gguf`
            : '默认使用应用数据目录下的 models 文件夹，也可以输入自定义路径。支持格式：bin, safetensors, pt, pth, onnx, ckpt, gguf'}
        </Body1>
      </Card>

      {/* 操作按钮 */}
      <Card className={styles.section}>
        <div className={styles.actions}>
          <Button
            icon={<ArrowUploadRegular />}
            onClick={handleUpload}
            disabled={!weightsFolder || loading}
            appearance="primary"
          >
            上传权重
          </Button>
          <Button
            onClick={loadFiles}
            disabled={!weightsFolder || loading}
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
        <Title2>权重文件列表</Title2>
        {loading && files.length === 0 ? (
          <div className={styles.emptyState}>
            <Spinner size="large" />
            <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
          </div>
        ) : files.length === 0 ? (
          <div className={styles.emptyState}>
            <Body1>暂无权重文件</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              {weightsFolder ? '请上传权重文件' : '请先选择权重文件夹'}
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
                    <TableCell className={styles.tableCellFileName}>
                      <Tooltip content={file.name} relationship="label">
                        <div className={styles.truncatedText} title={file.name}>
                          <Body1>{file.name}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell className={styles.tableCellSize}>
                      <Tooltip content={formatFileSize(file.size)} relationship="label">
                        <div className={styles.truncatedText} title={formatFileSize(file.size)}>
                          <Body1>{formatFileSize(file.size)}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell className={styles.tableCellDate}>
                      <Tooltip content={formatDate(file.modified)} relationship="label">
                        <div className={styles.truncatedText} title={formatDate(file.modified)}>
                          <Body1>{formatDate(file.modified)}</Body1>
                        </div>
                      </Tooltip>
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

