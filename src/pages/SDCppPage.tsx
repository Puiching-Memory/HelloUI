import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Body2,
  Button,
  Card,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  ProgressBar,
  Spinner,
  Title1,
  Title2,
  Title3,
  tokens,
} from '@/ui/components'
import {
  AddRegular,
  ArrowDownloadRegular,
  ArrowSyncRegular,
  CheckmarkCircleFilled,
  DismissRegular,
  GlobeRegular,
  PlugConnectedRegular,
  TopSpeedRegular,
} from '@/ui/icons'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useIpcListener } from '../hooks/useIpcListener'
import { useTaskbarProgress } from '../hooks/useTaskbarProgress'
import { ipcInvoke } from '../lib/tauriIpc'
import type {
  DeviceType,
  MirrorSource,
  MirrorTestResult,
  SDCppDownloadProgress,
  SDCppRelease,
  SDCppReleaseAsset,
} from '../../shared/types'
import { formatFileSize } from '@/utils/format'
import { getDeviceLabel } from '@/utils/modelUtils'
import { MessageDialog } from '@/components/MessageDialog'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1360px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  sectionDescription: {
    color: tokens.colorNeutralForeground3,
    maxWidth: '760px',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  overviewCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  overviewLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  overviewValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  overviewMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-word',
  },
  topGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  folderControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  folderInputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  helperText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-word',
  },
  controlGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.spacingVerticalM,
    alignItems: 'end',
  },
  quickActionRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statusCard: {
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  engineCard: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  engineCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  engineInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  infoLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  infoValue: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    textAlign: 'right',
  },
  detailCard: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
  },
  downloadSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  releaseToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  releaseMeta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  assetCard: {
    padding: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  assetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  advancedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  mirrorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  mirrorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    gap: tokens.spacingHorizontalM,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  mirrorRowSelected: {
    border: `1px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  mirrorInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  mirrorMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  mirrorLatency: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  toolbarRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  addMirrorForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
})

interface EngineFile {
  name: string
  size: number
  path: string
  modified: number
  deviceType: DeviceType
  cpuVariant?: 'avx2' | 'avx' | 'avx512' | 'noavx'
}

type CpuVariant = 'avx2' | 'avx' | 'avx512' | 'noavx'

interface CpuVariantInfo {
  variant: CpuVariant
  label: string
  totalSize: number
  hasFiles: boolean
}

interface EngineSummary {
  type: DeviceType
  label: string
  hasFiles: boolean
  fileCount: number
  cpuVariants?: CpuVariantInfo[]
  cudaRuntime?: {
    hasFiles: boolean
    totalSize: number
  }
  totalSize: number
  version: string | null
}

function getAssetLabel(asset: SDCppReleaseAsset): string {
  if (asset.deviceType === 'cuda-runtime') return 'CUDA Runtime'
  if (asset.deviceType === 'cuda') return 'CUDA 12'
  if (asset.deviceType === 'vulkan') return 'Vulkan'
  if (asset.deviceType === 'rocm') return 'ROCm'
  if (asset.cpuVariant === 'avx2') return 'CPU (AVX2)'
  if (asset.cpuVariant === 'avx') return 'CPU (AVX)'
  if (asset.cpuVariant === 'avx512') return 'CPU (AVX512)'
  if (asset.cpuVariant === 'noavx') return 'CPU (无AVX)'
  return 'CPU'
}

function getAssetBadgeColor(asset: SDCppReleaseAsset): 'brand' | 'success' | 'warning' | 'informative' {
  if (asset.deviceType === 'cuda-runtime' || asset.deviceType === 'cuda') return 'success'
  if (asset.deviceType === 'vulkan') return 'brand'
  if (asset.deviceType === 'rocm') return 'warning'
  return 'informative'
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return ''
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

function formatReleaseLabel(release: SDCppRelease): string {
  return `${release.name} (${new Date(release.publishedAt).toLocaleDateString('zh-CN')})`
}

function getMirrorSubtitle(mirror: MirrorSource): string {
  return mirror.type === 'github' ? 'GitHub 直连' : mirror.url
}

export const SDCppPage = () => {
  const styles = useStyles()

  const [engineFolder, setEngineFolder] = useState<string>('')
  const [engineFolderInput, setEngineFolderInput] = useState<string>('')
  const [files, setFiles] = useState<EngineFile[]>([])
  const [deviceVersions, setDeviceVersions] = useState<Record<DeviceType, string | null>>({
    cpu: null,
    vulkan: null,
    cuda: null,
    rocm: null,
  })
  const [loading, setLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  const [releases, setReleases] = useState<SDCppRelease[]>([])
  const [selectedRelease, setSelectedRelease] = useState<SDCppRelease | null>(null)
  const [loadingReleases, setLoadingReleases] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<SDCppDownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [mirrors, setMirrors] = useState<MirrorSource[]>([])
  const [selectedMirrorId, setSelectedMirrorId] = useState<string>('github')
  const [mirrorTestResults, setMirrorTestResults] = useState<Record<string, MirrorTestResult>>({})
  const [testingMirrors, setTestingMirrors] = useState(false)

  const [addMirrorOpen, setAddMirrorOpen] = useState(false)
  const [newMirrorName, setNewMirrorName] = useState('')
  const [newMirrorUrl, setNewMirrorUrl] = useState('')

  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [messageDialogContent, setMessageDialogContent] = useState<{ title: string; message: string } | null>(null)

  const { setProgress, clearProgress, setIndeterminate } = useTaskbarProgress()
  const loadFilesRef = useRef<() => Promise<void>>(undefined)

  useEffect(() => {
    const initialize = async () => {
      await loadEngineFolder().catch(console.error)
      await loadMirrors().catch(console.error)
      setIsInitialized(true)
    }

    initialize()
  }, [])

  useEffect(() => {
    if (isInitialized && engineFolder) {
      loadFiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineFolder, isInitialized])

  useEffect(() => {
    loadFilesRef.current = loadFiles
  })

  useIpcListener('sdcpp:download-progress', (data) => {
    setDownloadProgress(data)

    if (data.stage === 'downloading' || data.stage === 'extracting') {
      if (data.totalBytes > 0) {
        setProgress((data.downloadedBytes / data.totalBytes) * 100)
      } else {
        setIndeterminate()
      }
    } else if (data.stage === 'done') {
      clearProgress()
      setTimeout(() => {
        loadFilesRef.current?.()
        setDownloadProgress(null)
      }, 1500)
    } else if (data.stage === 'error') {
      clearProgress()
      setDownloadError(data.error || '下载失败')
    }
  })

  const loadEngineFolder = async () => {
    try {
      let folder = await ipcInvoke('sdcpp:get-folder')
      if (!folder) {
        folder = await ipcInvoke('sdcpp:init-default-folder')
      }
      if (folder) {
        setEngineFolder(folder)
        setEngineFolderInput(folder)
      }
    } catch (error) {
      console.error('Failed to load engine folder:', error)
    }
  }

  const loadFiles = async () => {
    if (!engineFolder) return

    setLoading(true)
    try {
      const deviceTypes: DeviceType[] = ['cpu', 'vulkan', 'cuda', 'rocm']
      const allFilesPromises = deviceTypes.map(async (deviceType) => {
        try {
          const result = await ipcInvoke('sdcpp:list-files', engineFolder, deviceType)
          const deviceFiles = (result?.files || []).map((file: Omit<EngineFile, 'deviceType'>) => ({
            ...file,
            deviceType,
          }))
          return { files: deviceFiles, version: result?.version || null, deviceType }
        } catch (error) {
          console.error(`Failed to load files for ${deviceType}:`, error)
          return { files: [], version: null, deviceType }
        }
      })

      const results = await Promise.all(allFilesPromises)
      const allFiles = results.flatMap((result) => result.files)
      const versions: Record<DeviceType, string | null> = {
        cpu: null,
        vulkan: null,
        cuda: null,
        rocm: null,
      }

      results.forEach((result) => {
        versions[result.deviceType] = result.version
      })
      allFiles.sort((a, b) => b.modified - a.modified)

      setFiles(allFiles)
      setDeviceVersions(versions)
    } catch (error) {
      console.error('Failed to load file list:', error)
      setFiles([])
      setDeviceVersions({ cpu: null, vulkan: null, cuda: null, rocm: null })
    } finally {
      setLoading(false)
    }
  }

  const handleSetFolder = async () => {
    const nextFolder = engineFolderInput.trim()

    if (!nextFolder) {
      setMessageDialogContent({ title: '提示', message: '请输入有效的文件夹路径' })
      setMessageDialogOpen(true)
      return
    }

    const exists = await ipcInvoke('sdcpp:check-folder', nextFolder)
    if (!exists) {
      setMessageDialogContent({ title: '错误', message: '文件夹不存在，请检查路径是否正确' })
      setMessageDialogOpen(true)
      return
    }

    const setResult = await ipcInvoke('sdcpp:set-folder', nextFolder)
    if (!setResult) {
      setMessageDialogContent({ title: '错误', message: '设置文件夹路径失败，请重试' })
      setMessageDialogOpen(true)
      return
    }

    setEngineFolder(nextFolder)
    setEngineFolderInput(nextFolder)
  }

  const handleFolderPathChange = (value: string) => {
    setEngineFolderInput(value)
  }

  const loadMirrors = async () => {
    try {
      const result = await ipcInvoke('sdcpp:get-mirrors')
      setMirrors(result)
    } catch (error) {
      console.error('Failed to load mirrors:', error)
    }
  }

  const fetchReleaseList = useCallback(async () => {
    setLoadingReleases(true)
    setDownloadError(null)

    try {
      const result = await ipcInvoke('sdcpp:fetch-releases', {
        mirrorId: selectedMirrorId,
        count: 10,
      })
      setReleases(result)
      setSelectedRelease((previous) => {
        if (result.length === 0) return null
        if (!previous) return result[0]
        return result.find((release) => release.tagName === previous.tagName) ?? result[0]
      })
    } catch (error: unknown) {
      console.error('Failed to fetch releases:', error)
      const errorMsg = error instanceof Error ? error.message : String(error || '未知错误')
      setDownloadError(`获取版本列表失败: ${errorMsg}`)
    } finally {
      setLoadingReleases(false)
    }
  }, [selectedMirrorId])

  const handleDownload = useCallback(
    async (asset: SDCppReleaseAsset) => {
      if (!selectedRelease) return

      setDownloadError(null)
      setDownloadProgress({
        stage: 'downloading',
        downloadedBytes: 0,
        totalBytes: asset.size,
        speed: 0,
        fileName: asset.name,
      })

      try {
        const result = await ipcInvoke('sdcpp:download-engine', {
          asset,
          release: selectedRelease,
          mirrorId: selectedMirrorId,
        })

        if (!result.success) {
          setDownloadError(result.error || '下载失败')
          setDownloadProgress(null)
        }
      } catch (error: unknown) {
        setDownloadError(error instanceof Error ? error.message : '下载失败')
        setDownloadProgress(null)
      }
    },
    [selectedMirrorId, selectedRelease],
  )

  const handleCancelDownload = useCallback(async () => {
    try {
      await ipcInvoke('sdcpp:cancel-download')
      setDownloadProgress(null)
    } catch (error) {
      console.error('Failed to cancel download:', error)
    }
  }, [])

  const handleTestMirrors = useCallback(async () => {
    setTestingMirrors(true)
    try {
      const results = await ipcInvoke('sdcpp:test-mirrors')
      const resultMap: Record<string, MirrorTestResult> = {}
      results.forEach((result) => {
        resultMap[result.mirrorId] = result
      })
      setMirrorTestResults(resultMap)
    } catch (error) {
      console.error('Failed to test mirrors:', error)
    } finally {
      setTestingMirrors(false)
    }
  }, [])

  const handleAutoSelectMirror = useCallback(async () => {
    setTestingMirrors(true)
    try {
      const best = await ipcInvoke('sdcpp:auto-select-mirror')
      setSelectedMirrorId(best.id)
      await handleTestMirrors()
    } catch (error) {
      console.error('Failed to auto-select mirror:', error)
    } finally {
      setTestingMirrors(false)
    }
  }, [handleTestMirrors])

  const handleAddMirror = useCallback(async () => {
    if (!newMirrorName || !newMirrorUrl) return

    try {
      const mirror = await ipcInvoke('sdcpp:add-mirror', {
        name: newMirrorName,
        type: 'proxy' as const,
        url: newMirrorUrl.replace(/\/+$/, ''),
        proxyApi: false,
      })
      setMirrors((previous) => [...previous, mirror])
      setSelectedMirrorId(mirror.id)
      setNewMirrorName('')
      setNewMirrorUrl('')
      setAddMirrorOpen(false)
    } catch (error) {
      console.error('Failed to add mirror:', error)
    }
  }, [newMirrorName, newMirrorUrl])

  const handleRemoveMirror = useCallback(
    async (mirrorId: string) => {
      try {
        await ipcInvoke('sdcpp:remove-mirror', mirrorId)
        setMirrors((previous) => previous.filter((mirror) => mirror.id !== mirrorId))
        if (selectedMirrorId === mirrorId) {
          setSelectedMirrorId('github')
        }
      } catch (error) {
        console.error('Failed to remove mirror:', error)
      }
    },
    [selectedMirrorId],
  )

  const cpuVariantLabels: Record<CpuVariant, string> = {
    avx2: 'AVX2',
    avx: 'AVX',
    avx512: 'AVX512',
    noavx: '无AVX',
  }

  const engineSummaries: EngineSummary[] = (['cpu', 'vulkan', 'cuda', 'rocm'] as const).map((deviceType) => {
    const deviceFiles = files.filter((file) => file.deviceType === deviceType)

    if (deviceType === 'cpu') {
      const cpuVariants: CpuVariant[] = ['avx2', 'avx512', 'avx', 'noavx']
      return {
        type: deviceType,
        label: 'CPU',
        hasFiles: deviceFiles.length > 0,
        fileCount: deviceFiles.length,
        cpuVariants: cpuVariants.map((variant) => {
          const variantFiles = deviceFiles.filter((file) => file.cpuVariant === variant)
          return {
            variant,
            label: cpuVariantLabels[variant],
            totalSize: variantFiles.reduce((sum, file) => sum + file.size, 0),
            hasFiles: variantFiles.length > 0,
          }
        }),
        totalSize: deviceFiles.reduce((sum, file) => sum + file.size, 0),
        version: deviceVersions.cpu,
      }
    }

    if (deviceType === 'cuda') {
      const cudaRuntimeFiles = ['cudart64', 'cublas64', 'cublasLt64']
      const cudartFiles = deviceFiles.filter((file) => {
        const lowerName = file.name.toLowerCase()
        return cudaRuntimeFiles.some((runtime) => lowerName.includes(runtime.toLowerCase()))
      })

      return {
        type: deviceType,
        label: 'CUDA',
        hasFiles: deviceFiles.length > 0,
        fileCount: deviceFiles.length,
        cudaRuntime: {
          hasFiles: cudartFiles.length > 0,
          totalSize: cudartFiles.reduce((sum, file) => sum + file.size, 0),
        },
        totalSize: deviceFiles.reduce((sum, file) => sum + file.size, 0),
        version: deviceVersions.cuda,
      }
    }

    return {
      type: deviceType,
      label: getDeviceLabel(deviceType),
      hasFiles: deviceFiles.length > 0,
      fileCount: deviceFiles.length,
      totalSize: deviceFiles.reduce((sum, file) => sum + file.size, 0),
      version: deviceVersions[deviceType],
    }
  })

  const getMirrorStatusText = (testResult?: MirrorTestResult) => {
    if (!testResult) return '未测速'
    if (!testResult.success) return '不可用'
    return `${testResult.latency ?? '--'}ms`
  }

  const getMirrorStatusColor = (testResult?: MirrorTestResult) => {
    if (!testResult) return tokens.colorNeutralForeground3
    if (!testResult.success) return tokens.colorPaletteRedForeground1
    return (testResult.latency ?? Number.POSITIVE_INFINITY) < 1000
      ? tokens.colorPaletteGreenForeground1
      : tokens.colorPaletteYellowForeground1
  }

  const isDownloading =
    downloadProgress !== null && downloadProgress.stage !== 'done' && downloadProgress.stage !== 'error'
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const installedEngineCount = engineSummaries.filter((summary) => summary.hasFiles).length
  const selectedMirror = mirrors.find((mirror) => mirror.id === selectedMirrorId) ?? null
  const selectedMirrorResult = selectedMirror ? mirrorTestResults[selectedMirror.id] : undefined
  const selectedMirrorStatusText = getMirrorStatusText(selectedMirrorResult)
  const selectedReleaseLabel = selectedRelease ? formatReleaseLabel(selectedRelease) : ''
  const activeTaskLabel = downloadProgress
    ? downloadProgress.stage === 'extracting'
      ? '解压中'
      : downloadProgress.stage === 'done'
        ? '已完成'
        : downloadProgress.stage === 'error'
          ? '失败'
          : '下载中'
    : '空闲'

  return (
    <div className={`${styles.container} pencil-page`}>
      <header className="pencil-page-header">
        <div className="pencil-page-title-row">
          <Title1 className="pencil-page-title">SD.cpp 推理引擎</Title1>
          <span className="pencil-page-kicker">ENGINE</span>
        </div>
        <Body1 className="pencil-page-description">
          用更统一的工作台管理引擎目录、安装状态、版本下载和镜像策略，常用操作保持简洁，高级能力按需展开。
        </Body1>
      </header>

      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <div>
            <Title2>概览</Title2>
            <Body2 className={styles.sectionDescription}>
              把引擎管理收拢为一条清晰路径：先确认目录与安装状态，再选择下载源和版本，最后在高级配置里处理镜像策略。
            </Body2>
          </div>
          {loading && files.length > 0 ? (
            <div className={styles.quickActionRow}>
              <Spinner />
              <Caption1 className={styles.helperText}>正在刷新扫描结果</Caption1>
            </div>
          ) : null}
        </div>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewCard}>
            <span className={styles.overviewLabel}>已安装设备</span>
            <span className={styles.overviewValue}>
              {installedEngineCount}/{engineSummaries.length}
            </span>
            <span className={styles.overviewMeta}>覆盖 CPU / Vulkan / CUDA / ROCm</span>
          </div>
          <div className={styles.overviewCard}>
            <span className={styles.overviewLabel}>引擎文件数</span>
            <span className={styles.overviewValue}>{files.length}</span>
            <span className={styles.overviewMeta}>{loading ? '正在重新扫描' : '已完成目录扫描'}</span>
          </div>
          <div className={styles.overviewCard}>
            <span className={styles.overviewLabel}>占用空间</span>
            <span className={styles.overviewValue}>{files.length > 0 ? formatFileSize(totalSize) : '0 B'}</span>
            <span className={styles.overviewMeta}>{engineFolder ? '已纳入当前引擎目录' : '等待初始化默认目录'}</span>
          </div>
          <div className={styles.overviewCard}>
            <span className={styles.overviewLabel}>当前下载源</span>
            <span className={styles.overviewValue}>{selectedMirror?.name || '未选择'}</span>
            <span className={styles.overviewMeta}>连接状态：{selectedMirrorStatusText}</span>
          </div>
          <div className={styles.overviewCard}>
            <span className={styles.overviewLabel}>版本列表</span>
            <span className={styles.overviewValue}>{releases.length > 0 ? releases.length : '未获取'}</span>
            <span className={styles.overviewMeta}>
              {selectedRelease ? selectedReleaseLabel : '点击下方按钮获取可用版本'}
            </span>
          </div>
        </div>
      </Card>

      <div className={styles.topGrid}>
        <Card className={styles.section}>
          <div className={styles.cardHeader}>
            <div>
              <Title2 style={{ fontSize: tokens.fontSizeBase500 }}>引擎目录</Title2>
              <Body2 className={styles.sectionDescription}>
                默认使用应用数据目录下的 `engines/sdcpp`，也支持切换到自定义目录并立即重新扫描。
              </Body2>
            </div>
            <Button
              icon={<ArrowSyncRegular />}
              appearance="subtle"
              onClick={loadFiles}
              disabled={loading || !engineFolder}
            >
              {loading ? '扫描中...' : '刷新扫描'}
            </Button>
          </div>

          <div className={styles.folderControls}>
            <div className={styles.folderInputRow}>
              <Field label="引擎文件夹路径" style={{ flex: 1, minWidth: 280 }}>
                <Input
                  value={engineFolderInput}
                  onChange={(_, data) => handleFolderPathChange((data as { value: string }).value)}
                  placeholder="默认使用应用数据目录下的 engines/sdcpp 文件夹"
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') {
                      handleSetFolder()
                    }
                  }}
                />
              </Field>
              <Button
                onClick={handleSetFolder}
                appearance="primary"
                disabled={!engineFolderInput.trim() || loading || engineFolderInput.trim() === engineFolder}
              >
                应用路径
              </Button>
            </div>
            <Caption1 className={styles.helperText}>
              {engineFolder ? `当前路径: ${engineFolder}` : '尚未设置路径，将自动初始化默认目录。'}
            </Caption1>
            <Caption1 className={styles.helperText}>
              系统会按 `cpu / vulkan / cuda / rocm` 子目录扫描，并自动识别 CPU 变体与 CUDA Runtime 文件。
            </Caption1>
          </div>
        </Card>

        <Card className={styles.section}>
          <div className={styles.cardHeader}>
            <div>
              <Title2 style={{ fontSize: tokens.fontSizeBase500 }}>下载策略</Title2>
              <Body2 className={styles.sectionDescription}>
                常用层只保留当前下载源与自动选择，测速、添加、删除镜像等高级能力集中到下方折叠区。
              </Body2>
            </div>
            <Button
              icon={<TopSpeedRegular />}
              appearance="subtle"
              onClick={handleAutoSelectMirror}
              disabled={testingMirrors || mirrors.length === 0}
            >
              {testingMirrors ? '测速中...' : '自动选择'}
            </Button>
          </div>

          <div className={styles.controlGrid}>
            <Field label="当前下载源" style={{ minWidth: 240 }}>
              <Dropdown
                value={selectedMirror?.name || '请选择下载源'}
                selectedOptions={selectedMirror ? [selectedMirror.id] : []}
                onOptionSelect={(_, data) => {
                  const optionValue = (data as { optionValue?: string }).optionValue
                  if (optionValue) {
                    setSelectedMirrorId(optionValue)
                  }
                }}
              >
                {mirrors.map((mirror) => (
                  <Option key={mirror.id} value={mirror.id} text={mirror.name}>
                    {mirror.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            <div className={styles.statusCard}>
              <div className={styles.engineInfoRow}>
                <span className={styles.infoLabel}>镜像状态</span>
                <span className={styles.mirrorLatency} style={{ color: getMirrorStatusColor(selectedMirrorResult) }}>
                  {selectedMirrorStatusText}
                </span>
              </div>
              <div className={styles.engineInfoRow}>
                <span className={styles.infoLabel}>来源类型</span>
                <span className={styles.infoValue}>
                  {selectedMirror ? (selectedMirror.type === 'github' ? '直连' : '代理镜像') : '未设置'}
                </span>
              </div>
              <Caption1 className={styles.helperText}>
                {selectedMirror ? getMirrorSubtitle(selectedMirror) : '请选择一个下载源以获取 Release 列表。'}
              </Caption1>
            </div>
          </div>
        </Card>
      </div>

      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <div>
            <Title2>安装状态</Title2>
            <Body2 className={styles.sectionDescription}>
              每种设备类型只保留核心信息：安装状态、版本、文件数和占用空间；更细的变体信息以内嵌细节呈现。
            </Body2>
          </div>
        </div>

        {loading && files.length === 0 ? (
          <div className={styles.emptyState}>
            <Spinner />
            <Body1>正在扫描本地引擎文件...</Body1>
          </div>
        ) : (
          <div className={styles.summaryGrid}>
            {engineSummaries.map((summary) => (
              <Card className={styles.engineCard} key={summary.type}>
                <div className={styles.engineCardHeader}>
                  <div>
                    <Title3>{summary.label}</Title3>
                    <Body2 className={styles.sectionDescription}>
                      {summary.version ? `版本 ${summary.version}` : '未检测到版本信息'}
                    </Body2>
                  </div>
                  <Badge appearance={summary.hasFiles ? 'filled' : 'outline'}>
                    {summary.hasFiles ? '已安装' : '未安装'}
                  </Badge>
                </div>

                <div className={styles.detailCard}>
                  <div className={styles.engineInfoRow}>
                    <span className={styles.infoLabel}>文件数</span>
                    <span className={styles.infoValue}>{summary.fileCount}</span>
                  </div>
                  <div className={styles.engineInfoRow}>
                    <span className={styles.infoLabel}>占用空间</span>
                    <span className={styles.infoValue}>
                      {summary.hasFiles ? formatFileSize(summary.totalSize) : '—'}
                    </span>
                  </div>
                </div>

                {summary.type === 'cpu' && summary.cpuVariants ? (
                  <div className={styles.detailCard}>
                    <Body2 style={{ fontWeight: tokens.fontWeightSemibold }}>CPU 变体</Body2>
                    {summary.cpuVariants.map((variant) => (
                      <div className={styles.engineInfoRow} key={variant.variant}>
                        <span className={styles.infoLabel}>{variant.label}</span>
                        <span className={styles.infoValue}>
                          {variant.hasFiles ? formatFileSize(variant.totalSize) : '未安装'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {summary.type === 'cuda' && summary.cudaRuntime ? (
                  <div className={styles.detailCard}>
                    <Body2 style={{ fontWeight: tokens.fontWeightSemibold }}>CUDA 组成</Body2>
                    <div className={styles.engineInfoRow}>
                      <span className={styles.infoLabel}>CUDA 引擎</span>
                      <span className={styles.infoValue}>
                        {formatFileSize(summary.totalSize - summary.cudaRuntime.totalSize)}
                      </span>
                    </div>
                    <div className={styles.engineInfoRow}>
                      <span className={styles.infoLabel}>CUDA Runtime</span>
                      <span className={styles.infoValue}>
                        {summary.cudaRuntime.hasFiles ? formatFileSize(summary.cudaRuntime.totalSize) : '未安装'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className={styles.downloadSection}>
        <div className={styles.cardHeader}>
          <div>
            <Title2>版本与下载</Title2>
            <Body2 className={styles.sectionDescription}>
              先获取版本列表，再选择具体资源下载并自动安装。下载进行中时会显示进度、速度和可取消操作。
            </Body2>
          </div>
          <Button
            icon={<ArrowSyncRegular />}
            appearance="primary"
            onClick={fetchReleaseList}
            disabled={loadingReleases || isDownloading || !selectedMirror}
          >
            {loadingReleases ? '获取中...' : '获取版本列表'}
          </Button>
        </div>

        {downloadError ? (
          <MessageBar intent="error">
            <MessageBarBody>{downloadError}</MessageBarBody>
          </MessageBar>
        ) : null}

        {downloadProgress && downloadProgress.stage !== 'done' && downloadProgress.stage !== 'error' ? (
          <div className={styles.progressContainer}>
            <div className={styles.progressInfo}>
              <Body2 style={{ fontWeight: tokens.fontWeightSemibold }}>
                {downloadProgress.stage === 'downloading' ? '正在下载' : '正在解压'}: {downloadProgress.fileName}
              </Body2>
              <Button appearance="subtle" size="small" icon={<DismissRegular />} onClick={handleCancelDownload}>
                取消
              </Button>
            </div>
            <ProgressBar
              value={
                downloadProgress.totalBytes > 0
                  ? downloadProgress.downloadedBytes / downloadProgress.totalBytes
                  : undefined
              }
              max={1}
            />
            <div className={styles.progressInfo}>
              <Caption1 className={styles.helperText}>
                {formatFileSize(downloadProgress.downloadedBytes)} / {formatFileSize(downloadProgress.totalBytes)}
              </Caption1>
              <Caption1 className={styles.helperText}>{formatSpeed(downloadProgress.speed)}</Caption1>
            </div>
          </div>
        ) : null}

        {loadingReleases ? (
          <div className={styles.quickActionRow}>
            <Spinner />
            <Body1>正在获取版本列表...</Body1>
          </div>
        ) : null}

        {!loadingReleases && releases.length === 0 ? (
          <MessageBar intent="info">
            <MessageBarBody>尚未获取到可用版本。确认下载源后，点击“获取版本列表”即可开始选择安装包。</MessageBarBody>
          </MessageBar>
        ) : null}

        {releases.length > 0 ? (
          <div className={styles.section}>
            <div className={styles.releaseToolbar}>
              <Field label="版本" style={{ flex: 1, minWidth: 320 }}>
                <Dropdown
                  value={selectedReleaseLabel}
                  selectedOptions={selectedRelease ? [selectedRelease.tagName] : []}
                  onOptionSelect={(_, data) => {
                    const optionValue = (data as { optionValue?: string }).optionValue
                    const release = releases.find((item) => item.tagName === optionValue)
                    if (release) {
                      setSelectedRelease(release)
                    }
                  }}
                >
                  {releases.map((release) => {
                    const label = formatReleaseLabel(release)
                    return (
                      <Option key={release.tagName} value={release.tagName} text={label}>
                        {label}
                      </Option>
                    )
                  })}
                </Dropdown>
              </Field>
              <div className={styles.releaseMeta}>
                <Badge appearance="outline">状态：{activeTaskLabel}</Badge>
                <Badge appearance="outline">资源：{selectedRelease?.assets.length ?? 0}</Badge>
                <Badge appearance="outline">来源：{selectedMirror?.name || '未选择'}</Badge>
              </div>
            </div>

            {selectedRelease ? (
              <>
                <Body2 className={styles.sectionDescription}>
                  当前版本发布时间：{new Date(selectedRelease.publishedAt).toLocaleDateString('zh-CN')}
                  。下载后将按设备类型自动解压到对应子目录。
                </Body2>
                <div className={styles.assetGrid}>
                  {selectedRelease.assets.map((asset) => (
                    <div className={styles.assetCard} key={asset.name}>
                      <div className={styles.assetHeader}>
                        <Badge color={getAssetBadgeColor(asset)} appearance="filled">
                          {getAssetLabel(asset)}
                        </Badge>
                        <Caption1 className={styles.helperText}>{formatFileSize(asset.size)}</Caption1>
                      </div>
                      <Caption1 className={styles.helperText}>{asset.name}</Caption1>
                      <Button
                        icon={<ArrowDownloadRegular />}
                        appearance="primary"
                        size="small"
                        onClick={() => handleDownload(asset)}
                        disabled={isDownloading}
                        style={{ alignSelf: 'flex-end' }}
                      >
                        下载并安装
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className={styles.section}>
        <Accordion>
          <AccordionItem value="advanced">
            <AccordionHeader icon={<PlugConnectedRegular />}>高级配置与镜像管理</AccordionHeader>
            <AccordionPanel>
              <div className={styles.advancedGrid}>
                <div className={styles.section}>
                  <div className={styles.cardHeader}>
                    <div>
                      <Title3>镜像源列表</Title3>
                      <Body2 className={styles.sectionDescription}>
                        保留测速、添加、删除自定义镜像等高级能力，但不干扰日常下载流程。
                      </Body2>
                    </div>
                    <div className={styles.toolbarRow}>
                      <Button
                        icon={<PlugConnectedRegular />}
                        appearance="subtle"
                        onClick={handleTestMirrors}
                        disabled={testingMirrors || mirrors.length === 0}
                      >
                        {testingMirrors ? '测速中...' : '测试全部'}
                      </Button>
                      <Dialog
                        open={addMirrorOpen}
                        onOpenChange={(_, data) => setAddMirrorOpen((data as { open: boolean }).open)}
                      >
                        <DialogTrigger disableButtonEnhancement>
                          <Button icon={<AddRegular />} appearance="subtle">
                            添加镜像
                          </Button>
                        </DialogTrigger>
                        <DialogSurface>
                          <DialogBody>
                            <DialogTitle>添加自定义镜像源</DialogTitle>
                            <DialogContent>
                              <div className={styles.addMirrorForm}>
                                <Field label="名称" required>
                                  <Input
                                    value={newMirrorName}
                                    onChange={(_, data) => setNewMirrorName((data as { value: string }).value)}
                                    placeholder="例：我的镜像站"
                                  />
                                </Field>
                                <Field label="代理 URL" required>
                                  <Input
                                    value={newMirrorUrl}
                                    onChange={(_, data) => setNewMirrorUrl((data as { value: string }).value)}
                                    placeholder="例：https://ghfast.top"
                                  />
                                </Field>
                                <Caption1 className={styles.helperText}>
                                  代理镜像采用前缀拼接模式，实际下载地址会组合为：代理URL/原始 GitHub 下载地址。
                                </Caption1>
                              </div>
                            </DialogContent>
                            <DialogActions>
                              <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary">取消</Button>
                              </DialogTrigger>
                              <Button
                                appearance="primary"
                                onClick={handleAddMirror}
                                disabled={!newMirrorName || !newMirrorUrl}
                              >
                                添加
                              </Button>
                            </DialogActions>
                          </DialogBody>
                        </DialogSurface>
                      </Dialog>
                    </div>
                  </div>

                  <div className={styles.mirrorList}>
                    {mirrors.map((mirror) => {
                      const testResult = mirrorTestResults[mirror.id]
                      const isSelected = selectedMirrorId === mirror.id
                      return (
                        <div
                          key={mirror.id}
                          className={`${styles.mirrorRow} ${isSelected ? styles.mirrorRowSelected : ''}`}
                          onClick={() => setSelectedMirrorId(mirror.id)}
                        >
                          <div className={styles.mirrorInfo}>
                            {isSelected ? (
                              <CheckmarkCircleFilled style={{ color: tokens.colorBrandForeground1 }} />
                            ) : (
                              <GlobeRegular />
                            )}
                            <div className={styles.mirrorMeta}>
                              <Body1 style={{ fontWeight: isSelected ? tokens.fontWeightSemibold : undefined }}>
                                {mirror.name}
                              </Body1>
                              <Caption1 className={styles.helperText}>{getMirrorSubtitle(mirror)}</Caption1>
                            </div>
                          </div>
                          <div className={styles.mirrorInfo}>
                            <span className={styles.mirrorLatency} style={{ color: getMirrorStatusColor(testResult) }}>
                              {getMirrorStatusText(testResult)}
                            </span>
                            {!mirror.builtin ? (
                              <Button
                                icon={<DismissRegular />}
                                appearance="subtle"
                                size="small"
                                onClick={(event) => {
                                  ;(event as { stopPropagation?: () => void }).stopPropagation?.()
                                  handleRemoveMirror(mirror.id)
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className={styles.section}>
                  <Title3>当前策略说明</Title3>
                  <div className={styles.detailCard}>
                    <div className={styles.engineInfoRow}>
                      <span className={styles.infoLabel}>选中镜像</span>
                      <span className={styles.infoValue}>{selectedMirror?.name || '未选择'}</span>
                    </div>
                    <div className={styles.engineInfoRow}>
                      <span className={styles.infoLabel}>测速结果</span>
                      <span className={styles.infoValue} style={{ color: getMirrorStatusColor(selectedMirrorResult) }}>
                        {selectedMirrorStatusText}
                      </span>
                    </div>
                    <div className={styles.engineInfoRow}>
                      <span className={styles.infoLabel}>镜像类型</span>
                      <span className={styles.infoValue}>
                        {selectedMirror ? (selectedMirror.type === 'github' ? '官方直连' : '自定义代理') : '未设置'}
                      </span>
                    </div>
                    <Caption1 className={styles.helperText}>
                      {selectedMirror ? getMirrorSubtitle(selectedMirror) : '先在上方选择一个可用镜像。'}
                    </Caption1>
                  </div>

                  <div className={styles.detailCard}>
                    <Body2 style={{ fontWeight: tokens.fontWeightSemibold }}>使用建议</Body2>
                    <Caption1 className={styles.helperText}>
                      • 目录扫描按设备类型拆分，便于后续维护和定位安装结果。
                    </Caption1>
                    <Caption1 className={styles.helperText}>
                      • CPU 资源会进一步细分为 AVX2 / AVX512 / AVX / 无 AVX 变体。
                    </Caption1>
                    <Caption1 className={styles.helperText}>
                      • CUDA 页面会单独展示 Runtime 依赖，方便确认运行库是否齐全。
                    </Caption1>
                    <Caption1 className={styles.helperText}>
                      • 如果网络波动明显，建议先在这里测速，再回到上方获取版本列表。
                    </Caption1>
                  </div>
                </div>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </Card>

      <MessageDialog
        open={messageDialogOpen}
        title={messageDialogContent?.title || ''}
        message={messageDialogContent?.message || ''}
        onClose={() => setMessageDialogOpen(false)}
      />
    </div>
  )
}
