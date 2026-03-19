import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Card,
  Button,
  Select,
  InputNumber,
  Slider,
  Checkbox,
  Spin,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  message,
  Modal,
} from 'antd'
import {
  UploadOutlined,
  DownloadOutlined,
  PictureOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import { perfectPixelService } from '@/features/perfect-pixel/services/perfectPixelService'
import { PhotoView } from 'react-photo-view'
import {
  getPerfectPixel,
  imageToRGB,
  resultToDataURL,
  type SampleMethod,
  type PerfectPixelResult,
} from '../utils/perfectPixel'
import 'react-photo-view/dist/react-photo-view.css'

const { Title, Text } = Typography

// 样式配置 - 使用 CSS 变量支持深浅色模式
const getStyles = (): Record<string, CSSProperties> => ({
  container: {
    padding: 'var(--spacing-xl, 24px)',
    paddingBottom: 120,
    minHeight: '100%',
    maxWidth: 1600,
    margin: '0 auto',
  },
  header: {
    marginBottom: 24,
  },
  headerMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: 'var(--app-home-studio-accent, #722ed1)',
    color: '#fff',
    fontWeight: 600,
  },
  description: {
    color: 'var(--app-text-muted, #8c8c8c)',
    fontSize: 14,
  },
  floatingPanel: {
    position: 'fixed',
    bottom: 24,
    left: 280,
    right: 24,
    maxWidth: 1600,
    margin: '0 auto',
    zIndex: 1000,
    boxShadow: 'var(--shadow-4, 0 6px 16px -8px rgba(0, 0, 0, 0.32))',
    borderRadius: 12,
    padding: '12px 20px',
    backgroundColor: 'var(--app-surface, rgba(255, 255, 255, 0.85))',
    backdropFilter: 'blur(20px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--app-border, #f0f0f0)',
  },
  previewCard: {
    marginBottom: 24,
    backgroundColor: 'var(--app-surface, #fff)',
    borderColor: 'var(--app-border, #f0f0f0)',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  previewRow: {
    display: 'flex',
    gap: 24,
    flex: 1,
    minHeight: 400,
  },
  previewPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  paneHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 300,
    padding: 24,
    backgroundColor: 'var(--app-surface-secondary, #fafafa)',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--app-border, #f0f0f0)',
    position: 'relative',
    overflow: 'auto',
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 48,
    cursor: 'pointer',
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'var(--app-border, #d9d9d9)',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.3s',
  },
  uploadAreaHover: {
    borderColor: 'var(--app-primary, #722ed1)',
    backgroundColor: 'color-mix(in srgb, var(--app-primary, #722ed1) 10%, transparent)',
  },
  paneImage: {
    maxWidth: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    borderRadius: 8,
    cursor: 'pointer',
  },
  paneImagePixelated: {
    maxWidth: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    borderRadius: 8,
    cursor: 'pointer',
    imageRendering: 'pixelated' as const,
  },
  removeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  emptyOutput: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    color: 'var(--app-text-muted, #8c8c8c)',
    height: '100%',
  },
  processingOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  configCard: {
    backgroundColor: 'var(--app-surface, #fff)',
    borderColor: 'var(--app-border, #f0f0f0)',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  configTitle: {
    marginBottom: 16,
    color: 'var(--app-text, rgba(0, 0, 0, 0.88))',
  },
  paramRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 24,
    marginBottom: 16,
  },
  paramField: {
    minWidth: 200,
    maxWidth: 300,
  },
  sliderLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    color: 'var(--app-text-muted, #8c8c8c)',
    fontSize: 14,
  },
  outputToggle: {
    display: 'flex',
    gap: 8,
  },
  divider: {
    borderColor: 'var(--app-border, #f0f0f0)',
  },
  labelColor: {
    color: 'var(--app-text, rgba(0, 0, 0, 0.88))',
  },
})

export const PerfectPixelPage = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null)
  const [processing, setProcessing] = useState(false)

  // 结果
  const [resultData, setResultData] = useState<PerfectPixelResult | null>(null)
  const [resultScaledUrl, setResultScaledUrl] = useState<string | null>(null)
  const [resultOriginalUrl, setResultOriginalUrl] = useState<string | null>(null)
  // 输出面板显示哪张图：original | scaled
  const [outputView, setOutputView] = useState<'original' | 'scaled'>('scaled')

  // 参数
  const [sampleMethod, setSampleMethod] = useState<SampleMethod>('center')
  const [manualGrid, setManualGrid] = useState(false)
  const [gridWidth, setGridWidth] = useState<number>(32)
  const [gridHeight, setGridHeight] = useState<number>(32)
  const [minSize, setMinSize] = useState<number>(4)
  const [peakWidth, setPeakWidth] = useState<number>(6)
  const [refineIntensity, setRefineIntensity] = useState<number>(0.25)
  const [fixSquare, setFixSquare] = useState(true)
  const [outputScale, setOutputScale] = useState<number>(8)

  // 上传区域 hover 状态
  const [uploadHover, setUploadHover] = useState(false)

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')

  // 监听主题变化
  const [themeKey, setThemeKey] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeKey((k) => k + 1)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  const styles = getStyles()

  const showModal = (title: string, msg: string) => {
    setModalTitle(title)
    setModalMessage(msg)
    setModalVisible(true)
  }

  const loadImageFromDataUrl = useCallback((dataUrl: string) => {
    setImagePreview(dataUrl)
    setResultData(null)
    setResultScaledUrl(null)
    setResultOriginalUrl(null)

    const img = new Image()
    img.onload = () => setLoadedImage(img)
    img.src = dataUrl
  }, [])

  // 选择图片：Tauri IPC 或浏览器文件选择
  const selectImage = useCallback(async () => {
    try {
      const filePath = await perfectPixelService.selectImage()
      if (!filePath) return
      const dataUrl = await perfectPixelService.readImage(filePath)
      loadImageFromDataUrl(dataUrl)
    } catch {
      fileInputRef.current?.click()
    }
  }, [loadImageFromDataUrl])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => loadImageFromDataUrl(reader.result as string)
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [loadImageFromDataUrl],
  )

  const removeImage = useCallback(() => {
    setImagePreview(null)
    setLoadedImage(null)
    setResultData(null)
    setResultScaledUrl(null)
    setResultOriginalUrl(null)
  }, [])

  const processImage = useCallback(async () => {
    if (!loadedImage) return
    setProcessing(true)
    setResultData(null)
    setResultScaledUrl(null)
    setResultOriginalUrl(null)

    // 放到 setTimeout 让 UI 有机会渲染 loading 状态
    setTimeout(() => {
      try {
        const { data: rgbData, width, height } = imageToRGB(loadedImage)

        const result = getPerfectPixel(rgbData, width, height, {
          sampleMethod,
          gridSize: manualGrid ? [gridWidth, gridHeight] : null,
          minSize,
          peakWidth,
          refineIntensity,
          fixSquare,
        })

        if (!result) {
          showModal(
            '处理失败',
            '无法检测网格大小。请尝试手动设置网格尺寸，或选择一张网格更明显的像素风格图片。',
          )
          setProcessing(false)
          return
        }

        setResultData(result)
        setResultOriginalUrl(resultToDataURL(result, 1))
        setResultScaledUrl(resultToDataURL(result, outputScale))
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        showModal('错误', errMsg || '处理过程中出错')
      } finally {
        setProcessing(false)
      }
    }, 50)
  }, [
    loadedImage,
    sampleMethod,
    manualGrid,
    gridWidth,
    gridHeight,
    minSize,
    peakWidth,
    refineIntensity,
    fixSquare,
    outputScale,
  ])

  // 参数变化时自动处理（防抖 300ms）
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    // 跳过首次渲染
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    if (!loadedImage) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      processImage()
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleMethod, manualGrid, gridWidth, gridHeight, minSize, peakWidth, refineIntensity, fixSquare, outputScale])

  // 加载新图片后立即处理
  useEffect(() => {
    if (loadedImage) {
      processImage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedImage])

  const downloadImage = useCallback((dataUrl: string, suffix: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `perfect_pixel_${suffix}_${Date.now()}.png`
    a.click()
  }, [])

  const saveImage = useCallback(
    async (dataUrl: string, suffix: string) => {
      try {
        const result = await perfectPixelService.saveImage(dataUrl)
        if (result.success) {
          message.success(`文件已保存到: ${result.filePath}`)
        }
      } catch {
        downloadImage(dataUrl, suffix)
      }
    },
    [downloadImage],
  )

  // 当前输出图
  const currentOutputUrl = outputView === 'scaled' ? resultScaledUrl : resultOriginalUrl
  const currentOutputLabel =
    outputView === 'scaled'
      ? `${outputScale}x 放大 (${(resultData?.width ?? 0) * outputScale}×${(resultData?.height ?? 0) * outputScale})`
      : `原始尺寸 (${resultData?.width ?? 0}×${resultData?.height ?? 0})`

  // 采样方法选项
  const sampleMethodOptions = [
    { value: 'center', label: '中心采样（最快）' },
    { value: 'median', label: '中值采样（均衡）' },
    { value: 'majority', label: '多数表决（最精确）' },
  ]

  // 强制重新渲染以响应主题变化
  void themeKey

  return (
    <div style={styles.container} className="app-page">
      <header style={styles.header}>
        <div style={styles.headerMain}>
          <Title level={2} style={{ margin: 0, color: 'var(--app-text, rgba(0, 0, 0, 0.88))' }}>
            像素画精修
          </Title>
          <Tag style={styles.tag}>PIXEL LAB</Tag>
        </div>
        <Text style={styles.description}>
          对像素图进行网格修复、边缘提纯和放大输出，支持参数回调与双结果视图切换。
        </Text>
      </header>

      {/* 隐藏的文件选择 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 浮动控制面板 */}
      <div style={styles.floatingPanel}>
        <Space wrap>
          <Button
            type="primary"
            icon={processing ? <Spin size="small" /> : <ReloadOutlined />}
            disabled={!loadedImage || processing}
            onClick={processImage}
            size="large"
          >
            {processing ? '处理中...' : '重新处理'}
          </Button>

          <Button icon={<UploadOutlined />} onClick={selectImage} disabled={processing}>
            {imagePreview ? '重新选择图片' : '选择图片'}
          </Button>

          {resultScaledUrl && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                saveImage(
                  outputView === 'scaled' ? resultScaledUrl! : resultOriginalUrl!,
                  outputView === 'scaled' ? `${outputScale}x` : 'original',
                )
              }
            >
              保存当前结果
            </Button>
          )}
        </Space>
      </div>

      {/* 预览区域 */}
      <Card style={styles.previewCard} styles={{ body: { padding: 24, height: '100%' } }}>
        <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 400 }}>
          {/* 左侧 - 输入图片 */}
          <div style={styles.previewPane}>
            <div style={styles.paneHeader}>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text, rgba(0, 0, 0, 0.88))' }}>
                输入图片
              </Title>
              {imagePreview && (
                <Text style={styles.infoText}>
                  {loadedImage ? `${loadedImage.naturalWidth}×${loadedImage.naturalHeight}` : ''}
                </Text>
              )}
            </div>
            <div style={styles.paneContent}>
              {!imagePreview ? (
                <div
                  style={uploadHover ? { ...styles.uploadArea, ...styles.uploadAreaHover } : styles.uploadArea}
                  onClick={selectImage}
                  onMouseEnter={() => setUploadHover(true)}
                  onMouseLeave={() => setUploadHover(false)}
                >
                  <PictureOutlined style={{ fontSize: 48, color: 'var(--app-primary, #722ed1)' }} />
                  <Text style={{ color: 'var(--app-text, rgba(0, 0, 0, 0.88))' }}>点击选择像素风格图片</Text>
                  <Text style={styles.infoText}>推荐 512×512 ~ 1024×1024</Text>
                </div>
              ) : (
                <>
                  <Button
                    style={styles.removeBtn}
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={removeImage}
                    size="small"
                  />
                  <PhotoView src={imagePreview}>
                    <img src={imagePreview} alt="输入图片" style={styles.paneImage} />
                  </PhotoView>
                </>
              )}
            </div>
          </div>

          {/* 右侧 - 输出结果 */}
          <div style={styles.previewPane}>
            <div style={styles.paneHeader}>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text, rgba(0, 0, 0, 0.88))' }}>
                输出结果
              </Title>
              {resultData && (
                <Space style={styles.outputToggle}>
                  <Button
                    size="small"
                    type={outputView === 'scaled' ? 'primary' : 'default'}
                    icon={<ZoomInOutlined />}
                    onClick={() => setOutputView('scaled')}
                  >
                    {outputScale}x 放大
                  </Button>
                  <Button
                    size="small"
                    type={outputView === 'original' ? 'primary' : 'default'}
                    icon={<ZoomOutOutlined />}
                    onClick={() => setOutputView('original')}
                  >
                    原始尺寸
                  </Button>
                </Space>
              )}
            </div>
            <div style={styles.paneContent}>
              {processing ? (
                <div style={styles.processingOverlay}>
                  <Spin size="large" />
                  <Text style={{ color: 'var(--app-text, rgba(0, 0, 0, 0.88))' }}>正在处理...</Text>
                </div>
              ) : currentOutputUrl ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Space>
                      <Text style={styles.infoText}>{currentOutputLabel}</Text>
                      <Tag color="purple">
                        {resultData!.width}×{resultData!.height} 像素
                      </Tag>
                    </Space>
                  </div>
                  <PhotoView src={currentOutputUrl}>
                    <img src={currentOutputUrl} alt="输出结果" style={styles.paneImagePixelated} />
                  </PhotoView>
                </>
              ) : (
                <div style={styles.emptyOutput}>
                  <PictureOutlined style={{ fontSize: 48, color: 'var(--app-border, #d9d9d9)' }} />
                  <Text style={{ color: 'var(--app-text-muted, #8c8c8c)' }}>处理结果将显示在这里</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 参数配置 */}
      <Card style={styles.configCard}>
        <Title level={4} style={styles.configTitle}>
          处理参数
        </Title>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={8}>
            <div style={styles.paramField}>
              <Text strong style={styles.labelColor}>
                采样方法
              </Text>
              <Select
                value={sampleMethod}
                onChange={setSampleMethod}
                options={sampleMethodOptions}
                style={{ width: '100%' }}
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <div style={styles.paramField}>
              <Text strong style={styles.labelColor}>
                输出放大倍数: {outputScale}x
              </Text>
              <Slider min={1} max={16} step={1} value={outputScale} onChange={setOutputScale} />
            </div>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <div style={styles.paramField}>
              <Text strong style={styles.labelColor}>
                细化强度: {refineIntensity.toFixed(2)}
              </Text>
              <Slider
                min={0}
                max={50}
                step={1}
                value={Math.round(refineIntensity * 100)}
                onChange={(val) => setRefineIntensity(val / 100)}
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <div style={styles.paramField}>
              <Text strong style={styles.labelColor}>
                最小像素尺寸
              </Text>
              <InputNumber value={minSize} onChange={(val) => setMinSize(val ?? 4)} min={1} style={{ width: '100%' }} />
            </div>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <div style={styles.paramField}>
              <Text strong style={styles.labelColor}>
                峰值检测宽度
              </Text>
              <InputNumber value={peakWidth} onChange={(val) => setPeakWidth(val ?? 6)} min={1} style={{ width: '100%' }} />
            </div>
          </Col>

          <Col xs={24}>
            <Checkbox checked={fixSquare} onChange={(e) => setFixSquare(e.target.checked)}>
              <Text style={styles.labelColor}>自动修正为正方形（当检测到近正方形时）</Text>
            </Checkbox>
          </Col>

          <Col xs={24}>
            <Checkbox checked={manualGrid} onChange={(e) => setManualGrid(e.target.checked)}>
              <Text style={styles.labelColor}>手动指定网格大小（覆盖自动检测）</Text>
            </Checkbox>
          </Col>

          {manualGrid && (
            <>
              <Col xs={24} sm={12}>
                <div style={styles.paramField}>
                  <Text strong style={styles.labelColor}>
                    网格宽度
                  </Text>
                  <InputNumber
                    value={gridWidth}
                    onChange={(val) => setGridWidth(val ?? 32)}
                    min={1}
                    style={{ width: '100%' }}
                  />
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={styles.paramField}>
                  <Text strong style={styles.labelColor}>
                    网格高度
                  </Text>
                  <InputNumber
                    value={gridHeight}
                    onChange={(val) => setGridHeight(val ?? 32)}
                    min={1}
                    style={{ width: '100%' }}
                  />
                </div>
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* 消息提示 Modal */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={() => setModalVisible(false)}
        onCancel={() => setModalVisible(false)}
        centered
        width={400}
      >
        <p>{modalMessage}</p>
      </Modal>
    </div>
  )
}
