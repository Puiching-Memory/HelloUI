import {
  Card,
  Title1,
  Title2,
  Body1,
  Button,
  makeStyles,
  tokens,
  Spinner,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Checkbox,
  Badge,
  Text,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular,
  DeleteRegular,
  ImageRegular,
  ArrowSyncRegular,
  InfoRegular,
  DocumentRegular,
  CopyRegular,
  CheckmarkRegular,
  SplitHorizontalRegular,
  VideoClipRegular,
  EditRegular,
  ImageAddRegular,
  GridRegular,
  ListRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ipcInvoke } from '../lib/tauriIpc';
import type { GeneratedImage } from '../../shared/types';
import { formatFileSize } from '@/utils/format';
import { getPathBaseName, toMediaUrl } from '@/utils/tauriPath';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1600px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalM,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'border-box',
  },
  listItemSelected: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    outline: `2px solid ${tokens.colorBrandStroke1}`,
    outlineOffset: '-1px', // 让 outline 与 border 重叠，形成 2px 的视觉效果
    boxShadow: tokens.shadow8,
  },
  listItemThumbnail: {
    width: '120px',
    height: '120px',
    minWidth: '120px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listItemThumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  listItemContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  listItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  listItemMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  listItemActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  imageCard: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'border-box',
  },
  imageCardSelected: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    outline: `2px solid ${tokens.colorBrandStroke1}`,
    outlineOffset: '-1px', // 让 outline 与 border 重叠，形成 2px 的视觉效果
    boxShadow: tokens.shadow8,
  },
  imageCardCheckbox: {
    position: 'absolute',
    top: tokens.spacingVerticalS,
    left: tokens.spacingHorizontalS,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: tokens.borderRadiusSmall,
    padding: '4px',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1',
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: '48px',
  },
  imageCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
  },
  imageCardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  imageFileName: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  imagePrompt: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
    minHeight: '2.8em',
  },
  imageCardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  imageCardMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  imageCardMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  imageCardActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    opacity: 0,
    transition: 'opacity 0.2s ease',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXL,
    minHeight: '500px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  emptyStateIcon: {
    fontSize: '80px',
    marginBottom: tokens.spacingVerticalL,
    opacity: 0.4,
    color: tokens.colorNeutralForeground3,
  },
  emptyStateTitle: {
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase500,
  },
  emptyStateDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    maxWidth: '600px',
    lineHeight: 1.6,
  },
  previewDialog: {
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  previewImageContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    borderRadius: tokens.borderRadiusSmall,
    boxShadow: tokens.shadow16,
    userSelect: 'none',
    pointerEvents: 'auto',
    maxWidth: 'min(100%, 1200px)',
    maxHeight: 'min(75vh, 800px)',
  },
  compareDialog: {
    maxWidth: '95vw',
    maxHeight: '95vh',
    width: '90vw',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  compareDialogContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    maxHeight: 'calc(95vh - 120px)', // 减去 DialogTitle 和 DialogActions 的高度
    padding: 0,
    overflow: 'hidden',
  },
  compareDialogHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  compareImageNames: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  compareImageName: {
    flex: 1,
    textAlign: 'center',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  compareSliderContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalM,
    minHeight: 0,
    maxHeight: '100%',
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
  },
});

export const GeneratedImagesPage = () => {
  const styles = useStyles();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedImageForDetail, setSelectedImageForDetail] = useState<GeneratedImage | null>(null);
  const [detailVideoSrc, setDetailVideoSrc] = useState<string | null>(null);
  const [detailVideoLoading, setDetailVideoLoading] = useState(false);
  const [detailVideoError, setDetailVideoError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareImage1, setCompareImage1] = useState<GeneratedImage | null>(null);
  const [compareImage2, setCompareImage2] = useState<GeneratedImage | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogContent, setMessageDialogContent] = useState<{ title: string; message: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    // 从 localStorage 加载视图模式
    const saved = localStorage.getItem('generated-images-view-mode');
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });
  // 存储已加载的预览图（按需加载）
  const [loadedPreviews, setLoadedPreviews] = useState<Map<string, string>>(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());

  // 加载图片列表
  useEffect(() => {
    loadImages().catch(console.error);
  }, []);

  // 保存视图模式到 localStorage
  useEffect(() => {
    localStorage.setItem('generated-images-view-mode', viewMode);
  }, [viewMode]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const imageList = await ipcInvoke('generated-images:list');
      setImages(imageList || []);
      // 清空选择状态
      setSelectedImages(new Set());
      
      // 直接加载所有图片的预览图
      if (imageList && imageList.length > 0) {
        const imagePromises = imageList
          .filter((image: GeneratedImage) => image.mediaType !== 'video')
          .map((image: GeneratedImage) => loadPreview(image.path));
        // 并行加载所有预览图
        await Promise.all(imagePromises);
      }
    } catch (error) {
      console.error('Failed to load images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // 切换单个图片的选择状态（使用 useCallback 优化性能）
  const handleToggleSelect = useCallback((imagePath: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imagePath)) {
        newSet.delete(imagePath);
      } else {
        newSet.add(imagePath);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedImages(new Set(images.map(img => img.path)));
    } else {
      setSelectedImages(new Set());
    }
  };

  // 检查是否全选
  const isAllSelected = images.length > 0 && selectedImages.size === images.length;

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const success = await ipcInvoke('generated-images:download', image.path);
      if (success) {
        // 可以显示成功提示
        console.log('图片下载成功');
      }
    } catch (error) {
      console.error('Failed to download image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '下载失败', message: `下载图片失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    }
  };

  const handleDeleteClick = (image: GeneratedImage) => {
    setDeletingImage(image.path);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingImage) {
      return;
    }
    try {
      await ipcInvoke('generated-images:delete', deletingImage);
      // 从列表中移除
      setImages(prev => prev.filter(img => img.path !== deletingImage));
      // 从选择中移除
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(deletingImage);
        return newSet;
      });
      setDeleteDialogOpen(false);
      setDeletingImage(null);
    } catch (error) {
      console.error('Failed to delete image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '删除失败', message: `删除图片失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    }
  };

  // 批量下载（打包为 ZIP）
  const handleBatchDownload = async () => {
    if (selectedImages.size === 0) {
      return;
    }
    try {
      const selectedPaths = Array.from(selectedImages);
      const result = await ipcInvoke('generated-images:batch-download', selectedPaths);
      
      if (result.canceled) {
        // 用户取消了保存对话框
        return;
      }
      
      if (result.success) {
        const sizeInMB = result.size ? (result.size / (1024 * 1024)).toFixed(2) : '0';
        setMessageDialogContent({ title: '成功', message: `成功打包 ${selectedPaths.length} 张图片为 ZIP 文件\n文件大小: ${sizeInMB} MB` });
        setMessageDialogOpen(true);
      } else {
        throw new Error('打包失败');
      }
    } catch (error) {
      console.error('Failed to batch download images:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '批量下载失败', message: `批量下载失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    }
  };

  // 批量删除确认
  const handleBatchDeleteClick = () => {
    if (selectedImages.size === 0) {
      return;
    }
    setBatchDeleteDialogOpen(true);
  };

  // 批量删除确认
  const handleBatchDeleteConfirm = async () => {
    if (selectedImages.size === 0) {
      return;
    }
    try {
      const selectedPaths = Array.from(selectedImages);
      const successfullyDeleted = new Set<string>();
      let successCount = 0;
      let failCount = 0;

      for (const path of selectedPaths) {
        try {
          await ipcInvoke('generated-images:delete', path);
          successfullyDeleted.add(path);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete ${path}:`, error);
          failCount++;
        }
      }

      // 只从列表中移除成功删除的图片
      setImages(prev => prev.filter(img => !successfullyDeleted.has(img.path)));
      
      // 只从选择中移除成功删除的图片，保留失败的选择以便用户重试
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        successfullyDeleted.forEach(path => newSet.delete(path));
        return newSet;
      });
      
      setBatchDeleteDialogOpen(false);

      if (failCount === 0) {
        setMessageDialogContent({ title: '成功', message: `成功删除 ${successCount} 张图片` });
        setMessageDialogOpen(true);
      } else {
        setMessageDialogContent({ title: '删除完成', message: `删除完成：成功 ${successCount} 张，失败 ${failCount} 张。失败的图片仍保留在列表中。` });
        setMessageDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to batch delete images:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessageDialogContent({ title: '批量删除失败', message: `批量删除失败: ${errorMessage}` });
      setMessageDialogOpen(true);
    }
  };

  // 使用 useCallback 缓存函数，避免每次渲染都创建新函数
  const getImageMimeType = useCallback((filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: { [key: string]: string } = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
    };
    return mimeTypes[ext || ''] || 'image/png';
  }, []);


  // 使用 useCallback 缓存格式化函数


  const formatDate = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  const formatDuration = useCallback((durationMs?: number): string => {
    if (!durationMs) return '';
    const seconds = durationMs / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(0);
      return `${minutes}分${remainingSeconds}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = (seconds % 60).toFixed(0);
      return `${hours}小时${minutes}分${remainingSeconds}秒`;
    }
  }, []);

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // 打开对比弹窗
  const handleCompare = () => {
    if (selectedImages.size !== 2) {
      return;
    }
    const selectedPaths = Array.from(selectedImages);
    const image1 = images.find(img => img.path === selectedPaths[0]);
    const image2 = images.find(img => img.path === selectedPaths[1]);
    
    if (!image1 || !image2) {
      setMessageDialogContent({ title: '错误', message: '无法找到选中的图片' });
      setMessageDialogOpen(true);
      return;
    }

    setCompareImage1(image1);
    setCompareImage2(image2);
    setCompareDialogOpen(true);
    
    // 打开对比对话框时，自动加载预览图
    if (image1.mediaType !== 'video' && !loadedPreviews.has(image1.path) && !loadingPreviews.has(image1.path)) {
      loadPreview(image1.path);
    }
    if (image2.mediaType !== 'video' && !loadedPreviews.has(image2.path) && !loadingPreviews.has(image2.path)) {
      loadPreview(image2.path);
    }
  };

  // 获取类型标签和图标（使用 useCallback 缓存）
  const getTypeInfo = useCallback((image: GeneratedImage) => {
    const type = image.type || 'generate'
    const mediaType = image.mediaType || 'image'
    
    if (mediaType === 'video') {
      return {
        label: '视频生成',
        icon: <VideoClipRegular />,
        color: 'brand' as const,
      }
    }
    
    switch (type) {
      case 'edit':
        return {
          label: '图片编辑',
          icon: <EditRegular />,
          color: 'success' as const,
        }
      case 'video':
        return {
          label: '视频生成',
          icon: <VideoClipRegular />,
          color: 'brand' as const,
        }
      case 'generate':
      default:
        return {
          label: '图片生成',
          icon: <ImageAddRegular />,
          color: 'brand' as const,
        }
    }
  }, [])
  
  // 按需加载预览图
  const loadPreview = useCallback(async (imagePath: string) => {
    // 如果已经加载或正在加载，直接返回
    if (loadedPreviews.has(imagePath) || loadingPreviews.has(imagePath)) {
      return;
    }
    
    setLoadingPreviews(prev => new Set(prev).add(imagePath));
    
    try {
      const base64 = await ipcInvoke('generated-images:get-preview', imagePath);
      setLoadedPreviews(prev => {
        const newMap = new Map(prev);
        newMap.set(imagePath, base64);
        return newMap;
      });
    } catch (error) {
      console.error(`Failed to load preview for ${imagePath}:`, error);
    } finally {
      setLoadingPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(imagePath);
        return newSet;
      });
    }
  }, [loadedPreviews, loadingPreviews]);
  
  // 使用 useMemo 预处理图片数据，避免在渲染时重复计算
  const processedImages = useMemo(() => {
    return images.map((image) => {
      const isVideo = image.mediaType === 'video';
      const mimeType = getImageMimeType(image.name);
      // 使用按需加载的预览图（后端已返回完整 data URL）
      const previewDataUrl = loadedPreviews.get(image.path);
      const imageSrc = previewDataUrl || null;
      const hasImage = !!previewDataUrl && !isVideo;
      
      return {
        ...image,
        isVideo,
        mimeType,
        imageSrc,
        hasImage,
        typeInfo: getTypeInfo(image),
      };
    });
  }, [images, getTypeInfo, getImageMimeType, loadedPreviews]);

  return (
    <div className={styles.container}>
      <Title1>生成结果管理</Title1>

      <Card className={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalM }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
            <Title2 style={{ margin: 0 }}>结果列表</Title2>
            {images.length > 0 && (
              <Badge appearance="filled" color="brand">
                {images.length}
              </Badge>
            )}
            {selectedImages.size > 0 && (
              <Badge appearance="filled" color="success">
                已选择 {selectedImages.size}
              </Badge>
            )}
          </div>
          <div className={styles.headerActions}>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, alignItems: 'center' }}>
              <Button
                icon={<GridRegular />}
                appearance={viewMode === 'grid' ? 'primary' : 'subtle'}
                size="small"
                onClick={() => setViewMode('grid')}
                title="大图标视图"
              />
              <Button
                icon={<ListRegular />}
                appearance={viewMode === 'list' ? 'primary' : 'subtle'}
                size="small"
                onClick={() => setViewMode('list')}
                title="列表视图"
              />
            </div>
            {selectedImages.size > 0 && (
              <>
                {selectedImages.size === 2 && (
                  <Button
                    icon={<SplitHorizontalRegular />}
                    appearance="primary"
                    onClick={handleCompare}
                    disabled={loading}
                  >
                    对比
                  </Button>
                )}
                <Button
                  icon={<ArrowDownloadRegular />}
                  onClick={handleBatchDownload}
                  disabled={loading}
                >
                  批量下载
                </Button>
                <Button
                  icon={<DeleteRegular />}
                  appearance="secondary"
                  onClick={handleBatchDeleteClick}
                  disabled={loading}
                >
                  批量删除
                </Button>
              </>
            )}
            <Button
              icon={<ArrowSyncRegular />}
              onClick={loadImages}
              disabled={loading}
            >
              刷新
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
            <Spinner size="large" />
          </div>
        ) : images.length === 0 ? (
          <div className={styles.emptyState}>
            <ImageRegular className={styles.emptyStateIcon} />
            <Title2 className={styles.emptyStateTitle}>暂无生成结果</Title2>
            <Body1 className={styles.emptyStateDescription}>
              所有生成结果（图片生成、图片编辑、视频生成）将保存在运行路径下的 outputs 目录中
              <br />
              请在相应的页面生成内容后，它们将统一显示在这里
            </Body1>
          </div>
        ) : (
          <>
            {/* 全选控制 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: tokens.spacingHorizontalS,
              padding: `0 ${tokens.spacingVerticalM}`,
              marginBottom: tokens.spacingVerticalS 
            }}>
              <Checkbox
                checked={isAllSelected}
                onChange={(_, data) => handleSelectAll(data.checked === true)}
                label="全选"
              />
            </div>
            
            {/* 结果列表/网格 */}
            {viewMode === 'grid' ? (
              <div className={styles.gridContainer}>
                {processedImages.map((image) => {
                  const isSelected = selectedImages.has(image.path);
                  const { typeInfo, isVideo, imageSrc, hasImage } = image;
                  
                  return (
                    <div
                      key={image.path}
                      className={`${styles.imageCard} ${isSelected ? styles.imageCardSelected : ''}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        // 如果点击的是按钮、复选框或操作按钮区域，不触发选择
                        if (target.closest('button') || 
                            target.closest('input[type="checkbox"]') || 
                            target.closest(`.${styles.imageCardActions}`)) {
                          return;
                        }
                        // 使用事件委托，立即更新状态
                        e.stopPropagation();
                        handleToggleSelect(image.path);
                      }}
                    >
                      {/* 复选框 */}
                      <div className={styles.imageCardCheckbox} onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={(_, data) => {
                            // 直接使用 data.checked 状态，避免重复调用
                            if (data.checked === true) {
                              setSelectedImages(prev => {
                                const newSet = new Set(prev);
                                newSet.add(image.path);
                                return newSet;
                              });
                            } else {
                              setSelectedImages(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(image.path);
                                return newSet;
                              });
                            }
                          }}
                        />
                      </div>

                      {/* 类型标签 */}
                      <div style={{ 
                        position: 'absolute', 
                        top: tokens.spacingVerticalS, 
                        right: tokens.spacingHorizontalS,
                        zIndex: 10,
                      }}>
                        <Badge appearance="filled" color={typeInfo.color} icon={typeInfo.icon}>
                          {typeInfo.label}
                        </Badge>
                      </div>

                      {/* 预览区域 */}
                      <div className={styles.imagePreviewContainer}>
                        {isVideo ? (
                          <div className={styles.imagePlaceholder}>
                            <VideoClipRegular style={{ fontSize: '64px' }} />
                          </div>
                        ) : hasImage && imageSrc ? (
                          <>
                            <PhotoView src={imageSrc}>
                              <img
                                src={imageSrc}
                                alt={image.name}
                                className={styles.imagePreview}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const container = target.parentElement;
                                  if (container) {
                                    const placeholder = container.querySelector(`.${styles.imagePlaceholder}`);
                                    if (placeholder) {
                                      (placeholder as HTMLElement).style.display = 'flex';
                                    }
                                  }
                                }}
                              />
                            </PhotoView>
                            <div className={styles.imagePlaceholder} style={{ display: 'none' }}>
                              <ImageRegular />
                            </div>
                          </>
                        ) : loadingPreviews.has(image.path) ? (
                          <div className={styles.imagePlaceholder}>
                            <Spinner size="small" />
                          </div>
                        ) : (
                          <div className={styles.imagePlaceholder}>
                            <ImageRegular />
                          </div>
                        )}
                      </div>

                      {/* 卡片内容 */}
                      <div className={styles.imageCardContent}>
                        <div className={styles.imageCardHeader}>
                          <Body1 className={styles.imageFileName} title={image.name}>
                            {image.name}
                          </Body1>
                          {image.prompt && (
                            <Body1 className={styles.imagePrompt} title={image.prompt}>
                              {image.prompt}
                            </Body1>
                          )}
                        </div>

                        {/* 元信息 */}
                        <div className={styles.imageCardMeta}>
                          {/* 第一行：基本信息和分辨率 */}
                          <div className={styles.imageCardMetaRow}>
                            {!isVideo && image.width && image.height && (
                              <div className={styles.imageCardMetaItem}>
                                <DocumentRegular style={{ fontSize: '14px' }} />
                                <span>{image.width} × {image.height}</span>
                              </div>
                            )}
                            <div className={styles.imageCardMetaItem}>
                              <span>{formatFileSize(image.size)}</span>
                            </div>
                            {image.deviceType && (
                              <div className={styles.imageCardMetaItem}>
                                <span>{image.deviceType.toUpperCase()}</span>
                              </div>
                            )}
                            {image.duration && (
                              <div className={styles.imageCardMetaItem}>
                                <span>耗时: {formatDuration(image.duration)}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* 第二行：生成参数（仅图片生成和编辑显示） */}
                          {!isVideo && (image.steps || image.cfgScale || image.samplingMethod || image.scheduler) && (
                            <div className={styles.imageCardMetaRow}>
                              {image.steps && (
                                <div className={styles.imageCardMetaItem}>
                                  <span>步数: {image.steps}</span>
                                </div>
                              )}
                              {image.cfgScale && (
                                <div className={styles.imageCardMetaItem}>
                                  <span>CFG: {image.cfgScale}</span>
                                </div>
                              )}
                              {image.samplingMethod && (
                                <div className={styles.imageCardMetaItem}>
                                  <span>采样: {image.samplingMethod}</span>
                                </div>
                              )}
                              {image.scheduler && (
                                <div className={styles.imageCardMetaItem}>
                                  <span>调度: {image.scheduler}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 第三行：种子和批次（仅图片生成和编辑显示） */}
                          {!isVideo && ((image.seed !== null && image.seed !== undefined) || image.batchCount) ? (
                            <div className={styles.imageCardMetaRow}>
                              {image.seed !== null && image.seed !== undefined && (
                                <div className={styles.imageCardMetaItem}>
                                  <span>种子: {image.seed}</span>
                                </div>
                              )}
                              {image.batchCount && image.batchCount > 1 && (
                                <div className={styles.imageCardMetaItem}>
                                  <span>批次: {image.batchCount}</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {/* 操作按钮 */}
                        <div 
                          className={styles.imageCardActions} 
                          onClick={(e) => e.stopPropagation()}
                          style={{ opacity: 1 }}
                        >
                          <Button
                            icon={<InfoRegular />}
                            appearance="subtle"
                            size="small"
                            onClick={async () => {
                              setSelectedImageForDetail(image);
                              setDetailVideoSrc(null);
                              setDetailVideoError(null);
                              const mediaType = image.mediaType || 'image';
                              if (mediaType === 'video') {
                                // 使用 media:/// 协议直接加载本地视频
                                setDetailVideoSrc(toMediaUrl(image.path));
                              }
                              setDetailDialogOpen(true);
                            }}
                          >
                            详情
                          </Button>
                          <Button
                            icon={<ArrowDownloadRegular />}
                            appearance="subtle"
                            size="small"
                            onClick={() => handleDownload(image)}
                          >
                            下载
                          </Button>
                          <Button
                            icon={<DeleteRegular />}
                            appearance="subtle"
                            size="small"
                            onClick={() => handleDeleteClick(image)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.listContainer}>
                {processedImages.map((image) => {
                  const isSelected = selectedImages.has(image.path);
                  const { typeInfo, isVideo, imageSrc, hasImage } = image;
                  
                  return (
                    <div
                      key={image.path}
                      className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        // 如果点击的是按钮、复选框或操作按钮区域，不触发选择
                        if (target.closest('button') || 
                            target.closest('input[type="checkbox"]') || 
                            target.closest(`.${styles.imageCardActions}`)) {
                          return;
                        }
                        // 使用事件委托，立即更新状态
                        e.stopPropagation();
                        handleToggleSelect(image.path);
                      }}
                    >
                      {/* 复选框 */}
                      <Checkbox
                        checked={isSelected}
                        onChange={(_, data) => {
                          // 直接使用 data.checked 状态，避免重复调用，提升响应速度
                          if (data.checked === true) {
                            setSelectedImages(prev => {
                              const newSet = new Set(prev);
                              newSet.add(image.path);
                              return newSet;
                            });
                          } else {
                            setSelectedImages(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(image.path);
                              return newSet;
                            });
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* 缩略图 */}
                      <div className={styles.listItemThumbnail}>
                        {isVideo ? (
                          <VideoClipRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                        ) : hasImage && imageSrc ? (
                          <PhotoView src={imageSrc}>
                            <img
                              src={imageSrc}
                              alt={image.name}
                              className={styles.listItemThumbnailImage}
                            />
                          </PhotoView>
                        ) : loadingPreviews.has(image.path) ? (
                          <Spinner size="small" />
                        ) : (
                          <ImageRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                        )}
                      </div>

                      {/* 内容 */}
                      <div className={styles.listItemContent}>
                        <div className={styles.listItemHeader}>
                          <Body1 style={{ fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase300 }}>
                            {image.name}
                          </Body1>
                          <Badge appearance="filled" color={typeInfo.color} icon={typeInfo.icon}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                        {image.prompt && (
                          <Body1 
                            style={{ 
                              fontSize: tokens.fontSizeBase200, 
                              color: tokens.colorNeutralForeground2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                            }}
                            title={image.prompt}
                          >
                            {image.prompt}
                          </Body1>
                        )}
                        <div className={styles.listItemMeta}>
                          {!isVideo && image.width && image.height && (
                            <span>{image.width} × {image.height}</span>
                          )}
                          <span>{formatFileSize(image.size)}</span>
                          {image.deviceType && (
                            <span>{image.deviceType.toUpperCase()}</span>
                          )}
                          {image.duration && (
                            <span>耗时: {formatDuration(image.duration)}</span>
                          )}
                          {!isVideo && image.steps && (
                            <span>步数: {image.steps}</span>
                          )}
                          {!isVideo && image.cfgScale && (
                            <span>CFG: {image.cfgScale}</span>
                          )}
                          {!isVideo && image.samplingMethod && (
                            <span>采样: {image.samplingMethod}</span>
                          )}
                          {!isVideo && image.seed !== null && image.seed !== undefined && (
                            <span>种子: {image.seed}</span>
                          )}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className={styles.listItemActions} onClick={(e) => e.stopPropagation()}>
                        <Button
                          icon={<InfoRegular />}
                          appearance="subtle"
                          size="small"
                          onClick={async () => {
                            setSelectedImageForDetail(image);
                            setDetailVideoSrc(null);
                            setDetailVideoError(null);
                            const mediaType = image.mediaType || 'image';
                            if (mediaType === 'video') {
                              // 使用 media:/// 协议直接加载本地视频
                              setDetailVideoSrc(toMediaUrl(image.path));
                            } else if (mediaType === 'image') {
                              // 打开详情对话框时，自动加载预览图
                              if (!loadedPreviews.has(image.path) && !loadingPreviews.has(image.path)) {
                                loadPreview(image.path);
                              }
                            }
                            setDetailDialogOpen(true);
                          }}
                        >
                          详情
                        </Button>
                        <Button
                          icon={<ArrowDownloadRegular />}
                          appearance="subtle"
                          size="small"
                          onClick={() => handleDownload(image)}
                        >
                          下载
                        </Button>
                        <Button
                          icon={<DeleteRegular />}
                          appearance="subtle"
                          size="small"
                          onClick={() => handleDeleteClick(image)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(_, data) => setDeleteDialogOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>确认删除</DialogTitle>
          <DialogBody>
            <DialogContent>
              <Body1>确定要删除这张图片吗？此操作无法撤销。</Body1>
            </DialogContent>
          </DialogBody>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingImage(null);
              }}
            >
              取消
            </Button>
            <Button
              appearance="primary"
              onClick={handleDeleteConfirm}
            >
              删除
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={(_, data) => setBatchDeleteDialogOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>确认批量删除</DialogTitle>
          <DialogBody>
            <DialogContent>
              <Body1>确定要删除选中的 {selectedImages.size} 张图片吗？此操作无法撤销。</Body1>
            </DialogContent>
          </DialogBody>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => setBatchDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              appearance="primary"
              onClick={handleBatchDeleteConfirm}
            >
              删除
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={(_, data) => {
        setDetailDialogOpen(data.open);
        if (!data.open) {
          // 清理 Blob URL 以释放内存
          if (detailVideoSrc && detailVideoSrc.startsWith('blob:')) {
            URL.revokeObjectURL(detailVideoSrc);
          }
          setSelectedImageForDetail(null);
          setCopiedField(null);
          setDetailVideoSrc(null);
          setDetailVideoError(null);
          setDetailVideoLoading(false);
        }
      }}>
          <DialogSurface style={{ maxWidth: '900px', maxHeight: '90vh', width: '90vw' }}>
          <DialogTitle>结果详情</DialogTitle>
          <DialogBody>
            <DialogContent style={{ maxHeight: '75vh', overflowY: 'auto', padding: 0 }}>
              {selectedImageForDetail && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* 预览区域 - 顶部大图（图片或视频） */}
                  {(() => {
                    const mediaType = selectedImageForDetail.mediaType || 'image';
                    const isVideo = mediaType === 'video';

                    if (isVideo) {
                      return (
                        <div style={{ 
                          width: '100%', 
                          backgroundColor: tokens.colorNeutralBackground2,
                          padding: tokens.spacingVerticalL,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: tokens.spacingVerticalS,
                          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                        }}>
                          {detailVideoLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: tokens.spacingVerticalS }}>
                              <Spinner />
                              <Body1>正在加载视频...</Body1>
                            </div>
                          )}
                          {detailVideoError && (
                            <Body1 style={{ color: tokens.colorPaletteRedForeground1 }}>
                              {detailVideoError}
                            </Body1>
                          )}
                          {detailVideoSrc && !detailVideoLoading && !detailVideoError && (
                            <video
                              src={detailVideoSrc}
                              controls
                              style={{
                                maxWidth: '100%',
                                maxHeight: '400px',
                                borderRadius: tokens.borderRadiusLarge,
                                border: `1px solid ${tokens.colorNeutralStroke2}`,
                                boxShadow: tokens.shadow8,
                                backgroundColor: 'black',
                              }}
                            />
                          )}
                        </div>
                      );
                    }

                    // 详情对话框打开时，按需加载预览图
                    const detailPreviewBase64 = loadedPreviews.get(selectedImageForDetail.path);
                    if (detailPreviewBase64) {
                      return (
                        <div style={{ 
                          width: '100%', 
                          backgroundColor: tokens.colorNeutralBackground2,
                          padding: tokens.spacingVerticalL,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                        }}>
                          <PhotoView src={detailPreviewBase64}>
                            <img
                              src={detailPreviewBase64}
                              alt={selectedImageForDetail.name}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '400px',
                                borderRadius: tokens.borderRadiusLarge,
                                border: `1px solid ${tokens.colorNeutralStroke2}`,
                                cursor: 'pointer',
                                boxShadow: tokens.shadow8,
                              }}
                            />
                          </PhotoView>
                        </div>
                      );
                    } else if (loadingPreviews.has(selectedImageForDetail.path)) {
                      return (
                        <div style={{ 
                          width: '100%', 
                          backgroundColor: tokens.colorNeutralBackground2,
                          padding: tokens.spacingVerticalL,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: tokens.spacingVerticalS,
                          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                        }}>
                          <Spinner />
                          <Body1>正在加载预览图...</Body1>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* 内容区域 - 使用卡片分组 */}
                  <div style={{ padding: tokens.spacingVerticalL, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL }}>
                    {/* 基本信息卡片 */}
                    <Card>
                      <div style={{ padding: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                        <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0 }}>基本信息</Title2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.spacingVerticalM }}>
                          <div>
                            <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                              文件名
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalS }}>
                              <Body1 style={{ fontSize: tokens.fontSizeBase300, wordBreak: 'break-all' }}>
                                {selectedImageForDetail.name}
                              </Body1>
                              <Button
                                size="small"
                                appearance="subtle"
                                icon={copiedField === 'filename' ? <CheckmarkRegular /> : <CopyRegular />}
                                onClick={() => handleCopyToClipboard(selectedImageForDetail.name, 'filename')}
                                title="复制文件名"
                              />
                            </div>
                          </div>
                          <div>
                            <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                              文件大小
                            </Text>
                            <Body1 style={{ fontSize: tokens.fontSizeBase300, marginTop: tokens.spacingVerticalS }}>
                              {formatFileSize(selectedImageForDetail.size)}
                            </Body1>
                          </div>
                          {selectedImageForDetail.width && selectedImageForDetail.height && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                分辨率
                              </Text>
                              <Body1 style={{ fontSize: tokens.fontSizeBase300, marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.width} × {selectedImageForDetail.height}
                              </Body1>
                            </div>
                          )}
                          <div>
                            <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                              生成时间
                            </Text>
                            <Body1 style={{ fontSize: tokens.fontSizeBase300, marginTop: tokens.spacingVerticalS }}>
                              {selectedImageForDetail.generatedAt 
                                ? new Date(selectedImageForDetail.generatedAt).toLocaleString('zh-CN')
                                : formatDate(selectedImageForDetail.modified)}
                            </Body1>
                          </div>
                          {selectedImageForDetail.duration && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                生成耗时
                              </Text>
                              <Body1 style={{ fontSize: tokens.fontSizeBase300, marginTop: tokens.spacingVerticalS }}>
                                {formatDuration(selectedImageForDetail.duration)}
                              </Body1>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* 提示词卡片 */}
                    <Card>
                      <div style={{ padding: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0 }}>提示词</Title2>
                          {selectedImageForDetail.prompt && (
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={copiedField === 'prompt' ? <CheckmarkRegular /> : <CopyRegular />}
                              onClick={() => handleCopyToClipboard(selectedImageForDetail.prompt || '', 'prompt')}
                            >
                              {copiedField === 'prompt' ? '已复制' : '复制'}
                            </Button>
                          )}
                        </div>
                        {selectedImageForDetail.prompt && (
                          <div style={{
                            padding: tokens.spacingVerticalM,
                            backgroundColor: tokens.colorNeutralBackground2,
                            borderRadius: tokens.borderRadiusMedium,
                            border: `1px solid ${tokens.colorNeutralStroke2}`,
                          }}>
                            <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalXS, display: 'block' }}>
                              正面提示词
                            </Text>
                            <Body1 style={{ fontSize: tokens.fontSizeBase300, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                              {selectedImageForDetail.prompt}
                            </Body1>
                          </div>
                        )}
                        {selectedImageForDetail.negativePrompt && (
                          <div style={{
                            padding: tokens.spacingVerticalM,
                            backgroundColor: tokens.colorNeutralBackground2,
                            borderRadius: tokens.borderRadiusMedium,
                            border: `1px solid ${tokens.colorNeutralStroke2}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalXS }}>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                负面提示词
                              </Text>
                              <Button
                                size="small"
                                appearance="subtle"
                                icon={copiedField === 'negativePrompt' ? <CheckmarkRegular /> : <CopyRegular />}
                                onClick={() => handleCopyToClipboard(selectedImageForDetail.negativePrompt || '', 'negativePrompt')}
                              >
                                {copiedField === 'negativePrompt' ? '已复制' : '复制'}
                              </Button>
                            </div>
                            <Body1 style={{ fontSize: tokens.fontSizeBase300, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                              {selectedImageForDetail.negativePrompt}
                            </Body1>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* 生成参数卡片 */}
                    <Card>
                      <div style={{ padding: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                        <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0 }}>生成参数</Title2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: tokens.spacingVerticalM }}>
                          {selectedImageForDetail.steps && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                采样步数
                              </Text>
                              <Badge appearance="filled" color="brand" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.steps}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.cfgScale && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                CFG Scale
                              </Text>
                              <Badge appearance="filled" color="brand" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.cfgScale}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.samplingMethod && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                采样方法
                              </Text>
                              <Badge appearance="outline" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.samplingMethod}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.scheduler && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                调度器
                              </Text>
                              <Badge appearance="outline" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.scheduler}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.seed !== null && selectedImageForDetail.seed !== undefined && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                种子
                              </Text>
                              <Badge appearance="outline" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.seed}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.batchCount && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                批次数量
                              </Text>
                              <Badge appearance="outline" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.batchCount}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.deviceType && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                推理引擎
                              </Text>
                              <Badge appearance="filled" color="success" style={{ marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.deviceType.toUpperCase()}
                              </Badge>
                            </div>
                          )}
                          {selectedImageForDetail.threads !== null && selectedImageForDetail.threads !== undefined && (
                            <div>
                              <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                线程数
                              </Text>
                              <Body1 style={{ fontSize: tokens.fontSizeBase300, marginTop: tokens.spacingVerticalS }}>
                                {selectedImageForDetail.threads}
                              </Body1>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* 模型信息卡片 */}
                    {(selectedImageForDetail.groupName || selectedImageForDetail.modelPath || selectedImageForDetail.vaeModelPath || selectedImageForDetail.llmModelPath) && (
                      <Card>
                        <div style={{ padding: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                          <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0 }}>模型信息</Title2>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                            {selectedImageForDetail.groupName && (
                              <div>
                                <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                  模型组
                                </Text>
                                <Body1 style={{ fontSize: tokens.fontSizeBase300, marginTop: tokens.spacingVerticalS }}>
                                  {selectedImageForDetail.groupName}
                                </Body1>
                              </div>
                            )}
                            {selectedImageForDetail.modelPath && (
                              <div>
                                <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                  SD模型
                                </Text>
                                <Body1 style={{ fontSize: tokens.fontSizeBase300, wordBreak: 'break-all', marginTop: tokens.spacingVerticalS }}>
                                  {getPathBaseName(selectedImageForDetail.modelPath, selectedImageForDetail.modelPath)}
                                </Body1>
                              </div>
                            )}
                            {selectedImageForDetail.vaeModelPath && (
                              <div>
                                <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                  VAE模型
                                </Text>
                                <Body1 style={{ fontSize: tokens.fontSizeBase300, wordBreak: 'break-all', marginTop: tokens.spacingVerticalS }}>
                                  {getPathBaseName(selectedImageForDetail.vaeModelPath, selectedImageForDetail.vaeModelPath)}
                                </Body1>
                              </div>
                            )}
                            {selectedImageForDetail.llmModelPath && (
                              <div>
                                <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                                  LLM模型
                                </Text>
                                <Body1 style={{ fontSize: tokens.fontSizeBase300, wordBreak: 'break-all', marginTop: tokens.spacingVerticalS }}>
                                  {getPathBaseName(selectedImageForDetail.llmModelPath, selectedImageForDetail.llmModelPath)}
                                </Body1>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* 命令行卡片 */}
                    {selectedImageForDetail.commandLine && (
                      <Card>
                        <div style={{ padding: tokens.spacingVerticalM, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Title2 style={{ fontSize: tokens.fontSizeBase400, margin: 0 }}>命令行</Title2>
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={copiedField === 'commandLine' ? <CheckmarkRegular /> : <CopyRegular />}
                              onClick={() => handleCopyToClipboard(selectedImageForDetail.commandLine || '', 'commandLine')}
                            >
                              {copiedField === 'commandLine' ? '已复制' : '复制'}
                            </Button>
                          </div>
                          <div style={{
                            padding: tokens.spacingVerticalM,
                            backgroundColor: tokens.colorNeutralBackground2,
                            borderRadius: tokens.borderRadiusMedium,
                            fontFamily: 'Consolas, "Courier New", monospace',
                            fontSize: tokens.fontSizeBase200,
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap',
                            overflowX: 'auto',
                            border: `1px solid ${tokens.colorNeutralStroke2}`,
                          }}>
                            {selectedImageForDetail.commandLine}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </DialogBody>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                setDetailDialogOpen(false);
                setSelectedImageForDetail(null);
                setCopiedField(null);
              }}
            >
              关闭
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>

      {/* 对比对话框 */}
      <Dialog open={compareDialogOpen} onOpenChange={(_, data) => {
        setCompareDialogOpen(data.open);
        if (!data.open) {
          setCompareImage1(null);
          setCompareImage2(null);
        }
      }}>
        <DialogSurface className={styles.compareDialog}>
          <DialogTitle>图片对比</DialogTitle>
          <DialogBody style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DialogContent className={styles.compareDialogContent}>
              {compareImage1 && compareImage2 && (
                <>
                  <div className={styles.compareDialogHeader}>
                    <div className={styles.compareImageNames}>
                      <div className={styles.compareImageName} title={compareImage1.name}>
                        {compareImage1.name}
                      </div>
                      <Body1 style={{ color: tokens.colorNeutralForeground3 }}>vs</Body1>
                      <div className={styles.compareImageName} title={compareImage2.name}>
                        {compareImage2.name}
                      </div>
                    </div>
                  </div>
                  <div className={styles.compareSliderContainer}>
                    {(() => {
                      const preview1 = loadedPreviews.get(compareImage1.path);
                      const preview2 = loadedPreviews.get(compareImage2.path);
                      
                      if (preview1 && preview2) {
                        return (
                          <ReactCompareSlider
                            itemOne={
                              <ReactCompareSliderImage 
                                src={preview1} 
                                alt={compareImage1.name} 
                              />
                            }
                            itemTwo={
                              <ReactCompareSliderImage 
                                src={preview2} 
                                alt={compareImage2.name} 
                              />
                            }
                            style={{ width: '100%', height: '100%' }}
                            position={50}
                            keyboardIncrement="5%"
                          />
                        );
                      } else {
                        return (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: tokens.spacingVerticalM,
                            width: '100%',
                            height: '100%',
                            minHeight: '400px'
                          }}>
                            <Spinner size="large" />
                            <Body1>正在加载预览图...</Body1>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </>
              )}
            </DialogContent>
          </DialogBody>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                setCompareDialogOpen(false);
                setCompareImage1(null);
                setCompareImage2(null);
              }}
            >
              关闭
            </Button>
          </DialogActions>
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

