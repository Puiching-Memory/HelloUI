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
  Dropdown,
  Option,
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  DeleteRegular,
  DismissRegular,
  AddRegular,
  EditRegular,
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

type TaskType = 'generate' | 'edit' | 'video' | 'all';

interface ModelGroup {
  id: string;
  name: string;
  taskType?: TaskType;  // 任务类型：generate（图片生成）、edit（图片编辑）、video（视频生成）
  sdModel?: string;
  highNoiseSdModel?: string;  // 高噪声SD模型路径（视频生成用，可选）
  vaeModel?: string;
  llmModel?: string;
  clipLModel?: string;  // CLIP L模型路径（图片编辑任务用，可选）
  t5xxlModel?: string;  // T5XXL模型路径（图片编辑任务用，可选）
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
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModelGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupSdModel, setGroupSdModel] = useState<string>('');
  const [groupHighNoiseSdModel, setGroupHighNoiseSdModel] = useState<string>('');
  const [groupVaeModel, setGroupVaeModel] = useState<string>('');
  const [groupLlmModel, setGroupLlmModel] = useState<string>('');
  const [groupClipLModel, setGroupClipLModel] = useState<string>('');
  const [groupT5xxlModel, setGroupT5xxlModel] = useState<string>('');
  const [groupDefaultSteps, setGroupDefaultSteps] = useState<string>('20');
  const [groupDefaultCfgScale, setGroupDefaultCfgScale] = useState<string>('7.0');
  const [groupDefaultWidth, setGroupDefaultWidth] = useState<string>('512');
  const [groupDefaultHeight, setGroupDefaultHeight] = useState<string>('512');
  const [groupDefaultSamplingMethod, setGroupDefaultSamplingMethod] = useState<string>('euler_a');
  const [groupDefaultScheduler, setGroupDefaultScheduler] = useState<string>('discrete');
  const [groupDefaultSeed, setGroupDefaultSeed] = useState<string>('');
  const [groupTaskType, setGroupTaskType] = useState<TaskType>('generate');

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

  // 加载模型组列表
  useEffect(() => {
    loadModelGroups().catch(console.error);
  }, []);

  const loadWeightsFolder = async () => {
    if (!window.ipcRenderer) {
      return;
    }
    
    let folder = await window.ipcRenderer.invoke('weights:get-folder');
    
    if (!folder) {
      folder = await window.ipcRenderer.invoke('weights:init-default-folder');
      await window.ipcRenderer.invoke('weights:set-folder', folder);
    }
    
    if (folder) {
      setWeightsFolder(folder);
    }
  };

  const loadFiles = async () => {
    if (!weightsFolder || !window.ipcRenderer) return;
    setLoading(true);
    try {
      const fileList = await window.ipcRenderer.invoke('weights:list-files', weightsFolder);
      setFiles(fileList || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSetFolder = async () => {
    if (!weightsFolder.trim() || !window.ipcRenderer) {
      if (!weightsFolder.trim()) {
        alert('请输入有效的文件夹路径');
      }
      return;
    }
    
    const exists = await window.ipcRenderer.invoke('weights:check-folder', weightsFolder.trim());
    if (!exists) {
      alert('文件夹不存在，请检查路径是否正确');
      return;
    }
    
    await window.ipcRenderer.invoke('weights:set-folder', weightsFolder.trim());
    await loadFiles();
  };

  const handleFolderPathChange = (value: string) => {
    setWeightsFolder(value);
  };

  const handleCancelUpload = async () => {
    if (!window.ipcRenderer) return;
    
    await window.ipcRenderer.invoke('weights:cancel-upload');
    
    setUploadProgress(null);
    setLoading(false);
    setIsUploading(false);
    onUploadStateChange?.(false);
  };

  const handleUpload = async () => {
    if (!weightsFolder || !window.ipcRenderer) return;
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
          
          if (result?.cancelled) {
            return;
          }
          
          if (result?.skipped && result.reason === 'duplicate') {
            alert(`文件已存在，跳过上传。\n\n已存在的文件: ${result.existingFile}\n当前文件: ${fileName}\n\n这两个文件的内容完全相同（哈希值一致）。`);
            await loadFiles();
            return;
          }
          
          setUploadProgress((prev) => prev ? { ...prev, progress: 100 } : null);
          await loadFiles();
        } finally {
          window.ipcRenderer.off('weights:upload-progress', progressListener);
          setLoading(false);
          setIsUploading(false);
          onUploadStateChange?.(false);
          setTimeout(() => setUploadProgress(null), 1000);
        }
      }
    } catch (error) {
      setUploadProgress(null);
      setLoading(false);
      setIsUploading(false);
      onUploadStateChange?.(false);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('上传已取消')) {
        alert(`上传文件失败: ${errorMessage}`);
      }
    }
  };

  const handleDownload = async (file: WeightFile) => {
    setLoading(true);
    try {
      await window.ipcRenderer.invoke('weights:download-file', file.path);
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
    setLoading(true);
    try {
      await window.ipcRenderer.invoke('weights:delete-file', fileToDelete.path);
      await loadFiles();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
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

  const loadModelGroups = async () => {
    if (!window.ipcRenderer) return;
    const groups = await window.ipcRenderer.invoke('model-groups:list');
    setModelGroups(groups || []);
  };

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupSdModel('');
    setGroupHighNoiseSdModel('');
    setGroupVaeModel('');
    setGroupLlmModel('');
    setGroupClipLModel('');
    setGroupT5xxlModel('');
    setGroupDefaultSteps('20');
    setGroupDefaultCfgScale('7.0');
    setGroupDefaultWidth('512');
    setGroupDefaultHeight('512');
    setGroupDefaultSamplingMethod('euler_a');
    setGroupDefaultScheduler('discrete');
    setGroupDefaultSeed('');
    setGroupTaskType('generate');
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: ModelGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupSdModel(group.sdModel || '');
    setGroupHighNoiseSdModel(group.highNoiseSdModel || '');
    setGroupVaeModel(group.vaeModel || '');
    setGroupLlmModel(group.llmModel || '');
    setGroupClipLModel(group.clipLModel || '');
    setGroupT5xxlModel(group.t5xxlModel || '');
    setGroupDefaultSteps(group.defaultSteps?.toString() || '20');
    setGroupDefaultCfgScale(group.defaultCfgScale?.toString() || '7.0');
    setGroupDefaultWidth(group.defaultWidth?.toString() || '512');
    setGroupDefaultHeight(group.defaultHeight?.toString() || '512');
    setGroupDefaultSamplingMethod(group.defaultSamplingMethod || 'euler_a');
    setGroupDefaultScheduler(group.defaultScheduler || 'discrete');
    setGroupDefaultSeed(group.defaultSeed !== undefined && group.defaultSeed >= 0 ? group.defaultSeed.toString() : '');
    setGroupTaskType(group.taskType || 'generate');
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      alert('请输入组名称');
      return;
    }

    // 创建新模型组时，必须所有必需的模型都选择了有效模型
    if (!editingGroup) {
      if (!groupSdModel || !groupSdModel.trim()) {
        alert('创建新模型组时，必须选择SD模型');
        return;
      }
      if (!groupVaeModel || !groupVaeModel.trim()) {
        alert('创建新模型组时，必须选择VAE模型');
        return;
      }
      if (groupTaskType === 'edit') {
        // 图片编辑任务需要 CLIP L 和 T5XXL 模型
        if (!groupClipLModel || !groupClipLModel.trim()) {
          alert('创建图片编辑模型组时，必须选择CLIP L模型');
          return;
        }
        if (!groupT5xxlModel || !groupT5xxlModel.trim()) {
          alert('创建图片编辑模型组时，必须选择T5XXL模型');
          return;
        }
      } else {
        // 其他任务类型需要 LLM/CLIP 模型
        if (!groupLlmModel || !groupLlmModel.trim()) {
          alert('创建新模型组时，必须选择LLM/CLIP模型');
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (editingGroup) {
        await window.ipcRenderer.invoke('model-groups:update', editingGroup.id, {
          name: groupName.trim(),
          taskType: groupTaskType,
          sdModel: groupSdModel || undefined,
          highNoiseSdModel: groupHighNoiseSdModel || undefined,
          vaeModel: groupVaeModel || undefined,
          llmModel: groupLlmModel || undefined,
          clipLModel: groupClipLModel || undefined,
          t5xxlModel: groupT5xxlModel || undefined,
          defaultSteps: groupDefaultSteps ? parseFloat(groupDefaultSteps) : undefined,
          defaultCfgScale: groupDefaultCfgScale ? parseFloat(groupDefaultCfgScale) : undefined,
          defaultWidth: groupDefaultWidth ? parseInt(groupDefaultWidth) : undefined,
          defaultHeight: groupDefaultHeight ? parseInt(groupDefaultHeight) : undefined,
          defaultSamplingMethod: groupDefaultSamplingMethod || undefined,
          defaultScheduler: groupDefaultScheduler || undefined,
          defaultSeed: groupDefaultSeed ? parseInt(groupDefaultSeed) : undefined,
        });
      } else {
        // 创建新组
        await window.ipcRenderer.invoke('model-groups:create', {
          name: groupName.trim(),
          taskType: groupTaskType,
          sdModel: groupSdModel || undefined,
          highNoiseSdModel: groupHighNoiseSdModel || undefined,
          vaeModel: groupVaeModel || undefined,
          llmModel: groupLlmModel || undefined,
          clipLModel: groupClipLModel || undefined,
          t5xxlModel: groupT5xxlModel || undefined,
          defaultSteps: groupDefaultSteps ? parseFloat(groupDefaultSteps) : undefined,
          defaultCfgScale: groupDefaultCfgScale ? parseFloat(groupDefaultCfgScale) : undefined,
          defaultWidth: groupDefaultWidth ? parseInt(groupDefaultWidth) : undefined,
          defaultHeight: groupDefaultHeight ? parseInt(groupDefaultHeight) : undefined,
          defaultSamplingMethod: groupDefaultSamplingMethod || undefined,
          defaultScheduler: groupDefaultScheduler || undefined,
          defaultSeed: groupDefaultSeed ? parseInt(groupDefaultSeed) : undefined,
        });
      }
      await loadModelGroups();
      setGroupDialogOpen(false);
      setEditingGroup(null);
    } catch (error) {
      console.error('Failed to save group:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`保存模型组失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (group: ModelGroup) => {
    if (!confirm(`确定要删除模型组 "${group.name}" 吗？`)) {
      return;
    }

    setLoading(true);
    try {
      await window.ipcRenderer.invoke('model-groups:delete', group.id);
      await loadModelGroups();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`删除模型组失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getModelFileName = (path: string | undefined): string => {
    if (!path) return '未选择';
    const file = files.find(f => f.path === path);
    return file ? file.name : path.split(/[/\\]/).pop() || path;
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

      {/* 模型组管理 */}
      <Card className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalM }}>
          <Title2>模型组管理</Title2>
          <Button
            icon={<AddRegular />}
            onClick={handleCreateGroup}
            disabled={loading || !weightsFolder || files.length === 0}
            appearance="primary"
          >
            创建模型组
          </Button>
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }}>
          模型组用于组合SD模型、VAE模型和LLM/CLIP模型，便于在生成图片时统一使用。
        </Body1>
        {modelGroups.length === 0 ? (
          <div className={styles.emptyState}>
            <Body1>暂无模型组</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              点击"创建模型组"按钮创建一个新的模型组
            </Body1>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>组名称</TableHeaderCell>
                  <TableHeaderCell>任务类型</TableHeaderCell>
                  <TableHeaderCell>SD模型</TableHeaderCell>
                  <TableHeaderCell>VAE模型</TableHeaderCell>
                  <TableHeaderCell>LLM模型</TableHeaderCell>
                  <TableHeaderCell>操作</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelGroups.map((group) => {
                  const getTaskTypeLabel = (taskType?: TaskType) => {
                    switch (taskType) {
                      case 'generate':
                        return '图片生成';
                      case 'edit':
                        return '图片编辑';
                      case 'video':
                        return '视频生成';
                      default:
                        return '未指定';
                    }
                  };
                  
                  return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Body1>{group.name}</Body1>
                    </TableCell>
                    <TableCell>
                      <Body1>{getTaskTypeLabel(group.taskType)}</Body1>
                    </TableCell>
                    <TableCell>
                      <Tooltip content={getModelFileName(group.sdModel)} relationship="label">
                        <div className={styles.truncatedText} title={getModelFileName(group.sdModel)}>
                          <Body1>{getModelFileName(group.sdModel)}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip content={getModelFileName(group.vaeModel)} relationship="label">
                        <div className={styles.truncatedText} title={getModelFileName(group.vaeModel)}>
                          <Body1>{getModelFileName(group.vaeModel)}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip content={getModelFileName(group.llmModel)} relationship="label">
                        <div className={styles.truncatedText} title={getModelFileName(group.llmModel)}>
                          <Body1>{getModelFileName(group.llmModel)}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                        <Button
                          icon={<EditRegular />}
                          size="small"
                          onClick={() => handleEditGroup(group)}
                          disabled={loading}
                        >
                          编辑
                        </Button>
                        <Button
                          icon={<DeleteRegular />}
                          size="small"
                          appearance="secondary"
                          onClick={() => handleDeleteGroup(group)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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

      {/* 模型组编辑对话框 */}
      <Dialog open={groupDialogOpen} onOpenChange={(_, data) => {
        setGroupDialogOpen(data.open);
        if (!data.open) {
          setEditingGroup(null);
          setGroupName('');
          setGroupSdModel('');
          setGroupVaeModel('');
          setGroupLlmModel('');
          setGroupClipLModel('');
          setGroupT5xxlModel('');
          setGroupDefaultSteps('20');
          setGroupDefaultCfgScale('7.0');
          setGroupDefaultWidth('512');
          setGroupDefaultHeight('512');
          setGroupDefaultSamplingMethod('euler_a');
          setGroupDefaultScheduler('discrete');
          setGroupDefaultSeed('');
        }
      }}>
        <DialogSurface style={{ minWidth: '600px' }}>
          <DialogTitle>{editingGroup ? '编辑模型组' : '创建模型组'}</DialogTitle>
          <DialogBody>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                <Field label="组名称" required>
                  <Input
                    value={groupName}
                    onChange={(_, data) => setGroupName(data.value)}
                    placeholder="请输入模型组名称"
                  />
                </Field>
                <Field label="任务类型" hint="选择此模型组可用于哪些任务" required>
                  <Dropdown
                    value={groupTaskType === 'generate' ? '图片生成' : groupTaskType === 'edit' ? '图片编辑' : '视频生成'}
                    selectedOptions={[groupTaskType]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setGroupTaskType(data.optionValue as TaskType);
                      }
                    }}
                  >
                    <Option value="generate">图片生成</Option>
                    <Option value="edit">图片编辑</Option>
                    <Option value="video">视频生成</Option>
                  </Dropdown>
                </Field>
                <Field
                  label={groupTaskType === 'video' ? '基础视频模型（必选，LowNoise）' : 'SD模型（必选）'}
                  hint={groupTaskType === 'video' ? '例如 Wan2.2-T2V/I2V-LowNoise-*.gguf' : undefined}
                >
                  <Dropdown
                    placeholder={groupTaskType === 'video' ? '请选择基础视频模型（LowNoise）' : '请选择SD模型'}
                    value={getModelFileName(groupSdModel)}
                    selectedOptions={[groupSdModel]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setGroupSdModel(data.optionValue);
                      }
                    }}
                  >
                    {files.map((file) => (
                      <Option key={file.path} value={file.path} text={file.name}>
                        {file.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                {groupTaskType === 'video' && (
                  <Field
                    label="高噪声视频模型（可选，HighNoise）"
                    hint="例如 Wan2.2-T2V/I2V-HighNoise-*.gguf。若未选择，将只使用基础模型。"
                  >
                    <Dropdown
                      placeholder="请选择高噪声视频模型（HighNoise，可选）"
                      value={getModelFileName(groupHighNoiseSdModel)}
                      selectedOptions={[groupHighNoiseSdModel]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setGroupHighNoiseSdModel(data.optionValue);
                        } else {
                          setGroupHighNoiseSdModel('');
                        }
                      }}
                    >
                      {editingGroup && <Option value="" text="无">无</Option>}
                      {files.map((file) => (
                        <Option key={file.path} value={file.path} text={file.name}>
                          {file.name}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                )}
                <Field label={editingGroup ? "VAE模型（可选）" : "VAE模型（必选）"}>
                  <Dropdown
                    placeholder={editingGroup ? "请选择VAE模型（可选）" : "请选择VAE模型（必选）"}
                    value={getModelFileName(groupVaeModel)}
                    selectedOptions={[groupVaeModel]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        setGroupVaeModel(data.optionValue);
                      } else {
                        setGroupVaeModel('');
                      }
                    }}
                  >
                    {editingGroup && <Option value="" text="无">无</Option>}
                    {files.filter(file => {
                      // 当前已选择的VAE模型可以显示（如果正在编辑）
                      if (file.path === groupVaeModel) return true;
                      // 过滤掉已被其他模型选择的文件
                      return file.path !== groupSdModel && file.path !== groupLlmModel && 
                             file.path !== groupClipLModel && file.path !== groupT5xxlModel;
                    }).map((file) => (
                      <Option key={file.path} value={file.path} text={file.name}>
                        {file.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                {groupTaskType === 'edit' ? (
                  <>
                    <Field label={editingGroup ? "CLIP L模型（可选）" : "CLIP L模型（必选）"}>
                      <Dropdown
                        placeholder={editingGroup ? "请选择CLIP L模型（可选）" : "请选择CLIP L模型（必选）"}
                        value={getModelFileName(groupClipLModel)}
                        selectedOptions={[groupClipLModel]}
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) {
                            setGroupClipLModel(data.optionValue);
                          } else {
                            setGroupClipLModel('');
                          }
                        }}
                      >
                        {editingGroup && <Option value="" text="无">无</Option>}
                        {files.filter(file => {
                          // 当前已选择的CLIP L模型可以显示（如果正在编辑）
                          if (file.path === groupClipLModel) return true;
                          // 过滤掉已被其他模型选择的文件
                          return file.path !== groupSdModel && file.path !== groupVaeModel && 
                                 file.path !== groupLlmModel && file.path !== groupT5xxlModel;
                        }).map((file) => (
                          <Option key={file.path} value={file.path} text={file.name}>
                            {file.name}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label={editingGroup ? "T5XXL模型（可选）" : "T5XXL模型（必选）"}>
                      <Dropdown
                        placeholder={editingGroup ? "请选择T5XXL模型（可选）" : "请选择T5XXL模型（必选）"}
                        value={getModelFileName(groupT5xxlModel)}
                        selectedOptions={[groupT5xxlModel]}
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) {
                            setGroupT5xxlModel(data.optionValue);
                          } else {
                            setGroupT5xxlModel('');
                          }
                        }}
                      >
                        {editingGroup && <Option value="" text="无">无</Option>}
                        {files.filter(file => {
                          // 当前已选择的T5XXL模型可以显示（如果正在编辑）
                          if (file.path === groupT5xxlModel) return true;
                          // 过滤掉已被其他模型选择的文件
                          return file.path !== groupSdModel && file.path !== groupVaeModel && 
                                 file.path !== groupLlmModel && file.path !== groupClipLModel;
                        }).map((file) => (
                          <Option key={file.path} value={file.path} text={file.name}>
                            {file.name}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                  </>
                ) : (
                  <Field
                    label={
                      groupTaskType === 'video'
                        ? (editingGroup ? '文本编码器 / T5 模型（可选）' : '文本编码器 / T5 模型（必选）')
                        : (editingGroup ? 'LLM/CLIP模型（可选）' : 'LLM/CLIP模型（必选）')
                    }
                  >
                    <Dropdown
                      placeholder={
                        groupTaskType === 'video'
                          ? (editingGroup ? '请选择文本编码器 / T5 模型（可选）' : '请选择文本编码器 / T5 模型（必选）')
                          : (editingGroup ? '请选择LLM/CLIP模型（可选）' : '请选择LLM/CLIP模型（必选）')
                      }
                      value={getModelFileName(groupLlmModel)}
                      selectedOptions={[groupLlmModel]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setGroupLlmModel(data.optionValue);
                        } else {
                          setGroupLlmModel('');
                        }
                      }}
                    >
                      {editingGroup && <Option value="" text="无">无</Option>}
                      {files.filter(file => {
                        // 当前已选择的LLM模型可以显示（如果正在编辑）
                        if (file.path === groupLlmModel) return true;
                        // 过滤掉已被SD或VAE选择的模型
                        return file.path !== groupSdModel && file.path !== groupVaeModel;
                      }).map((file) => (
                        <Option key={file.path} value={file.path} text={file.name}>
                          {file.name}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                )}
                <Title2 style={{ fontSize: tokens.fontSizeBase400, marginTop: tokens.spacingVerticalM }}>
                  推荐默认设置（可选）
                </Title2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacingHorizontalM }}>
                <Field label={groupTaskType === 'video' ? '采样步数（主路径）' : '采样步数'} hint="默认: 20">
                    <Input
                      type="number"
                      value={groupDefaultSteps}
                      onChange={(_, data) => {
                        const val = parseInt(data.value) || 20;
                        setGroupDefaultSteps(Math.max(1, Math.min(100, val)).toString());
                      }}
                      min={1}
                      max={100}
                    />
                  </Field>
                  <Field label="CFG Scale" hint="默认: 7.0">
                    <Input
                      type="number"
                      value={groupDefaultCfgScale}
                      onChange={(_, data) => {
                        const val = parseFloat(data.value) || 7.0;
                        setGroupDefaultCfgScale(Math.max(0.1, Math.min(30, val)).toString());
                      }}
                      min={0.1}
                      max={30}
                      step={0.1}
                    />
                  </Field>
                  <Field label="图片宽度" hint="默认: 512">
                    <Input
                      type="number"
                      value={groupDefaultWidth}
                      onChange={(_, data) => {
                        // 允许用户自由输入，不立即限制
                        setGroupDefaultWidth(data.value);
                      }}
                      onBlur={() => {
                        const val = parseInt(groupDefaultWidth);
                        if (isNaN(val) || val < 64) {
                          // 无效值或小于最小值，重置为默认值
                          setGroupDefaultWidth('512');
                        } else if (val > 2048) {
                          // 超过最大值，设置为最大值
                          setGroupDefaultWidth('2048');
                        } else {
                          // 对齐到64的倍数
                          const aligned = Math.round(val / 64) * 64;
                          setGroupDefaultWidth(aligned.toString());
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
                      value={groupDefaultHeight}
                      onChange={(_, data) => {
                        // 允许用户自由输入，不立即限制
                        setGroupDefaultHeight(data.value);
                      }}
                      onBlur={() => {
                        const val = parseInt(groupDefaultHeight);
                        if (isNaN(val) || val < 64) {
                          // 无效值或小于最小值，重置为默认值
                          setGroupDefaultHeight('512');
                        } else if (val > 2048) {
                          // 超过最大值，设置为最大值
                          setGroupDefaultHeight('2048');
                        } else {
                          // 对齐到64的倍数
                          const aligned = Math.round(val / 64) * 64;
                          setGroupDefaultHeight(aligned.toString());
                        }
                      }}
                      min={64}
                      max={2048}
                      step={64}
                    />
                  </Field>
                  <Field label="采样方法" hint="默认: euler_a">
                    <Dropdown
                      value={groupDefaultSamplingMethod}
                      selectedOptions={[groupDefaultSamplingMethod]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setGroupDefaultSamplingMethod(data.optionValue);
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
                  {groupTaskType !== 'video' && (
                    <Field label="调度器" hint="默认: discrete">
                      <Dropdown
                        value={groupDefaultScheduler}
                        selectedOptions={[groupDefaultScheduler]}
                        onOptionSelect={(_, data) => {
                          if (data.optionValue) {
                            setGroupDefaultScheduler(data.optionValue);
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
                  )}
                  <Field label="种子" hint="留空表示随机">
                    <Input
                      type="number"
                      value={groupDefaultSeed}
                      placeholder="随机"
                      onChange={(_, data) => {
                        setGroupDefaultSeed(data.value);
                      }}
                      onBlur={() => {
                        const val = parseInt(groupDefaultSeed);
                        if (isNaN(val) || val < 0) {
                          setGroupDefaultSeed('');
                        }
                      }}
                      min={0}
                    />
                  </Field>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setGroupDialogOpen(false);
                  setEditingGroup(null);
                }}
              >
                取消
              </Button>
              <Button
                appearance="primary"
                onClick={handleSaveGroup}
                disabled={
                  loading || 
                  !groupName.trim() || 
                  (!editingGroup && (
                    !groupSdModel || !groupSdModel.trim() || 
                    !groupVaeModel || !groupVaeModel.trim() || 
                    (groupTaskType === 'edit' 
                      ? (!groupClipLModel || !groupClipLModel.trim() || !groupT5xxlModel || !groupT5xxlModel.trim())
                      : (!groupLlmModel || !groupLlmModel.trim())
                    )
                  ))
                }
              >
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

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

