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
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  DismissRegular,
  PlayRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useRef } from 'react';
import { PBRMaterialSphere } from '../components/PBRMaterialSphere';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    minHeight: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(420px, 1.1fr) minmax(420px, 1fr)',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
      gap: tokens.spacingVerticalL,
    },
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
  },
  uploadSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    alignItems: 'center',
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalXL,
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  uploadedImageContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: tokens.spacingVerticalS,
  },
  uploadedImage: {
    maxWidth: '100%',
    maxHeight: '320px',
    objectFit: 'contain',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  removeImageButton: {
    position: 'absolute',
    top: tokens.spacingVerticalXS,
    right: tokens.spacingVerticalXS,
    minWidth: 'auto',
  },
  outputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingVerticalM,
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  outputItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  outputImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '320px',
    objectFit: 'contain',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '160px',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  processingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
});

interface MaterialDecomposePageProps {
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

export const MaterialDecomposePage = ({ onProcessingStateChange }: MaterialDecomposePageProps) => {
  const styles = useStyles();
  const [inputImagePath, setInputImagePath] = useState<string | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [outputImages, setOutputImages] = useState<{
    basecolor: string | null;
    metalness: string | null;
    normal: string | null;
    roughness: string | null;
  }>({
    basecolor: null,
    metalness: null,
    normal: null,
    roughness: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectImage = async () => {
    if (!window.ipcRenderer) {
      // 如果 IPC 不可用，使用 HTML5 file input 作为后备方案
      fileInputRef.current?.click();
      return;
    }

    try {
      const filePath = await window.ipcRenderer.invoke('material-decompose:select-file');
      if (filePath) {
        setInputImagePath(filePath);
        // 读取文件并转换为 base64 数据 URI（避免 file:// 协议的安全限制）
        try {
          const imageData = await window.ipcRenderer.invoke('material-decompose:read-image', filePath);
          if (imageData) {
            setInputImagePreview(imageData);
          }
        } catch (error) {
          console.error('Failed to read image:', error);
          // 如果读取失败，尝试使用 file:// 作为后备（可能会失败，但至少尝试）
          const normalizedPath = filePath.replace(/\\/g, '/');
          const previewUrl = normalizedPath.match(/^[A-Za-z]:/) 
            ? `file:///${normalizedPath}` 
            : `file://${normalizedPath}`;
          setInputImagePreview(previewUrl);
        }
        // 清空之前的输出
        setOutputImages({
          basecolor: null,
          metalness: null,
          normal: null,
          roughness: null,
        });
      }
    } catch (error) {
      console.error('Failed to select image:', error);
      alert('选择图片失败，请重试');
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setInputImagePreview(result);
        setInputImagePath(file.name);
        // 清空之前的输出
        setOutputImages({
          basecolor: null,
          metalness: null,
          normal: null,
          roughness: null,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setInputImagePath(null);
    setInputImagePreview(null);
    setOutputImages({
      basecolor: null,
      metalness: null,
      normal: null,
      roughness: null,
    });
  };

  const handleStartProcessing = async () => {
    if (!inputImagePath) {
      alert('请先选择一张图片');
      return;
    }

    if (!window.ipcRenderer) {
      alert('IPC 通信不可用，请确保应用正常运行');
      return;
    }

    try {
      setProcessing(true);
      setProgress('正在处理...');
      setOutputImages({
        basecolor: null,
        metalness: null,
        normal: null,
        roughness: null,
      });

      if (onProcessingStateChange) {
        onProcessingStateChange(true);
      }

      // 调用后端进行材质分解
      const result = await window.ipcRenderer.invoke('material-decompose:start', {
        inputImagePath,
      });

      if (result.success) {
        setOutputImages({
          basecolor: result.basecolor || null,
          metalness: result.metalness || null,
          normal: result.normal || null,
          roughness: result.roughness || null,
        });
        setProgress('处理完成');
      } else {
        throw new Error(result.error || '处理失败');
      }
    } catch (error) {
      console.error('Failed to process material decomposition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 检查是否是取消操作
      if (!errorMessage.includes('材质分解已取消') && !errorMessage.includes('cancelled')) {
        alert(`材质分解失败: ${errorMessage}`);
      }
      setProgress('');
    } finally {
      setProcessing(false);
      if (onProcessingStateChange) {
        onProcessingStateChange(false);
      }
    }
  };

  const handleCancelProcessing = async () => {
    if (!window.ipcRenderer) return;
    
    try {
      await window.ipcRenderer.invoke('material-decompose:cancel');
      setProgress('正在取消...');
    } catch (error) {
      console.error('Failed to cancel material decomposition:', error);
    }
  };

  const hasOutput = outputImages.basecolor || outputImages.metalness || outputImages.normal || outputImages.roughness;

  return (
    <div className={styles.container}>
      <Title1>材质分解</Title1>

      <div className={styles.contentGrid}>
        {/* 左侧：输入与操作 */}
        <Card className={styles.card}>
          <div className={styles.sectionHeader}>
            <Title2 style={{ margin: 0 }}>输入图片</Title2>
            {processing && (
              <Body1 style={{ color: tokens.colorPaletteBlueForeground2 }}>
                {progress || '正在处理...'}
              </Body1>
            )}
          </div>
          <Field label="选择图片" required>
            <div className={styles.uploadSection}>
              {inputImagePreview ? (
                <div className={styles.uploadedImageContainer}>
                  <PhotoView src={inputImagePreview}>
                    <img 
                      src={inputImagePreview} 
                      alt="输入图片" 
                      className={styles.uploadedImage}
                      title="点击放大查看"
                    />
                  </PhotoView>
                  <Button
                    icon={<DismissRegular />}
                    appearance="subtle"
                    className={styles.removeImageButton}
                    onClick={handleRemoveImage}
                    title="移除图片"
                  />
                </div>
              ) : (
                <>
                  <div className={styles.uploadArea} onClick={handleSelectImage}>
                    <ArrowUploadRegular style={{ fontSize: '40px', color: tokens.colorNeutralForeground3 }} />
                    <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
                      点击选择图片
                    </Body1>
                    <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                      支持 PNG、JPG、JPEG、BMP、WEBP 格式
                    </Body1>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/bmp,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileInputChange}
                  />
                  <Button
                    icon={<ArrowUploadRegular />}
                    onClick={handleSelectImage}
                    appearance="primary"
                  >
                    选择图片
                  </Button>
                </>
              )}
            </div>
          </Field>

          <div className={styles.actions}>
            {processing ? (
              <Button
                onClick={handleCancelProcessing}
                appearance="secondary"
                size="medium"
              >
                取消处理
              </Button>
            ) : (
              <Button
                icon={<PlayRegular />}
                onClick={handleStartProcessing}
                disabled={!inputImagePath || processing}
                appearance="primary"
                size="medium"
              >
                开始分解
              </Button>
            )}
          </div>

          {processing && (
            <div className={styles.processingState}>
              <Spinner size="medium" />
              <Body1>{progress || '正在处理...'}</Body1>
            </div>
          )}
        </Card>

        {/* 右侧：PBR 预览 + 输出 */}
        <div className={styles.card} style={{ gap: tokens.spacingVerticalM }}>
          {hasOutput && (
            <Card className={styles.card}>
              <div className={styles.sectionHeader}>
                <Title2 style={{ margin: 0 }}>PBR 材质球预览</Title2>
                <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                  拖拽旋转查看材质效果
                </Body1>
              </div>
              <PBRMaterialSphere
                basecolor={outputImages.basecolor}
                metalness={outputImages.metalness}
                normal={outputImages.normal}
                roughness={outputImages.roughness}
              />
            </Card>
          )}

          <Card className={styles.card}>
            <Title2>输出结果</Title2>
            {hasOutput ? (
              <div className={styles.outputGrid}>
                <div className={styles.outputItem}>
                  <Title2 style={{ fontSize: tokens.fontSizeBase400 }}>Base Color</Title2>
                  {outputImages.basecolor ? (
                    <PhotoView src={outputImages.basecolor}>
                      <img 
                        src={outputImages.basecolor} 
                        alt="Base Color" 
                        className={styles.outputImage}
                        title="点击放大查看"
                      />
                    </PhotoView>
                  ) : (
                    <div className={styles.emptyState}>
                      <Body1>暂无输出</Body1>
                    </div>
                  )}
                </div>

                <div className={styles.outputItem}>
                  <Title2 style={{ fontSize: tokens.fontSizeBase400 }}>Metalness</Title2>
                  {outputImages.metalness ? (
                    <PhotoView src={outputImages.metalness}>
                      <img 
                        src={outputImages.metalness} 
                        alt="Metalness" 
                        className={styles.outputImage}
                        title="点击放大查看"
                      />
                    </PhotoView>
                  ) : (
                    <div className={styles.emptyState}>
                      <Body1>暂无输出</Body1>
                    </div>
                  )}
                </div>

                <div className={styles.outputItem}>
                  <Title2 style={{ fontSize: tokens.fontSizeBase400 }}>Normal</Title2>
                  {outputImages.normal ? (
                    <PhotoView src={outputImages.normal}>
                      <img 
                        src={outputImages.normal} 
                        alt="Normal" 
                        className={styles.outputImage}
                        title="点击放大查看"
                      />
                    </PhotoView>
                  ) : (
                    <div className={styles.emptyState}>
                      <Body1>暂无输出</Body1>
                    </div>
                  )}
                </div>

                <div className={styles.outputItem}>
                  <Title2 style={{ fontSize: tokens.fontSizeBase400 }}>Roughness</Title2>
                  {outputImages.roughness ? (
                    <PhotoView src={outputImages.roughness}>
                      <img 
                        src={outputImages.roughness} 
                        alt="Roughness" 
                        className={styles.outputImage}
                        title="点击放大查看"
                      />
                    </PhotoView>
                  ) : (
                    <div className={styles.emptyState}>
                      <Body1>暂无输出</Body1>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Body1>分解结果将显示在这里</Body1>
                <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
                  请先选择图片并点击"开始分解"按钮
                </Body1>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

