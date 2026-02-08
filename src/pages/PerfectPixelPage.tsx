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
  Dropdown,
  Option,
  Input,
  Checkbox,
  Text,
  Slider,
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  DocumentArrowDownRegular,
  ArrowUploadRegular,
  DismissRegular,
  ImageRegular,
} from '@fluentui/react-icons';
import { PhotoView } from 'react-photo-view';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSharedStyles } from '../styles/sharedStyles';
import { MessageDialog, useMessageDialog } from '../components/MessageDialog';
import {
  getPerfectPixel,
  imageToRGB,
  resultToDataURL,
  type SampleMethod,
  type PerfectPixelResult,
} from '../utils/perfectPixel';

const useLocalStyles = makeStyles({
  // 左右分栏预览区
  splitPreview: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    flex: '1 1 auto',
    minHeight: '300px',
    overflow: 'hidden',
  },
  previewPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minWidth: 0,
    gap: tokens.spacingVerticalS,
  },
  paneHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  paneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    position: 'relative',
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    transition: 'background-color 0.2s',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  paneImage: {
    maxWidth: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
  },
  paneImagePixelated: {
    maxWidth: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    imageRendering: 'pixelated',
  },
  removeImageButton: {
    position: 'absolute',
    top: tokens.spacingVerticalXS,
    right: tokens.spacingVerticalXS,
    minWidth: 'auto',
    zIndex: 1,
  },
  emptyOutput: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
    height: '100%',
    width: '100%',
  },
  paramRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
    alignItems: 'start',
  },
  paramField: {
    minWidth: '160px',
    flex: '1 1 160px',
    maxWidth: '280px',
  },
  sliderLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  hiddenInput: {
    display: 'none',
  },
  processingOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
  },
  outputToggle: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

export const PerfectPixelPage = () => {
  const sharedStyles = useSharedStyles();
  const styles = useLocalStyles();
  const { dialogState, showDialog, hideDialog } = useMessageDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);

  // 结果
  const [resultData, setResultData] = useState<PerfectPixelResult | null>(null);
  const [resultScaledUrl, setResultScaledUrl] = useState<string | null>(null);
  const [resultOriginalUrl, setResultOriginalUrl] = useState<string | null>(null);
  // 输出面板显示哪张图：original | scaled
  const [outputView, setOutputView] = useState<'original' | 'scaled'>('scaled');

  // 参数
  const [sampleMethod, setSampleMethod] = useState<SampleMethod>('center');
  const [manualGrid, setManualGrid] = useState(false);
  const [gridWidth, setGridWidth] = useState<number>(32);
  const [gridHeight, setGridHeight] = useState<number>(32);
  const [minSize, setMinSize] = useState<number>(4);
  const [peakWidth, setPeakWidth] = useState<number>(6);
  const [refineIntensity, setRefineIntensity] = useState<number>(0.25);
  const [fixSquare, setFixSquare] = useState(true);
  const [outputScale, setOutputScale] = useState<number>(8);

  const loadImageFromDataUrl = useCallback((dataUrl: string) => {
    setImagePreview(dataUrl);
    setResultData(null);
    setResultScaledUrl(null);
    setResultOriginalUrl(null);

    const img = new Image();
    img.onload = () => setLoadedImage(img);
    img.src = dataUrl;
  }, []);

  // 支持两种选图方式：Electron IPC 或浏览器文件选择
  const selectImage = useCallback(async () => {
    if (window.ipcRenderer) {
      try {
        const filePath = await window.ipcRenderer.invoke('perfect-pixel:select-image' as any);
        if (!filePath) return;
        const dataUrl = await window.ipcRenderer.invoke('perfect-pixel:read-image' as any, filePath);
        loadImageFromDataUrl(dataUrl);
      } catch {
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [loadImageFromDataUrl]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadImageFromDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [loadImageFromDataUrl]);

  const removeImage = useCallback(() => {
    setImagePreview(null);
    setLoadedImage(null);
    setResultData(null);
    setResultScaledUrl(null);
    setResultOriginalUrl(null);
  }, []);

  const processImage = useCallback(async () => {
    if (!loadedImage) return;
    setProcessing(true);
    setResultData(null);
    setResultScaledUrl(null);
    setResultOriginalUrl(null);

    // 放到 setTimeout 让 UI 有机会渲染 loading 状态
    setTimeout(() => {
      try {
        const { data: rgbData, width, height } = imageToRGB(loadedImage);

        const result = getPerfectPixel(rgbData, width, height, {
          sampleMethod,
          gridSize: manualGrid ? [gridWidth, gridHeight] : null,
          minSize,
          peakWidth,
          refineIntensity,
          fixSquare,
        });

        if (!result) {
          showDialog('处理失败', '无法检测网格大小。请尝试手动设置网格尺寸，或选择一张网格更明显的像素风格图片。');
          setProcessing(false);
          return;
        }

        setResultData(result);
        setResultOriginalUrl(resultToDataURL(result, 1));
        setResultScaledUrl(resultToDataURL(result, outputScale));
      } catch (err: any) {
        showDialog('错误', err.message || '处理过程中出错');
      } finally {
        setProcessing(false);
      }
    }, 50);
  }, [loadedImage, sampleMethod, manualGrid, gridWidth, gridHeight, minSize, peakWidth, refineIntensity, fixSquare, outputScale, showDialog]);

  // 参数变化时自动处理（防抖 300ms）
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // 跳过首次渲染
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!loadedImage) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      processImage();
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleMethod, manualGrid, gridWidth, gridHeight, minSize, peakWidth, refineIntensity, fixSquare, outputScale]);

  // 加载新图片后立即处理
  useEffect(() => {
    if (loadedImage) {
      processImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedImage]);

  const downloadImage = useCallback((dataUrl: string, suffix: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `perfect_pixel_${suffix}_${Date.now()}.png`;
    a.click();
  }, []);

  const saveImage = useCallback(async (dataUrl: string, suffix: string) => {
    if (window.ipcRenderer) {
      try {
        const result = await window.ipcRenderer.invoke('perfect-pixel:save' as any, dataUrl);
        if (result.success) {
          showDialog('保存成功', `文件已保存到: ${result.filePath}`);
        }
      } catch {
        downloadImage(dataUrl, suffix);
      }
    } else {
      downloadImage(dataUrl, suffix);
    }
  }, [showDialog, downloadImage]);

  // 当前输出图
  const currentOutputUrl = outputView === 'scaled' ? resultScaledUrl : resultOriginalUrl;
  const currentOutputLabel = outputView === 'scaled'
    ? `${outputScale}x 放大 (${(resultData?.width ?? 0) * outputScale}×${(resultData?.height ?? 0) * outputScale})`
    : `原始尺寸 (${resultData?.width ?? 0}×${resultData?.height ?? 0})`;

  return (
    <div className={sharedStyles.container}>
      <Title1>Perfect Pixel — 像素画精修</Title1>

      {/* 隐藏的文件选择 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      {/* 浮动控制面板 */}
      <div className={sharedStyles.floatingControlPanel}>
        <div className={sharedStyles.actions}>
          <Button
            appearance="primary"
            icon={processing ? <Spinner size="tiny" /> : <ImageRegular />}
            disabled={!loadedImage || processing}
            onClick={processImage}
            size="large"
          >
            {processing ? '处理中...' : '重新处理'}
          </Button>

          <Button
            icon={<ArrowUploadRegular />}
            onClick={selectImage}
            disabled={processing}
          >
            {imagePreview ? '重新选择图片' : '选择图片'}
          </Button>

          {resultScaledUrl && (
            <Button
              icon={<DocumentArrowDownRegular />}
              onClick={() => saveImage(
                outputView === 'scaled' ? resultScaledUrl! : resultOriginalUrl!,
                outputView === 'scaled' ? `${outputScale}x` : 'original'
              )}
            >
              保存当前结果
            </Button>
          )}
        </div>
      </div>

      {/* 左右分栏预览 */}
      <Card className={sharedStyles.previewCard}>
        <div className={styles.splitPreview}>
          {/* 左侧 - 输入图片 */}
          <div className={styles.previewPane}>
            <div className={styles.paneHeader}>
              <Title2>输入图片</Title2>
              {imagePreview && (
                <Text className={styles.infoText}>
                  {loadedImage ? `${loadedImage.naturalWidth}×${loadedImage.naturalHeight}` : ''}
                </Text>
              )}
            </div>
            <div className={styles.paneContent}>
              {!imagePreview ? (
                <div className={styles.uploadArea} onClick={selectImage}>
                  <ImageAddRegular style={{ fontSize: '48px' }} />
                  <Body1>点击选择像素风格图片</Body1>
                  <Text className={styles.infoText}>推荐 512×512 ~ 1024×1024</Text>
                </div>
              ) : (
                <>
                  <Button
                    className={styles.removeImageButton}
                    appearance="subtle"
                    icon={<DismissRegular />}
                    onClick={removeImage}
                    size="small"
                  />
                  <PhotoView src={imagePreview}>
                    <img
                      src={imagePreview}
                      alt="输入图片"
                      className={styles.paneImage}
                    />
                  </PhotoView>
                </>
              )}
            </div>
          </div>

          {/* 右侧 - 输出结果 */}
          <div className={styles.previewPane}>
            <div className={styles.paneHeader}>
              <Title2>输出结果</Title2>
              {resultData && (
                <div className={styles.outputToggle}>
                  <Button
                    size="small"
                    appearance={outputView === 'scaled' ? 'primary' : 'subtle'}
                    onClick={() => setOutputView('scaled')}
                  >
                    {outputScale}x 放大
                  </Button>
                  <Button
                    size="small"
                    appearance={outputView === 'original' ? 'primary' : 'subtle'}
                    onClick={() => setOutputView('original')}
                  >
                    原始尺寸
                  </Button>
                </div>
              )}
            </div>
            <div className={styles.paneContent}>
              {processing ? (
                <div className={styles.processingOverlay}>
                  <Spinner size="large" />
                  <Body1>正在处理...</Body1>
                </div>
              ) : currentOutputUrl ? (
                <>
                  <Text className={styles.infoText} style={{ marginBottom: tokens.spacingVerticalS }}>
                    {currentOutputLabel}{' '}
                    <span className={styles.badge}>{resultData!.width}×{resultData!.height} 像素</span>
                  </Text>
                  <PhotoView src={currentOutputUrl}>
                    <img
                      src={currentOutputUrl}
                      alt="输出结果"
                      className={styles.paneImagePixelated}
                    />
                  </PhotoView>
                </>
              ) : (
                <div className={styles.emptyOutput}>
                  <ImageRegular style={{ fontSize: '48px' }} />
                  <Body1>处理结果将显示在这里</Body1>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 参数配置 */}
      <Card className={sharedStyles.configCard}>
        <Title2>处理参数</Title2>
        <div className={sharedStyles.formSection}>
          <div className={styles.paramRow}>
            <Field label="采样方法" className={styles.paramField}>
              <Dropdown
                value={sampleMethod === 'center' ? '中心采样' : sampleMethod === 'median' ? '中值采样' : '多数表决'}
                onOptionSelect={(_, data) => {
                  const map: Record<string, SampleMethod> = {
                    '中心采样': 'center',
                    '中值采样': 'median',
                    '多数表决': 'majority',
                  };
                  setSampleMethod(map[data.optionValue as string] ?? 'center');
                }}
              >
                <Option value="中心采样">中心采样（最快）</Option>
                <Option value="中值采样">中值采样（均衡）</Option>
                <Option value="多数表决">多数表决（最精确）</Option>
              </Dropdown>
            </Field>

            <Field label="输出放大倍数" className={styles.paramField}>
              <div className={styles.sliderLabel}>
                <Slider
                  min={1}
                  max={16}
                  step={1}
                  value={outputScale}
                  onChange={(_, data) => setOutputScale(data.value)}
                  style={{ flex: 1 }}
                />
                <Text>{outputScale}x</Text>
              </div>
            </Field>

            <Field label="细化强度" className={styles.paramField}>
              <div className={styles.sliderLabel}>
                <Slider
                  min={0}
                  max={50}
                  step={1}
                  value={Math.round(refineIntensity * 100)}
                  onChange={(_, data) => setRefineIntensity(data.value / 100)}
                  style={{ flex: 1 }}
                />
                <Text>{refineIntensity.toFixed(2)}</Text>
              </div>
            </Field>
          </div>

          <div className={styles.paramRow}>
            <Field label="最小像素尺寸" className={styles.paramField}>
              <Input
                type="number"
                value={minSize.toString()}
                onChange={(_, data) => setMinSize(Number(data.value) || 4)}
              />
            </Field>

            <Field label="峰值检测宽度" className={styles.paramField}>
              <Input
                type="number"
                value={peakWidth.toString()}
                onChange={(_, data) => setPeakWidth(Number(data.value) || 6)}
              />
            </Field>
          </div>

          <Checkbox
            checked={fixSquare}
            onChange={(_, data) => setFixSquare(!!data.checked)}
            label="自动修正为正方形（当检测到近正方形时）"
          />

          <Checkbox
            checked={manualGrid}
            onChange={(_, data) => setManualGrid(!!data.checked)}
            label="手动指定网格大小（覆盖自动检测）"
          />

          {manualGrid && (
            <div className={styles.paramRow}>
              <Field label="网格宽度" className={styles.paramField}>
                <Input
                  type="number"
                  value={gridWidth.toString()}
                  onChange={(_, data) => setGridWidth(Number(data.value) || 32)}
                />
              </Field>
              <Field label="网格高度" className={styles.paramField}>
                <Input
                  type="number"
                  value={gridHeight.toString()}
                  onChange={(_, data) => setGridHeight(Number(data.value) || 32)}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <MessageDialog {...dialogState} onClose={hideDialog} />
    </div>
  );
};
