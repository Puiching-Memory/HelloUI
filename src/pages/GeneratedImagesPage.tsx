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
  Checkbox,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular,
  DeleteRegular,
  ImageRegular,
  ArrowSyncRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
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
  imagePreview: {
    width: '100px',
    height: '100px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
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
    maxWidth: '100%',
    maxHeight: '75vh',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    borderRadius: tokens.borderRadiusSmall,
    boxShadow: tokens.shadow16,
    userSelect: 'none',
    pointerEvents: 'auto',
  },
  tableCellPreview: {
    width: '120px',
  },
  tableCellFileName: {
    maxWidth: '300px',
    minWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableCellPath: {
    maxWidth: '400px',
    minWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableCellSize: {
    maxWidth: '120px',
    minWidth: '100px',
  },
  tableCellDate: {
    maxWidth: '180px',
    minWidth: '150px',
  },
});

interface GeneratedImage {
  name: string;
  path: string;
  size: number;
  modified: number;
  preview?: string; // base64 预览图
}

export const GeneratedImagesPage = () => {
  const styles = useStyles();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  // 加载图片列表
  useEffect(() => {
    loadImages().catch(console.error);
  }, []);

  const loadImages = async () => {
    try {
      // 检查 ipcRenderer 是否可用
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      setLoading(true);
      const imageList = await window.ipcRenderer.invoke('generated-images:list');
      setImages(imageList || []);
      // 清空选择状态
      setSelectedImages(new Set());
    } catch (error) {
      console.error('Failed to load images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // 切换单个图片的选择状态
  const handleToggleSelect = (imagePath: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imagePath)) {
        newSet.delete(imagePath);
      } else {
        newSet.add(imagePath);
      }
      return newSet;
    });
  };

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
  const isIndeterminate = selectedImages.size > 0 && selectedImages.size < images.length;

  const handleDownload = async (image: GeneratedImage) => {
    try {
      if (!window.ipcRenderer) {
        alert('IPC 通信不可用');
        return;
      }
      const success = await window.ipcRenderer.invoke('generated-images:download', image.path);
      if (success) {
        // 可以显示成功提示
        console.log('图片下载成功');
      }
    } catch (error) {
      console.error('Failed to download image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`下载图片失败: ${errorMessage}`);
    }
  };

  const handleDeleteClick = (image: GeneratedImage) => {
    setDeletingImage(image.path);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingImage || !window.ipcRenderer) {
      return;
    }
    try {
      await window.ipcRenderer.invoke('generated-images:delete', deletingImage);
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
      alert(`删除图片失败: ${errorMessage}`);
    }
  };

  // 批量下载（打包为 ZIP）
  const handleBatchDownload = async () => {
    if (selectedImages.size === 0 || !window.ipcRenderer) {
      return;
    }
    try {
      const selectedPaths = Array.from(selectedImages);
      const result = await window.ipcRenderer.invoke('generated-images:batch-download', selectedPaths);
      
      if (result.canceled) {
        // 用户取消了保存对话框
        return;
      }
      
      if (result.success) {
        const sizeInMB = (result.size / (1024 * 1024)).toFixed(2);
        alert(`成功打包 ${selectedPaths.length} 张图片为 ZIP 文件\n文件大小: ${sizeInMB} MB`);
      } else {
        throw new Error('打包失败');
      }
    } catch (error) {
      console.error('Failed to batch download images:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`批量下载失败: ${errorMessage}`);
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
    if (selectedImages.size === 0 || !window.ipcRenderer) {
      return;
    }
    try {
      const selectedPaths = Array.from(selectedImages);
      const successfullyDeleted = new Set<string>();
      let successCount = 0;
      let failCount = 0;

      for (const path of selectedPaths) {
        try {
          await window.ipcRenderer.invoke('generated-images:delete', path);
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
        alert(`成功删除 ${successCount} 张图片`);
      } else {
        alert(`删除完成：成功 ${successCount} 张，失败 ${failCount} 张。失败的图片仍保留在列表中。`);
      }
    } catch (error) {
      console.error('Failed to batch delete images:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`批量删除失败: ${errorMessage}`);
    }
  };

  const getImageMimeType = (filename: string): string => {
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
  };


  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      <Title1>已生成图片管理</Title1>

      <Card className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalM }}>
          <Title2>图片列表</Title2>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalM }}>
            {selectedImages.size > 0 && (
              <>
                <Button
                  icon={<ArrowDownloadRegular />}
                  onClick={handleBatchDownload}
                  disabled={loading}
                >
                  批量下载 ({selectedImages.size})
                </Button>
                <Button
                  icon={<DeleteRegular />}
                  appearance="secondary"
                  onClick={handleBatchDeleteClick}
                  disabled={loading}
                >
                  批量删除 ({selectedImages.size})
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
            <ImageRegular style={{ fontSize: '48px', marginBottom: tokens.spacingVerticalM }} />
            <Body1>暂无已生成的图片</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              生成的图片将保存在模型文件夹下的 outputs 目录中
            </Body1>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell style={{ width: '50px' }}>
                    <Checkbox
                      checked={isAllSelected}
                      onChange={(_, data) => handleSelectAll(data.checked === true)}
                      indeterminate={isIndeterminate}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>预览</TableHeaderCell>
                  <TableHeaderCell>文件名</TableHeaderCell>
                  <TableHeaderCell>路径</TableHeaderCell>
                  <TableHeaderCell>大小</TableHeaderCell>
                  <TableHeaderCell>修改时间</TableHeaderCell>
                  <TableHeaderCell>操作</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {images.map((image) => (
                  <TableRow key={image.path}>
                    <TableCell style={{ width: '50px' }}>
                      <Checkbox
                        checked={selectedImages.has(image.path)}
                        onChange={() => handleToggleSelect(image.path)}
                      />
                    </TableCell>
                    <TableCell className={styles.tableCellPreview}>
                      {image.preview ? (
                        <PhotoView src={`data:${getImageMimeType(image.name)};base64,${image.preview}`}>
                          <img
                            src={`data:${getImageMimeType(image.name)};base64,${image.preview}`}
                            alt={image.name}
                            className={styles.imagePreview}
                          />
                        </PhotoView>
                      ) : (
                        <PhotoView src={image.path}>
                          <div
                            style={{
                              width: '100px',
                              height: '100px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: tokens.colorNeutralBackground2,
                              borderRadius: tokens.borderRadiusSmall,
                              border: `1px solid ${tokens.colorNeutralStroke2}`,
                              cursor: 'pointer',
                            }}
                          >
                            <ImageRegular />
                          </div>
                        </PhotoView>
                      )}
                    </TableCell>
                    <TableCell className={styles.tableCellFileName}>
                      <Body1>{image.name}</Body1>
                    </TableCell>
                    <TableCell className={styles.tableCellPath}>
                      <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                        {image.path}
                      </Body1>
                    </TableCell>
                    <TableCell className={styles.tableCellSize}>
                      <Body1>{formatFileSize(image.size)}</Body1>
                    </TableCell>
                    <TableCell className={styles.tableCellDate}>
                      <Body1>{formatDate(image.modified)}</Body1>
                    </TableCell>
                    <TableCell>
                      <div className={styles.actions}>
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
    </div>
  );
};

