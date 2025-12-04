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
} from '@fluentui/react-components';
import {
  FolderRegular,
  ArrowUploadRegular,
  ArrowDownloadRegular,
  DeleteRegular,
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
});

interface WeightFile {
  name: string;
  size: number;
  path: string;
  modified: number;
}

export const ModelWeightsPage = () => {
  const styles = useStyles();
  const [weightsFolder, setWeightsFolder] = useState<string>('');
  const [files, setFiles] = useState<WeightFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<WeightFile | null>(null);

  // 等待 ipcRenderer 可用
  const waitForIpcRenderer = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 立即检查
      if (window.ipcRenderer) {
        resolve();
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 100; // 最多等待 10 秒
      const interval = setInterval(() => {
        attempts++;
        if (window.ipcRenderer) {
          clearInterval(interval);
          console.log(`[Renderer] IPC 渲染器在 ${attempts * 100}ms 后可用`);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.error('[Renderer] IPC 渲染器初始化超时');
          console.error('[Renderer] 请检查:');
          console.error('  1. Preload 脚本是否正确加载');
          console.error('  2. 主进程控制台是否有错误信息');
          console.error('  3. 是否在 Electron 环境中运行');
          reject(new Error('IPC 渲染器初始化超时。请检查主进程控制台的错误信息，确保 preload 脚本正确加载。'));
        }
      }, 100);
    });
  };

  // 加载权重文件夹路径
  useEffect(() => {
    const init = async () => {
      try {
        await waitForIpcRenderer();
        await loadWeightsFolder();
      } catch (error) {
        console.error('初始化失败:', error);
        // 不阻塞 UI，允许用户手动输入路径
        console.warn('IPC 不可用，部分功能可能受限。请检查 preload 脚本是否正确加载。');
      }
    };
    init();
  }, []);

  // 当文件夹路径改变时，加载文件列表
  useEffect(() => {
    if (weightsFolder) {
      loadFiles();
    }
  }, [weightsFolder]);

  const loadWeightsFolder = async () => {
    if (!window.ipcRenderer) {
      console.warn('ipcRenderer 不可用，跳过加载权重文件夹');
      return;
    }
    try {
      const folder = await window.ipcRenderer.invoke('weights:get-folder');
      if (folder) {
        setWeightsFolder(folder);
      }
    } catch (error) {
      console.error('加载权重文件夹失败:', error);
    }
  };

  const loadFiles = async () => {
    if (!weightsFolder || !window.ipcRenderer) return;
    setLoading(true);
    try {
      const fileList = await window.ipcRenderer.invoke('weights:list-files', weightsFolder);
      setFiles(fileList || []);
    } catch (error) {
      console.error('加载文件列表失败:', error);
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
      await waitForIpcRenderer();
      if (!window.ipcRenderer) {
        throw new Error('IPC 渲染器未初始化，请检查 preload 脚本');
      }
      
      // 验证文件夹是否存在
      const exists = await window.ipcRenderer.invoke('weights:check-folder', weightsFolder.trim());
      if (!exists) {
        alert('文件夹不存在，请检查路径是否正确');
        return;
      }
      
      await window.ipcRenderer.invoke('weights:set-folder', weightsFolder.trim());
      await loadFiles();
    } catch (error) {
      console.error('设置文件夹失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`设置文件夹失败: ${errorMessage}`);
    }
  };

  const handleFolderPathChange = (value: string) => {
    setWeightsFolder(value);
  };

  const handleUpload = async () => {
    if (!weightsFolder) return;
    try {
      await waitForIpcRenderer();
      if (!window.ipcRenderer) return;
      
      const filePath = await window.ipcRenderer.invoke('weights:select-file');
      if (filePath) {
        setLoading(true);
        await window.ipcRenderer.invoke('weights:upload-file', filePath, weightsFolder);
        await loadFiles();
      }
    } catch (error) {
      console.error('上传文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: WeightFile) => {
    try {
      await waitForIpcRenderer();
      if (!window.ipcRenderer) return;
      
      setLoading(true);
      await window.ipcRenderer.invoke('weights:download-file', file.path);
    } catch (error) {
      console.error('下载文件失败:', error);
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
      await waitForIpcRenderer();
      if (!window.ipcRenderer) return;
      
      setLoading(true);
      await window.ipcRenderer.invoke('weights:delete-file', fileToDelete.path);
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

  return (
    <div className={styles.container}>
      <Title1>模型权重管理</Title1>

      {/* 文件夹路径输入区域 */}
      <Card className={styles.section}>
        <Title2>权重文件夹路径</Title2>
        <div className={styles.folderPath}>
          <Field label="输入权重文件夹路径" style={{ flex: 1 }}>
            <Input
              value={weightsFolder}
              onChange={(_, data) => handleFolderPathChange(data.value)}
              placeholder="例如: C:\Users\YourName\huggingface\models"
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
            disabled={!weightsFolder.trim() || loading}
          >
            确认
          </Button>
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          输入 Hugging Face 权重文件夹的完整路径，然后点击"确认"按钮
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

