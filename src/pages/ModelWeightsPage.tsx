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
  Text,
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  DeleteRegular,
  AddRegular,
  EditRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  ImageAddRegular,
  EditRegular as EditIcon,
  VideoClipRegular,
  ZoomInRegular,
} from '@fluentui/react-icons';
import { useState, useEffect } from 'react';
import { useIpcListener } from '../hooks/useIpcListener';
import { useAppStore } from '../hooks/useAppStore';
import type { TaskType, ModelGroup, WeightFile } from '../../electron/types/index';

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
  modelGroupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  modelGroupCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.2s ease',
    ':hover': {
      border: `1px solid ${tokens.colorBrandStroke1}`,
      boxShadow: tokens.shadow4,
    },
  },
  modelGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  modelGroupTitle: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    flex: 1,
    minWidth: 0,
  },
  modelGroupActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  taskTypeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  modelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  modelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  modelLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    minWidth: '80px',
    flexShrink: 0,
  },
  modelValue: {
    flex: 1,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expandableSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  expandableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  expandableContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
  },
  paramGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingVerticalXS,
  },
  paramItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: tokens.fontSizeBase200,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
  },
  paramLabel: {
    color: tokens.colorNeutralForeground2,
  },
  paramValue: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

export const ModelWeightsPage = () => {
  const styles = useStyles();
  const { setIsUploading } = useAppStore();
  const [weightsFolder, setWeightsFolder] = useState<string>('');
  const [files, setFiles] = useState<WeightFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<WeightFile | null>(null);
  const [importProgress, setImportProgress] = useState<{
    progress: number;
    fileName: string;
    copied: number;
    total: number;
  } | null>(null);
  const [exportProgress, setExportProgress] = useState<{
    progress: number;
    fileName: string;
    copied: number;
    total: number;
  } | null>(null);

  // 监听导入进度
  useIpcListener('model-groups:import-progress', (data) => {
    setImportProgress(data);
  });

  // 监听导出进度
  useIpcListener('model-groups:export-progress', (data) => {
    setExportProgress(data);
  });

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
  const [groupClipVisionModel, setGroupClipVisionModel] = useState<string>('');
  const [groupDefaultSteps, setGroupDefaultSteps] = useState<string>('20');
  const [groupDefaultCfgScale, setGroupDefaultCfgScale] = useState<string>('7.0');
  const [groupDefaultWidth, setGroupDefaultWidth] = useState<string>('512');
  const [groupDefaultHeight, setGroupDefaultHeight] = useState<string>('512');
  const [groupDefaultSamplingMethod, setGroupDefaultSamplingMethod] = useState<string>('euler_a');
  const [groupDefaultScheduler, setGroupDefaultScheduler] = useState<string>('discrete');
  const [groupDefaultSeed, setGroupDefaultSeed] = useState<string>('');
  const [groupDefaultFlowShift, setGroupDefaultFlowShift] = useState<string>('3.0');
  const [groupTaskType, setGroupTaskType] = useState<TaskType>('generate');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogContent, setMessageDialogContent] = useState<{ title: string; message: string } | null>(null);
  const [groupDeleteConfirmOpen, setGroupDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ModelGroup | null>(null);

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
        setMessageDialogContent({ title: '提示', message: '请输入有效的文件夹路径' });
        setMessageDialogOpen(true);
      }
      return;
    }
    
    const exists = await window.ipcRenderer.invoke('weights:check-folder', weightsFolder.trim());
    if (!exists) {
      setMessageDialogContent({ title: '错误', message: '文件夹不存在，请检查路径是否正确' });
      setMessageDialogOpen(true);
      return;
    }
    
    await window.ipcRenderer.invoke('weights:set-folder', weightsFolder.trim());
    await loadFiles();
  };

  const handleFolderPathChange = (value: string) => {
    setWeightsFolder(value);
  };

  const handleUpload = async () => {
    if (!weightsFolder || !window.ipcRenderer) return;
    try {
      const folderPath = await window.ipcRenderer.invoke('model-groups:select-folder');
      if (folderPath) {
        const folderName = folderPath.split(/[/\\]/).pop() || '模型组';
        setLoading(true);
        setImportProgress({ progress: 0, fileName: folderName, copied: 0, total: 0 });
        
        // 通知父组件开始上传，禁用导航
        setIsUploading(true);
        
        try {
          const result = await window.ipcRenderer.invoke('model-groups:import', { folderPath, targetFolder: weightsFolder });
          
          if (result?.success) {
            setImportProgress((prev) => prev ? { ...prev, progress: 100 } : null);
            await loadFiles();
            await loadModelGroups();
            setMessageDialogContent({ title: '导入成功', message: `模型组 "${result.group?.name}" 已成功导入并注册。` });
            setMessageDialogOpen(true);
          } else {
            throw new Error(result?.message || '导入失败');
          }
        } finally {
          setLoading(false);
          setIsUploading(false);
          setTimeout(() => setImportProgress(null), 1000);
        }
      }
    } catch (error) {
      setImportProgress(null);
      setLoading(false);
      setIsUploading(false);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '导入失败', message: `导入模型组失败: ${errorMessage}` });
      setMessageDialogOpen(true);
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
    setGroupClipVisionModel('');
    setGroupDefaultSteps('20');
    setGroupDefaultCfgScale('7.0');
    setGroupDefaultWidth('512');
    setGroupDefaultHeight('512');
    setGroupDefaultSamplingMethod('euler_a');
    setGroupDefaultScheduler('discrete');
    setGroupDefaultSeed('');
    setGroupDefaultFlowShift('3.0');
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
    setGroupClipVisionModel(group.clipVisionModel || '');
    setGroupDefaultSteps(group.defaultSteps?.toString() || '20');
    setGroupDefaultCfgScale(group.defaultCfgScale?.toString() || '7.0');
    setGroupDefaultWidth(group.defaultWidth?.toString() || '512');
    setGroupDefaultHeight(group.defaultHeight?.toString() || '512');
    setGroupDefaultSamplingMethod(group.defaultSamplingMethod || 'euler_a');
    setGroupDefaultScheduler(group.defaultScheduler || 'discrete');
    setGroupDefaultSeed(group.defaultSeed !== undefined && group.defaultSeed >= 0 ? group.defaultSeed.toString() : '');
    setGroupDefaultFlowShift(group.defaultFlowShift?.toString() || '3.0');
    setGroupTaskType(group.taskType || 'generate');
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      setMessageDialogContent({ title: '提示', message: '请输入组名称' });
      setMessageDialogOpen(true);
      return;
    }

    // 创建新模型组时，必须所有必需的模型都选择了有效模型
    if (!editingGroup) {
      if (!groupSdModel || !groupSdModel.trim()) {
        setMessageDialogContent({ title: '提示', message: '创建新模型组时，必须选择SD模型' });
        setMessageDialogOpen(true);
        return;
      }
      if (!groupVaeModel || !groupVaeModel.trim()) {
        setMessageDialogContent({ title: '提示', message: '创建新模型组时，必须选择VAE模型' });
        setMessageDialogOpen(true);
        return;
      }
      if (!groupLlmModel || !groupLlmModel.trim()) {
        setMessageDialogContent({ 
          title: '提示', 
          message: groupTaskType === 'edit' 
            ? '创建图片编辑模型组时，必须选择 LLM 模型 (Qwen 2511)' 
            : '创建新模型组时，必须选择LLM/CLIP模型' 
        });
        setMessageDialogOpen(true);
        return;
      }
    }

    setLoading(true);
    try {
      if (editingGroup) {
        await window.ipcRenderer.invoke('model-groups:update', {
          id: editingGroup.id,
          updates: {
            name: groupName.trim(),
            taskType: groupTaskType,
            sdModel: groupSdModel || undefined,
            highNoiseSdModel: groupHighNoiseSdModel || undefined,
            vaeModel: groupVaeModel || undefined,
            llmModel: groupLlmModel || undefined,
            clipLModel: groupClipLModel || undefined,
            t5xxlModel: groupT5xxlModel || undefined,
            clipVisionModel: groupClipVisionModel || undefined,
            defaultSteps: groupDefaultSteps ? parseFloat(groupDefaultSteps) : undefined,
            defaultCfgScale: groupDefaultCfgScale ? parseFloat(groupDefaultCfgScale) : undefined,
            defaultWidth: groupDefaultWidth ? parseInt(groupDefaultWidth) : undefined,
            defaultHeight: groupDefaultHeight ? parseInt(groupDefaultHeight) : undefined,
            defaultSamplingMethod: groupDefaultSamplingMethod || undefined,
            defaultScheduler: groupDefaultScheduler || undefined,
            defaultSeed: groupDefaultSeed ? parseInt(groupDefaultSeed) : undefined,
            defaultFlowShift: groupDefaultFlowShift ? parseFloat(groupDefaultFlowShift) : undefined,
          }
        });
        await loadModelGroups();
        setGroupDialogOpen(false);
        setEditingGroup(null);
      } else {
        // 建立并导出模型组
        setExportProgress({ progress: 0, fileName: '准备中...', copied: 0, total: 0 });
        const result = await window.ipcRenderer.invoke('model-groups:build-and-export', {
          name: groupName.trim(),
          taskType: groupTaskType,
          sdModel: groupSdModel || undefined,
          highNoiseSdModel: groupHighNoiseSdModel || undefined,
          vaeModel: groupVaeModel || undefined,
          llmModel: groupLlmModel || undefined,
          clipLModel: groupClipLModel || undefined,
          t5xxlModel: groupT5xxlModel || undefined,
          clipVisionModel: groupClipVisionModel || undefined,
          defaultSteps: groupDefaultSteps ? parseFloat(groupDefaultSteps) : undefined,
          defaultCfgScale: groupDefaultCfgScale ? parseFloat(groupDefaultCfgScale) : undefined,
          defaultWidth: groupDefaultWidth ? parseInt(groupDefaultWidth) : undefined,
          defaultHeight: groupDefaultHeight ? parseInt(groupDefaultHeight) : undefined,
          defaultSamplingMethod: groupDefaultSamplingMethod || undefined,
          defaultScheduler: groupDefaultScheduler || undefined,
          defaultSeed: groupDefaultSeed ? parseInt(groupDefaultSeed) : undefined,
          defaultFlowShift: groupDefaultFlowShift ? parseFloat(groupDefaultFlowShift) : undefined,
        });

        if (result.success) {
          setExportProgress((prev) => prev ? { ...prev, progress: 100 } : null);
          setGroupDialogOpen(false);
          setMessageDialogContent({ 
            title: '导出成功', 
            message: `模型组已成功导出至: ${result.exportPath}\n\n您可以点击“导入模型组文件夹”将其安装到应用中。` 
          });
          setMessageDialogOpen(true);
        } else if (result.message !== '导出已取消') {
          throw new Error(result.message);
        }
      }
    } catch (error) {
      console.error('Failed to save group:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '保存失败', message: `保存模型组失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    } finally {
      setLoading(false);
      setTimeout(() => setExportProgress(null), 1000);
    }
  };

  const handleDeleteGroup = (group: ModelGroup) => {
    setGroupToDelete(group);
    setGroupDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteGroup = async (deleteFiles: boolean) => {
    if (!groupToDelete) return;

    setLoading(true);
    setGroupDeleteConfirmOpen(false);
    try {
      await window.ipcRenderer.invoke('model-groups:delete', { id: groupToDelete.id, deleteFiles });
      await loadModelGroups();
      setMessageDialogContent({ 
        title: '删除成功', 
        message: deleteFiles 
          ? `模型组 "${groupToDelete.name}" 及其物理文件已成功删除。` 
          : `模型组 "${groupToDelete.name}" 已从列表中移除（物理文件已保留）。` 
      });
      setMessageDialogOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '删除失败', message: `删除模型组失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    } finally {
      setLoading(false);
      setGroupToDelete(null);
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
            ? `使用文件夹: ${weightsFolder}。权重文件将自动扫描并显示在下方，可以导入模型组文件夹到此文件夹。支持格式：bin, safetensors, pt, pth, onnx, ckpt, gguf`
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
            导入模型组文件夹
          </Button>
          <Button
            onClick={loadFiles}
            disabled={!weightsFolder || loading}
          >
            刷新列表
          </Button>
        </div>
        {/* 导入进度条 */}
        {importProgress && (
          <div style={{ marginTop: tokens.spacingVerticalM }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalXS }}>
              <Body1>
                正在导入: {importProgress.fileName || '文件'} ({importProgress.progress}%)
              </Body1>
            </div>
            <ProgressBar value={importProgress.progress} max={100} />
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
              {formatFileSize(importProgress.copied)} / {formatFileSize(importProgress.total)}
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
            建立并导出模型组
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
          <div className={styles.modelGroupGrid}>
            {modelGroups.map((group) => {
              const getTaskTypeLabel = (taskType?: TaskType) => {
                switch (taskType) {
                  case 'generate':
                    return '图片生成';
                  case 'edit':
                    return '图片编辑';
                  case 'video':
                    return '视频生成';
                  case 'upscale':
                    return '图像超分辨率';
                  default:
                    return '未指定';
                }
              };

              const getTaskTypeIcon = (taskType?: TaskType) => {
                switch (taskType) {
                  case 'generate':
                    return <ImageAddRegular fontSize={16} />;
                  case 'edit':
                    return <EditIcon fontSize={16} />;
                  case 'video':
                    return <VideoClipRegular fontSize={16} />;
                  case 'upscale':
                    return <ZoomInRegular fontSize={16} />;
                  default:
                    return null;
                }
              };

              const isExpanded = expandedGroups.has(group.id);
              const toggleExpand = () => {
                const newExpanded = new Set(expandedGroups);
                if (isExpanded) {
                  newExpanded.delete(group.id);
                } else {
                  newExpanded.add(group.id);
                }
                setExpandedGroups(newExpanded);
              };

              return (
                <Card key={group.id} className={styles.modelGroupCard}>
                  <div className={styles.modelGroupHeader}>
                    <div className={styles.modelGroupTitle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, minWidth: 0 }}>
                        <Tooltip content={group.name} relationship="label">
                          <Title2 style={{ 
                            fontSize: tokens.fontSizeBase500, 
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flexShrink: 1
                          }}>
                            {group.name}
                          </Title2>
                        </Tooltip>
                        <span className={styles.taskTypeBadge}>
                          {getTaskTypeIcon(group.taskType)}
                          {getTaskTypeLabel(group.taskType)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.modelGroupActions}>
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
                  </div>

                  <div className={styles.modelList}>
                    {group.sdModel && (
                      <div className={styles.modelItem}>
                        <span className={styles.modelLabel}>SD模型</span>
                        <Tooltip content={getModelFileName(group.sdModel)} relationship="label">
                          <span className={styles.modelValue} title={getModelFileName(group.sdModel)}>
                            {getModelFileName(group.sdModel)}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                    {group.highNoiseSdModel && (
                      <div className={styles.modelItem}>
                        <span className={styles.modelLabel}>高噪声模型</span>
                        <Tooltip content={getModelFileName(group.highNoiseSdModel)} relationship="label">
                          <span className={styles.modelValue} title={getModelFileName(group.highNoiseSdModel)}>
                            {getModelFileName(group.highNoiseSdModel)}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                    {group.vaeModel && (
                      <div className={styles.modelItem}>
                        <span className={styles.modelLabel}>VAE模型</span>
                        <Tooltip content={getModelFileName(group.vaeModel)} relationship="label">
                          <span className={styles.modelValue} title={getModelFileName(group.vaeModel)}>
                            {getModelFileName(group.vaeModel)}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                    {group.taskType === 'edit' ? (
                      group.llmModel && (
                        <div className={styles.modelItem}>
                          <span className={styles.modelLabel}>LLM模型</span>
                          <Tooltip content={getModelFileName(group.llmModel)} relationship="label">
                            <span className={styles.modelValue} title={getModelFileName(group.llmModel)}>
                              {getModelFileName(group.llmModel)}
                            </span>
                          </Tooltip>
                        </div>
                      )
                    ) : (
                      group.llmModel && (
                        <div className={styles.modelItem}>
                          <span className={styles.modelLabel}>
                            {group.taskType === 'video' ? 'T5/文本编码器' : 'LLM/CLIP'}
                          </span>
                          <Tooltip content={getModelFileName(group.llmModel)} relationship="label">
                            <span className={styles.modelValue} title={getModelFileName(group.llmModel)}>
                              {getModelFileName(group.llmModel)}
                            </span>
                          </Tooltip>
                        </div>
                      )
                    )}
                    {group.taskType === 'video' && group.clipVisionModel && (
                      <div className={styles.modelItem}>
                        <span className={styles.modelLabel}>CLIP Vision</span>
                        <Tooltip content={getModelFileName(group.clipVisionModel)} relationship="label">
                          <span className={styles.modelValue} title={getModelFileName(group.clipVisionModel)}>
                            {getModelFileName(group.clipVisionModel)}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                  </div>

                  {(group.defaultSteps || group.defaultCfgScale || group.defaultWidth || group.defaultHeight || 
                    group.defaultSamplingMethod || group.defaultScheduler || group.defaultSeed ||
                    group.defaultHighNoiseSteps || group.defaultHighNoiseCfgScale || group.defaultHighNoiseSamplingMethod) && (
                    <div className={styles.expandableSection}>
                      <div className={styles.expandableHeader} onClick={toggleExpand}>
                        <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>
                          默认参数设置
                        </Body1>
                        {isExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
                      </div>
                      {isExpanded && (
                        <div className={styles.expandableContent}>
                          <div className={styles.paramGrid}>
                            {group.defaultSteps && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>
                                  {group.taskType === 'video' ? '采样步数 (主)' : '采样步数'}
                                </span>
                                <span className={styles.paramValue}>{group.defaultSteps}</span>
                              </div>
                            )}
                            {group.defaultCfgScale && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>
                                  {group.taskType === 'video' ? 'CFG Scale (主)' : 'CFG Scale'}
                                </span>
                                <span className={styles.paramValue}>{group.defaultCfgScale}</span>
                              </div>
                            )}
                            {group.taskType === 'video' && group.defaultHighNoiseSteps && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>采样步数 (高噪)</span>
                                <span className={styles.paramValue}>{group.defaultHighNoiseSteps}</span>
                              </div>
                            )}
                            {group.taskType === 'video' && group.defaultHighNoiseCfgScale && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>CFG Scale (高噪)</span>
                                <span className={styles.paramValue}>{group.defaultHighNoiseCfgScale}</span>
                              </div>
                            )}
                            {group.taskType === 'video' && group.defaultHighNoiseSamplingMethod && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>采样方法 (高噪)</span>
                                <span className={styles.paramValue}>{group.defaultHighNoiseSamplingMethod}</span>
                              </div>
                            )}
                            {group.defaultWidth && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>
                                  {group.taskType === 'video' ? '视频宽度' : '图片宽度'}
                                </span>
                                <span className={styles.paramValue}>{group.defaultWidth}px</span>
                              </div>
                            )}
                            {group.defaultHeight && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>
                                  {group.taskType === 'video' ? '视频高度' : '图片高度'}
                                </span>
                                <span className={styles.paramValue}>{group.defaultHeight}px</span>
                              </div>
                            )}
                            {group.defaultSamplingMethod && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>
                                  {group.taskType === 'video' ? '采样方法 (主)' : '采样方法'}
                                </span>
                                <span className={styles.paramValue}>{group.defaultSamplingMethod}</span>
                              </div>
                            )}
                            {group.defaultScheduler && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>调度器</span>
                                <span className={styles.paramValue}>{group.defaultScheduler}</span>
                              </div>
                            )}
                            {group.defaultSeed !== undefined && group.defaultSeed !== null && group.defaultSeed !== -1 && (
                              <div className={styles.paramItem}>
                                <span className={styles.paramLabel}>种子</span>
                                <span className={styles.paramValue}>{group.defaultSeed}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
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
          setGroupDefaultFlowShift('3.0');
        }
      }}>
        <DialogSurface style={{ minWidth: '600px' }}>
          <DialogTitle>{editingGroup ? '编辑模型组' : '建立并导出模型组'}</DialogTitle>
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
                <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                  {editingGroup 
                    ? '修改模型组的配置信息。' 
                    : '选择模型文件并配置参数，系统将为您生成模型组文件夹并导出。'}
                </Body1>
                <Field label="任务类型" hint="选择此模型组可用于哪些任务" required>
                  <Dropdown
                    value={
                      groupTaskType === 'generate' ? '图片生成' :
                      groupTaskType === 'edit' ? '图片编辑' :
                      groupTaskType === 'video' ? '视频生成' :
                      groupTaskType === 'upscale' ? '图像超分辨率' : ''
                    }
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
                    <Option value="upscale">图像超分辨率</Option>
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
                  <Field label={editingGroup ? "LLM模型（可选）" : "LLM模型（必选）"}>
                    <Dropdown
                      placeholder={editingGroup ? "请选择LLM模型（可选）" : "请选择LLM模型（必选）"}
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
                        if (file.path === groupLlmModel) return true;
                        return file.path !== groupSdModel && file.path !== groupVaeModel && 
                               file.path !== groupClipLModel && file.path !== groupT5xxlModel;
                      }).map((file) => (
                        <Option key={file.path} value={file.path} text={file.name}>
                          {file.name}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
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
                {groupTaskType === 'video' && (
                  <Field label="CLIP Vision 模型（可选，I2V/FLF2V用）">
                    <Dropdown
                      placeholder="请选择 CLIP Vision 模型（可选）"
                      value={getModelFileName(groupClipVisionModel)}
                      selectedOptions={[groupClipVisionModel]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setGroupClipVisionModel(data.optionValue);
                        } else {
                          setGroupClipVisionModel('');
                        }
                      }}
                    >
                      <Option value="" text="无">无</Option>
                      {files.filter(file => {
                        if (file.path === groupClipVisionModel) return true;
                        return file.path !== groupSdModel && file.path !== groupVaeModel && 
                               file.path !== groupLlmModel && file.path !== groupHighNoiseSdModel;
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
                  <Field label={groupTaskType === 'video' ? '采样步数' : '采样步数'} hint="默认: 20">
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
                  <Field label={groupTaskType === 'video' ? 'CFG Scale' : 'CFG Scale'} hint="默认: 7.0">
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
                  {(groupTaskType === 'video' || groupTaskType === 'edit') && (
                    <Field label="Flow Shift" hint={groupTaskType === 'video' ? "Wan2.2 默认: 3.0" : "Qwen 2511 默认: 3.0"}>
                      <Input
                        type="number"
                        value={groupDefaultFlowShift}
                        onChange={(_, data) => {
                          const val = parseFloat(data.value) || 3.0;
                          setGroupDefaultFlowShift(val.toString());
                        }}
                        step={0.1}
                      />
                    </Field>
                  )}
                  <Field label={groupTaskType === 'video' ? '视频宽度' : '图片宽度'} hint="默认: 512">
                    <Input
                      type="number"
                      value={groupDefaultWidth}
                      onChange={(_, data) => {
                        // 允许用户自由输入，不立即限制
                        setGroupDefaultWidth(data.value);
                      }}
                      onBlur={() => {
                        const val = parseInt(groupDefaultWidth);
                        if (isNaN(val) || val < 16) {
                          // 无效值或小于最小值，重置为默认值
                          setGroupDefaultWidth('512');
                        } else if (val > 2048) {
                          // 超过最大值，设置为最大值
                          setGroupDefaultWidth('2048');
                        } else {
                          // 对齐到16的倍数
                          const aligned = Math.round(val / 16) * 16;
                          setGroupDefaultWidth(aligned.toString());
                        }
                      }}
                      min={16}
                      max={2048}
                      step={16}
                    />
                  </Field>
                  <Field label={groupTaskType === 'video' ? '视频高度' : '图片高度'} hint="默认: 512">
                    <Input
                      type="number"
                      value={groupDefaultHeight}
                      onChange={(_, data) => {
                        // 允许用户自由输入，不立即限制
                        setGroupDefaultHeight(data.value);
                      }}
                      onBlur={() => {
                        const val = parseInt(groupDefaultHeight);
                        if (isNaN(val) || val < 16) {
                          // 无效值或小于最小值，重置为默认值
                          setGroupDefaultHeight('512');
                        } else if (val > 2048) {
                          // 超过最大值，设置为最大值
                          setGroupDefaultHeight('2048');
                        } else {
                          // 对齐到16的倍数
                          const aligned = Math.round(val / 16) * 16;
                          setGroupDefaultHeight(aligned.toString());
                        }
                      }}
                      min={16}
                      max={2048}
                      step={16}
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
            <DialogActions style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacingHorizontalM, width: '100%', boxSizing: 'border-box' }}>
              <Button
                appearance="secondary"
                onClick={() => {
                  setGroupDialogOpen(false);
                  setEditingGroup(null);
                }}
              >
                取消
              </Button>

              {exportProgress ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, padding: `0 ${tokens.spacingHorizontalS}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text size={100} truncate style={{ color: tokens.colorNeutralForeground3 }}>
                      正在导出: {exportProgress.fileName}
                    </Text>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap' }}>
                      {exportProgress.progress}%
                    </Text>
                  </div>
                  <ProgressBar value={exportProgress.progress} max={100} />
                </div>
              ) : (
                <div style={{ flex: 1 }} /> // 占位符，确保“保存”按钮始终在右侧
              )}

              <Button
                appearance="primary"
                onClick={handleSaveGroup}
                disabled={
                  loading || 
                  !groupName.trim() || 
                  (!editingGroup && (
                    !groupSdModel || !groupSdModel.trim() || 
                    !groupVaeModel || !groupVaeModel.trim() || 
                    (!groupLlmModel || !groupLlmModel.trim())
                  ))
                }
              >
                {editingGroup ? '保存' : '建立并导出'}
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

      {/* 模型组删除确认对话框 */}
      <Dialog open={groupDeleteConfirmOpen} onOpenChange={(_, data) => setGroupDeleteConfirmOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>删除模型组</DialogTitle>
          <DialogBody>
            <DialogContent>
              <Body1>
                确定要删除模型组 "{groupToDelete?.name}" 吗？
                <br /><br />
                您可以选择仅从列表中移除，或者同时删除磁盘上的模型文件。
              </Body1>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setGroupDeleteConfirmOpen(false);
                  setGroupToDelete(null);
                }}
              >
                取消
              </Button>
              <Button
                appearance="secondary"
                onClick={() => handleConfirmDeleteGroup(false)}
                disabled={loading}
              >
                仅从列表中移除
              </Button>
              <Button
                appearance="primary"
                onClick={() => handleConfirmDeleteGroup(true)}
                disabled={loading}
              >
                同时删除物理文件
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

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

