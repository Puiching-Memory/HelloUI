import {
  Card,
  Title1,
  Title2,
  Body1,
  Button,
  makeStyles,
  tokens,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  SpinButton,
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
  AddRegular,
  EditRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  ImageAddRegular,
  EditRegular as EditIcon,
  VideoClipRegular,
  ZoomInRegular,
  GlobeRegular,
  CheckmarkCircleFilled,
  DismissCircleRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useIpcListener } from '../hooks/useIpcListener';
import { useAppStore } from '../hooks/useAppStore';
import { ipcInvoke } from '../lib/tauriIpc';
import { formatFileSize } from '@/utils/format';
import { getPathBaseName } from '@/utils/tauriPath';
import type { TaskType, ModelGroup, HfMirrorId, ModelDownloadProgress } from '../../shared/types'

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
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
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
  hfMirrorToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  hfMirrorBtn: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusSmall,
    cursor: 'pointer',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  hfMirrorBtnSelected: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  downloadProgressCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fileStatusList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacingVerticalXXS,
  },
  fileStatusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    padding: `${tokens.spacingVerticalXXS} 0`,
  },
});

export const ModelWeightsPage = () => {
  const styles = useStyles();
  const { setIsUploading } = useAppStore();
  const [weightsFolder, setWeightsFolder] = useState<string>('');
  const [weightsFolderInput, setWeightsFolderInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    progress: number;
    fileName: string;
    copied: number;
    total: number;
  } | null>(null);


  // 监听导入进度
  useIpcListener('model-groups:import-progress', (data) => {
    setImportProgress(data);
  });



  // HF 下载相关状态
  const [hfMirrorId, setHfMirrorId] = useState<HfMirrorId>('hf-mirror');
  const [modelDownloadProgress, setModelDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [downloadingGroupId, setDownloadingGroupId] = useState<string | null>(null);
  const [fileStatusMap, setFileStatusMap] = useState<Record<string, Array<{ file: string; exists: boolean; size?: number }>>>({});

  // 监听模型下载进度
  const loadModelGroupsRef = useRef<() => Promise<void>>(undefined);

  useIpcListener('models:download-progress', (data) => {
    setModelDownloadProgress(data);
    if (data.stage === 'done') {
      setTimeout(() => {
        setModelDownloadProgress(null);
        setDownloadingGroupId(null);
        // 刷新模型组文件状态
        loadModelGroupsRef.current?.();
      }, 1500);
    }
    if (data.stage === 'error') {
      setModelDownloadProgress(null);
      setDownloadingGroupId(null);
    }
  });

  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModelGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupHfRepo, setGroupHfRepo] = useState<string>('');
  const [groupSdModel, setGroupSdModel] = useState<string>('');
  const [groupDiffusionModel, setGroupDiffusionModel] = useState<string>('');
  const [groupHighNoiseSdModel, setGroupHighNoiseSdModel] = useState<string>('');
  const [groupVaeModel, setGroupVaeModel] = useState<string>('');
  const [groupLlmModel, setGroupLlmModel] = useState<string>('');
  const [groupClipLModel, setGroupClipLModel] = useState<string>('');
  const [groupT5xxlModel, setGroupT5xxlModel] = useState<string>('');
  const [groupClipVisionModel, setGroupClipVisionModel] = useState<string>('');
  const [groupDefaultSteps, setGroupDefaultSteps] = useState<number>(20);
  const [groupDefaultCfgScale, setGroupDefaultCfgScale] = useState<number>(7.0);
  const [groupDefaultWidth, setGroupDefaultWidth] = useState<number>(512);
  const [groupDefaultHeight, setGroupDefaultHeight] = useState<number>(512);
  const [groupDefaultSamplingMethod, setGroupDefaultSamplingMethod] = useState<string>('euler_a');
  const [groupDefaultScheduler, setGroupDefaultScheduler] = useState<string>('discrete');
  const [groupDefaultSeed, setGroupDefaultSeed] = useState<number>(-1);
  const [groupDefaultFlowShift, setGroupDefaultFlowShift] = useState<number>(3.0);
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

  // 加载模型组列表
  useEffect(() => {
    loadModelGroups().catch(console.error);
  }, []);

  const loadWeightsFolder = async () => {
    let folder = await ipcInvoke('weights:get-folder');
    
    if (!folder) {
      folder = await ipcInvoke('weights:init-default-folder');
      await ipcInvoke('weights:set-folder', folder);
    }
    
    if (folder) {
      setWeightsFolder(folder);
      setWeightsFolderInput(folder);
    }
  };

  const handleSetFolder = async () => {
    const nextFolder = weightsFolderInput.trim();

    if (!nextFolder) {
      if (!nextFolder) {
        setMessageDialogContent({ title: '提示', message: '请输入有效的文件夹路径' });
        setMessageDialogOpen(true);
      }
      return;
    }
    
    const exists = await ipcInvoke('weights:check-folder', nextFolder);
    if (!exists) {
      setMessageDialogContent({ title: '错误', message: '文件夹不存在，请检查路径是否正确' });
      setMessageDialogOpen(true);
      return;
    }
    
    const setResult = await ipcInvoke('weights:set-folder', nextFolder);
    if (!setResult) {
      setMessageDialogContent({ title: '错误', message: '设置文件夹路径失败，请重试' });
      setMessageDialogOpen(true);
      return;
    }

    setWeightsFolder(nextFolder);
    setWeightsFolderInput(nextFolder);

    // 重新加载模型组列表及其文件状态
    await loadModelGroups();
  };

  const handleFolderPathChange = (value: string) => {
    setWeightsFolderInput(value);
  };

  const handleUpload = async () => {
    if (!weightsFolder) return;
    try {
      const folderPath = await ipcInvoke('model-groups:select-folder');
      if (folderPath) {
        const folderName = getPathBaseName(folderPath, '模型组');
        setLoading(true);
        setImportProgress({ progress: 0, fileName: folderName, copied: 0, total: 0 });
        
        // 通知父组件开始上传，禁用导航
        setIsUploading(true);
        
        try {
          const result = await ipcInvoke('model-groups:import', { folderPath, targetFolder: weightsFolder });
          
          if (result?.success) {
            setImportProgress((prev) => prev ? { ...prev, progress: 100 } : null);
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



  const loadModelGroups = async () => {
    const groups = await ipcInvoke('model-groups:list');
    setModelGroups(groups || []);
  };

  const checkAllGroupFiles = async () => {
    const statusMap: Record<string, Array<{ file: string; exists: boolean; size?: number }>> = {};
    for (const group of modelGroups) {
      if (group.hfFiles && group.hfFiles.length > 0) {
        try {
          const result = await ipcInvoke('models:check-files', { groupId: group.id });
          statusMap[group.id] = result;
        } catch (error) {
          console.error(`Failed to check files for ${group.id}:`, error);
        }
      }
    }
    setFileStatusMap(statusMap);
  };

  // 保持 ref 始终最新
  useEffect(() => {
    loadModelGroupsRef.current = loadModelGroups;
  });

  // 初始化 HF 镜像
  useEffect(() => {
    ipcInvoke('models:get-hf-mirror').then((id: HfMirrorId) => {
      setHfMirrorId(id);
    }).catch(console.error);
  }, []);

  // 加载模型组时检查文件状态
  useEffect(() => {
    if (modelGroups.length > 0) {
      checkAllGroupFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelGroups]);

  const handleHfMirrorChange = useCallback(async (mirrorId: HfMirrorId) => {
    try {
      await ipcInvoke('models:set-hf-mirror', mirrorId);
      setHfMirrorId(mirrorId);
    } catch (error) {
      console.error('Failed to set HF mirror:', error);
    }
  }, []);

  const handleDownloadGroupFiles = useCallback(async (groupId: string) => {
    setDownloadingGroupId(groupId);
    setModelDownloadProgress({
      stage: 'downloading',
      downloadedBytes: 0,
      totalBytes: -1,
      speed: 0,
      fileName: '准备中...',
      totalFiles: 0,
      currentFileIndex: 0,
    });

    try {
      const result = await ipcInvoke('models:download-group-files', {
        groupId,
        mirrorId: hfMirrorId,
      });
      if (!result.success) {
        setMessageDialogContent({ title: '下载失败', message: result.error || '下载失败' });
        setMessageDialogOpen(true);
        setModelDownloadProgress(null);
        setDownloadingGroupId(null);
      }
    } catch (error) {
      setMessageDialogContent({ title: '下载失败', message: (error as Error)?.message || '下载失败' });
      setMessageDialogOpen(true);
      setModelDownloadProgress(null);
      setDownloadingGroupId(null);
    }
  }, [hfMirrorId]);

  const handleCancelModelDownload = useCallback(async () => {
    try {
      await ipcInvoke('models:cancel-download');
      setModelDownloadProgress(null);
      setDownloadingGroupId(null);
    } catch (error) {
      console.error('Failed to cancel download:', error);
    }
  }, []);

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupHfRepo('');
    setGroupSdModel('');
    setGroupDiffusionModel('');
    setGroupHighNoiseSdModel('');
    setGroupVaeModel('');
    setGroupLlmModel('');
    setGroupClipLModel('');
    setGroupT5xxlModel('');
    setGroupClipVisionModel('');
    setGroupDefaultSteps(20);
    setGroupDefaultCfgScale(7.0);
    setGroupDefaultWidth(512);
    setGroupDefaultHeight(512);
    setGroupDefaultSamplingMethod('euler_a');
    setGroupDefaultScheduler('discrete');
    setGroupDefaultSeed(-1);
    setGroupDefaultFlowShift(3.0);
    setGroupTaskType('generate');
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: ModelGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    // 从 hfFiles 中提取 repo（取第一个 entry 的 repo 作为默认）
    const defaultRepo = group.hfFiles?.[0]?.repo || '';
    setGroupHfRepo(defaultRepo);
    // 从 hfFiles 中查找对应模型的文件名，若无则从 model path 中提取文件名
    const findHfFile = (modelPath?: string) => {
      if (!modelPath) return '';
      const fileName = getPathBaseName(modelPath, modelPath);
      const hfEntry = group.hfFiles?.find(f => f.file === fileName || f.savePath === fileName);
      return hfEntry?.file || fileName;
    };
    setGroupSdModel(findHfFile(group.sdModel));
    setGroupDiffusionModel(findHfFile(group.diffusionModel));
    setGroupHighNoiseSdModel(findHfFile(group.highNoiseSdModel));
    setGroupVaeModel(findHfFile(group.vaeModel));
    setGroupLlmModel(findHfFile(group.llmModel));
    setGroupClipLModel(findHfFile(group.clipLModel));
    setGroupT5xxlModel(findHfFile(group.t5xxlModel));
    setGroupClipVisionModel(findHfFile(group.clipVisionModel));
    setGroupDefaultSteps(group.defaultSteps ?? 20);
    setGroupDefaultCfgScale(group.defaultCfgScale ?? 7.0);
    setGroupDefaultWidth(group.defaultWidth ?? 512);
    setGroupDefaultHeight(group.defaultHeight ?? 512);
    setGroupDefaultSamplingMethod(group.defaultSamplingMethod || 'euler_a');
    setGroupDefaultScheduler(group.defaultScheduler || 'discrete');
    setGroupDefaultSeed(group.defaultSeed ?? -1);
    setGroupDefaultFlowShift(group.defaultFlowShift ?? 3.0);
    setGroupTaskType(group.taskType || 'generate');
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      setMessageDialogContent({ title: '提示', message: '请输入组名称' });
      setMessageDialogOpen(true);
      return;
    }

    // 创建新模型组时，必须填写 HF 仓库和必需的模型文件名
    if (!editingGroup) {
      if (!groupHfRepo || !groupHfRepo.trim()) {
        setMessageDialogContent({ title: '提示', message: '请填写 HuggingFace 仓库 ID（如 leejet/Z-Image-GGUF）' });
        setMessageDialogOpen(true);
        return;
      }
      if ((!groupSdModel || !groupSdModel.trim()) && (!groupDiffusionModel || !groupDiffusionModel.trim())) {
        setMessageDialogContent({ title: '提示', message: '请填写 SD 模型或扩散模型文件名' });
        setMessageDialogOpen(true);
        return;
      }
      if (!groupVaeModel || !groupVaeModel.trim()) {
        setMessageDialogContent({ title: '提示', message: '请填写 VAE 模型文件名' });
        setMessageDialogOpen(true);
        return;
      }
      if (!groupLlmModel || !groupLlmModel.trim()) {
        setMessageDialogContent({ 
          title: '提示', 
          message: groupTaskType === 'edit' 
            ? '请填写 LLM 模型文件名 (Qwen 2511)' 
            : '请填写 LLM/CLIP 模型文件名' 
        });
        setMessageDialogOpen(true);
        return;
      }
    }

    // 构建 hfFiles 数组和模型相对路径
    const repo = groupHfRepo.trim();
    const folderName = groupName.trim();
    const buildModelPath = (fileName: string) => fileName ? `${folderName}/${fileName}` : undefined;
    const hfFiles: { repo: string; file: string }[] = [];
    const addHfFile = (fileName: string) => {
      if (fileName && repo) {
        if (!hfFiles.some(f => f.repo === repo && f.file === fileName)) {
          hfFiles.push({ repo, file: fileName });
        }
      }
    };

    const sdFile = groupSdModel.trim();
    const diffusionFile = groupDiffusionModel.trim();
    const highNoiseSdFile = groupHighNoiseSdModel.trim();
    const vaeFile = groupVaeModel.trim();
    const llmFile = groupLlmModel.trim();
    const clipLFile = groupClipLModel.trim();
    const t5xxlFile = groupT5xxlModel.trim();
    const clipVisionFile = groupClipVisionModel.trim();

    addHfFile(sdFile);
    addHfFile(diffusionFile);
    addHfFile(highNoiseSdFile);
    addHfFile(vaeFile);
    addHfFile(llmFile);
    addHfFile(clipLFile);
    addHfFile(t5xxlFile);
    addHfFile(clipVisionFile);

    setLoading(true);
    try {
      const groupData = {
        name: folderName,
        taskType: groupTaskType,
        sdModel: buildModelPath(sdFile),
        diffusionModel: buildModelPath(diffusionFile),
        highNoiseSdModel: buildModelPath(highNoiseSdFile),
        vaeModel: buildModelPath(vaeFile),
        llmModel: buildModelPath(llmFile),
        clipLModel: buildModelPath(clipLFile),
        t5xxlModel: buildModelPath(t5xxlFile),
        clipVisionModel: buildModelPath(clipVisionFile),
        hfFiles: hfFiles.length > 0 ? hfFiles : undefined,
        defaultSteps: groupDefaultSteps,
        defaultCfgScale: groupDefaultCfgScale,
        defaultWidth: groupDefaultWidth,
        defaultHeight: groupDefaultHeight,
        defaultSamplingMethod: groupDefaultSamplingMethod || undefined,
        defaultScheduler: groupDefaultScheduler || undefined,
        defaultSeed: groupDefaultSeed >= 0 ? groupDefaultSeed : undefined,
        defaultFlowShift: groupDefaultFlowShift,
      };

      if (editingGroup) {
        await ipcInvoke('model-groups:update', {
          id: editingGroup.id,
          updates: groupData,
        });
      } else {
        await ipcInvoke('model-groups:create', groupData);
      }
      await loadModelGroups();
      setGroupDialogOpen(false);
      if (!editingGroup) {
        setMessageDialogContent({ 
          title: '创建成功', 
          message: `模型组 "${folderName}" 已创建。\n\n请在模型组卡片上点击"下载"按钮来获取模型文件。` 
        });
        setMessageDialogOpen(true);
      }
      setEditingGroup(null);
    } catch (error) {
      console.error('Failed to save group:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '保存失败', message: `保存模型组失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    } finally {
      setLoading(false);
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
      await ipcInvoke('model-groups:delete', { id: groupToDelete.id, deleteFiles });
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
    return getPathBaseName(path, path);
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
              value={weightsFolderInput}
              onChange={(_, data) => handleFolderPathChange(data.value)}
              placeholder="默认使用应用数据目录下的 models 文件夹"
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
            disabled={!weightsFolderInput.trim() || loading || weightsFolderInput.trim() === weightsFolder}
          >
            应用路径
          </Button>
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

      {/* HF 下载源切换 */}
      <Card className={styles.section}>
        <Title2>模型下载源</Title2>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
          模型权重托管在 HuggingFace 上，中国大陆用户推荐使用 HF-Mirror 镜像加速下载。
        </Body1>
        <div className={styles.hfMirrorToggle}>
          <GlobeRegular />
          <div
            className={`${styles.hfMirrorBtn} ${hfMirrorId === 'huggingface' ? styles.hfMirrorBtnSelected : ''}`}
            onClick={() => handleHfMirrorChange('huggingface')}
          >
            HuggingFace (官方)
          </div>
          <div
            className={`${styles.hfMirrorBtn} ${hfMirrorId === 'hf-mirror' ? styles.hfMirrorBtnSelected : ''}`}
            onClick={() => handleHfMirrorChange('hf-mirror')}
          >
            HF-Mirror (中国镜像)
          </div>
        </div>

        {/* 下载进度 */}
        {modelDownloadProgress && modelDownloadProgress.stage === 'downloading' && (
          <div className={styles.downloadProgressCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>
                正在下载 ({modelDownloadProgress.currentFileIndex}/{modelDownloadProgress.totalFiles}): {modelDownloadProgress.fileName}
              </Body1>
              <Button
                appearance="subtle"
                size="small"
                icon={<DismissRegular />}
                onClick={handleCancelModelDownload}
              >
                取消
              </Button>
            </div>
            <ProgressBar
              value={modelDownloadProgress.totalBytes > 0 ? modelDownloadProgress.downloadedBytes / modelDownloadProgress.totalBytes : undefined}
              max={1}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                {modelDownloadProgress.totalBytes > 0
                  ? `${formatFileSize(modelDownloadProgress.downloadedBytes)} / ${formatFileSize(modelDownloadProgress.totalBytes)}`
                  : formatFileSize(modelDownloadProgress.downloadedBytes)}
              </Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                {modelDownloadProgress.speed > 0 ? `${formatFileSize(modelDownloadProgress.speed)}/s` : ''}
              </Body1>
            </div>
          </div>
        )}

        {modelDownloadProgress && modelDownloadProgress.stage === 'done' && (
          <div className={styles.downloadProgressCard}>
            <Body1 style={{ fontWeight: tokens.fontWeightSemibold, color: tokens.colorPaletteGreenForeground1 }}>
              下载完成！
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
            disabled={loading || !weightsFolder}
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
                    {group.diffusionModel && (
                      <div className={styles.modelItem}>
                        <span className={styles.modelLabel}>扩散模型</span>
                        <Tooltip content={getModelFileName(group.diffusionModel)} relationship="label">
                          <span className={styles.modelValue} title={getModelFileName(group.diffusionModel)}>
                            {getModelFileName(group.diffusionModel)}
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

                  {/* HF 文件下载区域 */}
                  {group.hfFiles && group.hfFiles.length > 0 && (
                    <div style={{ 
                      marginTop: tokens.spacingVerticalS,
                      paddingTop: tokens.spacingVerticalS,
                      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: tokens.spacingVerticalXS,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Body1 style={{ fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase200 }}>
                          模型文件 ({group.hfFiles.length} 个)
                        </Body1>
                        {downloadingGroupId === group.id ? (
                          <Button
                            icon={<DismissRegular />}
                            size="small"
                            appearance="secondary"
                            onClick={handleCancelModelDownload}
                          >
                            取消下载
                          </Button>
                        ) : (
                          <Button
                            icon={<ArrowDownloadRegular />}
                            size="small"
                            appearance="primary"
                            onClick={() => handleDownloadGroupFiles(group.id)}
                            disabled={!!downloadingGroupId || loading}
                          >
                            {fileStatusMap[group.id]?.every(f => f.exists) ? '全部已下载' : '下载缺失文件'}
                          </Button>
                        )}
                      </div>
                      <div className={styles.fileStatusList}>
                        {group.hfFiles.map((hfFile) => {
                          const status = fileStatusMap[group.id]?.find(
                            s => s.file === (hfFile.savePath || hfFile.file)
                          );
                          return (
                            <div key={hfFile.file} className={styles.fileStatusItem}>
                              {status?.exists ? (
                                <CheckmarkCircleFilled style={{ color: tokens.colorPaletteGreenForeground1, fontSize: '14px' }} />
                              ) : (
                                <DismissCircleRegular style={{ color: tokens.colorNeutralForeground3, fontSize: '14px' }} />
                              )}
                              <span style={{ 
                                color: status?.exists ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}>
                                {hfFile.savePath || hfFile.file}
                              </span>
                              {status?.exists && status.size !== undefined && (
                                <span style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>
                                  {formatFileSize(status.size)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* 模型组编辑对话框 */}
      <Dialog open={groupDialogOpen} onOpenChange={(_, data) => {
        setGroupDialogOpen(data.open);
        if (!data.open) {
          setEditingGroup(null);
          setGroupName('');
          setGroupHfRepo('');
          setGroupSdModel('');
          setGroupDiffusionModel('');
          setGroupVaeModel('');
          setGroupLlmModel('');
          setGroupClipLModel('');
          setGroupT5xxlModel('');
          setGroupDefaultSteps(20);
          setGroupDefaultCfgScale(7.0);
          setGroupDefaultWidth(512);
          setGroupDefaultHeight(512);
          setGroupDefaultSamplingMethod('euler_a');
          setGroupDefaultScheduler('discrete');
          setGroupDefaultSeed(-1);
          setGroupDefaultFlowShift(3.0);
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
                <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                  {editingGroup 
                    ? '修改模型组的配置信息。' 
                    : '填写 HuggingFace 仓库信息和模型文件名，创建后可通过下载按钮获取模型文件。'}
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
                <Field label="HuggingFace 仓库 ID" required hint="例如 leejet/Z-Image-GGUF">
                  <Input
                    value={groupHfRepo}
                    onChange={(_, data) => setGroupHfRepo(data.value)}
                    placeholder="owner/repo"
                  />
                </Field>
                <Field
                  label={groupTaskType === 'video' ? '基础视频模型文件名（LowNoise）' : 'SD模型文件名'}
                  hint={groupTaskType === 'video' ? '例如 Wan2.2-TI2V-5B-Q4_K_M.gguf' : '完整SD模型（与扩散模型二选一）'}
                >
                  <Input
                    value={groupSdModel}
                    onChange={(_, data) => setGroupSdModel(data.value)}
                    placeholder={groupTaskType === 'video' ? '基础视频模型文件名' : 'SD模型文件名'}
                  />
                </Field>
                {groupTaskType !== 'video' && (
                  <Field
                    label="独立扩散模型文件名"
                    hint="例如 z_image_turbo-Q4_K.gguf（与SD模型二选一，使用 --diffusion-model）"
                  >
                    <Input
                      value={groupDiffusionModel}
                      onChange={(_, data) => setGroupDiffusionModel(data.value)}
                      placeholder="独立扩散模型文件名（可选）"
                    />
                  </Field>
                )}
                {groupTaskType === 'video' && (
                  <Field
                    label="高噪声视频模型文件名（可选，HighNoise）"
                    hint="例如 Wan2.2-T2V-HighNoise-*.gguf"
                  >
                    <Input
                      value={groupHighNoiseSdModel}
                      onChange={(_, data) => setGroupHighNoiseSdModel(data.value)}
                      placeholder="高噪声视频模型文件名（可选）"
                    />
                  </Field>
                )}
                <Field label={editingGroup ? "VAE模型文件名（可选）" : "VAE模型文件名（必填）"}>
                  <Input
                    value={groupVaeModel}
                    onChange={(_, data) => setGroupVaeModel(data.value)}
                    placeholder="例如 wan2.2_vae.safetensors"
                  />
                </Field>
                <Field
                  label={
                    groupTaskType === 'edit'
                      ? (editingGroup ? 'LLM模型文件名（可选）' : 'LLM模型文件名（必填）')
                      : groupTaskType === 'video'
                        ? (editingGroup ? '文本编码器 / T5 模型文件名（可选）' : '文本编码器 / T5 模型文件名（必填）')
                        : (editingGroup ? 'LLM/CLIP模型文件名（可选）' : 'LLM/CLIP模型文件名（必填）')
                  }
                >
                  <Input
                    value={groupLlmModel}
                    onChange={(_, data) => setGroupLlmModel(data.value)}
                    placeholder={
                      groupTaskType === 'video'
                        ? '例如 umt5-xxl-encoder-q4_k_m.gguf'
                        : '例如 Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
                    }
                  />
                </Field>
                {groupTaskType === 'video' && (
                  <Field label="CLIP Vision 模型文件名（可选，I2V/FLF2V用）">
                    <Input
                      value={groupClipVisionModel}
                      onChange={(_, data) => setGroupClipVisionModel(data.value)}
                      placeholder="CLIP Vision 模型文件名（可选）"
                    />
                  </Field>
                )}
                <Title2 style={{ fontSize: tokens.fontSizeBase400, marginTop: tokens.spacingVerticalM }}>
                  推荐默认设置（可选）
                </Title2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacingHorizontalM }}>
                  <Field label={groupTaskType === 'video' ? '采样步数' : '采样步数'} hint="默认: 20">
                    <SpinButton
                      value={groupDefaultSteps}
                      onChange={(_, data) => setGroupDefaultSteps(data.value ?? 20)}
                      min={1}
                      max={100}
                      step={1}
                    />
                  </Field>
                  <Field label={groupTaskType === 'video' ? 'CFG Scale' : 'CFG Scale'} hint="默认: 7.0">
                    <SpinButton
                      value={groupDefaultCfgScale}
                      onChange={(_, data) => setGroupDefaultCfgScale(data.value ?? 7.0)}
                      min={0.1}
                      max={30}
                      step={0.1}
                    />
                  </Field>
                  {(groupTaskType === 'video' || groupTaskType === 'edit') && (
                    <Field label="Flow Shift" hint={groupTaskType === 'video' ? "Wan2.2 默认: 3.0" : "Qwen 2511 默认: 3.0"}>
                      <SpinButton
                        value={groupDefaultFlowShift}
                        onChange={(_, data) => setGroupDefaultFlowShift(data.value ?? 3.0)}
                        step={0.1}
                      />
                    </Field>
                  )}
                  <Field label={groupTaskType === 'video' ? '视频宽度' : '图片宽度'} hint="默认: 512，自动对齐到 16 的倍数">
                    <SpinButton
                      value={groupDefaultWidth}
                      onChange={(_, data) => {
                        const val = data.value ?? 512;
                        const aligned = Math.round(val / 16) * 16;
                        const clamped = Math.max(16, Math.min(2048, aligned));
                        setGroupDefaultWidth(clamped);
                      }}
                      min={16}
                      max={2048}
                      step={16}
                    />
                  </Field>
                  <Field label={groupTaskType === 'video' ? '视频高度' : '图片高度'} hint="默认: 512，自动对齐到 16 的倍数">
                    <SpinButton
                      value={groupDefaultHeight}
                      onChange={(_, data) => {
                        const val = data.value ?? 512;
                        const aligned = Math.round(val / 16) * 16;
                        const clamped = Math.max(16, Math.min(2048, aligned));
                        setGroupDefaultHeight(clamped);
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
                  <Field label="种子" hint="-1 表示随机">
                    <SpinButton
                      value={groupDefaultSeed}
                      onChange={(_, data) => setGroupDefaultSeed(data.value ?? -1)}
                      min={-1}
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

              <div style={{ flex: 1 }} />

              <Button
                appearance="primary"
                onClick={handleSaveGroup}
                disabled={
                  loading || 
                  !groupName.trim() || 
                  (!editingGroup && (
                    !groupHfRepo || !groupHfRepo.trim() ||
                    !groupSdModel || !groupSdModel.trim() || 
                    !groupVaeModel || !groupVaeModel.trim() || 
                    (!groupLlmModel || !groupLlmModel.trim())
                  ))
                }
              >
                {editingGroup ? '保存' : '创建'}
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

