import {
  BgColorsOutlined,
  CloudDownloadOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, Card, Descriptions, Segmented, Select, Space, Spin, Tabs, Tag, Typography, theme } from 'antd'
import { settingsService } from '@/features/settings/services/settingsService'
import { makeStyles } from '@/ui/components'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppStore, type ThemeMode } from '../hooks/useAppStore'
import { useDownloadConfig } from '../hooks/useDownloadConfig'

const { Title, Paragraph, Text } = Typography

const THEME_OPTIONS = [
  {
    label: (
      <Space size={6}>
        <SunOutlined />
        浅色
      </Space>
    ),
    value: 'light',
  },
  {
    label: (
      <Space size={6}>
        <MoonOutlined />
        深色
      </Space>
    ),
    value: 'dark',
  },
] satisfies Array<{ label: ReactNode; value: ThemeMode }>

const CHUNK_SIZE_OPTIONS = [5, 10, 20, 50, 100].map((value) => ({
  label: `${value} MB`,
  value,
}))

const MAX_CONCURRENT_OPTIONS = [1, 2, 4, 8, 16].map((value) => ({
  label: String(value),
  value,
}))

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: '960px',
    margin: '0 auto',
    minHeight: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  title: {
    margin: '0 !important',
    color: 'var(--app-text) !important',
  },
  description: {
    margin: '0 !important',
    maxWidth: '720px',
    color: 'var(--app-text-muted) !important',
    fontSize: 14,
    lineHeight: 1.7,
  },
  tabsCard: {
    '& .ant-card-body': {
      padding: '0 24px 24px',
      '@media (max-width: 768px)': {
        padding: '0 16px 16px',
      },
    },
    '& .ant-tabs-nav': {
      margin: 0,
      paddingTop: 4,
    },
    '& .ant-tabs-tab': {
      paddingTop: 16,
      paddingBottom: 16,
    },
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    paddingTop: 8,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 240px',
    gap: 20,
    alignItems: 'center',
    padding: '18px 0',
    borderBottom: '1px solid var(--app-border)',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
      gap: 12,
      alignItems: 'stretch',
    },
  },
  rowLast: {
    borderBottom: 'none',
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--app-text)',
    lineHeight: 1.4,
  },
  rowControl: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minWidth: 0,
    '@media (max-width: 768px)': {
      justifyContent: 'flex-start',
    },
  },
  note: {
    marginTop: 16,
    color: 'var(--app-text-muted)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  controlFull: {
    width: '100%',
    maxWidth: 240,
    '@media (max-width: 768px)': {
      maxWidth: 'none',
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    paddingTop: 16,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 0 24px',
  },
  aboutBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    paddingTop: 8,
  },
  aboutTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
})

type SettingsRowProps = {
  control: ReactNode
  description?: string
  last?: boolean
  title: string
}

const SettingsRow = ({ control, description, last = false, title }: SettingsRowProps) => {
  const styles = useStyles()

  return (
    <div className={`${styles.row} ${last ? styles.rowLast : ''}`}>
      <div className={styles.rowMain}>
        <Text className={styles.rowTitle}>{title}</Text>
        {description ? (
          <Paragraph style={{ margin: '0 !important', color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.65 }}>
            {description}
          </Paragraph>
        ) : null}
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  )
}

export const SettingsPage = () => {
  const styles = useStyles()
  const { token } = theme.useToken()
  const { themeMode, setThemeMode } = useAppStore()
  const { config: downloadConfig, isLoading: configLoading, loadConfig, setConfig } = useDownloadConfig()
  const [devToolsOpen, setDevToolsOpen] = useState<boolean | null>(null)
  const [devToolsLoading, setDevToolsLoading] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [chunkSizeMb, setChunkSizeMb] = useState(10)
  const [maxConcurrentChunks, setMaxConcurrentChunks] = useState(4)

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const version = await settingsService.getAppVersion()
        setAppVersion(version || '')
      } catch (error) {
        console.error('Failed to load app version:', error)
        setAppVersion('')
      }
    }

    loadVersion()
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!downloadConfig) {
      return
    }

    setChunkSizeMb(downloadConfig.chunkSizeMb)
    setMaxConcurrentChunks(downloadConfig.maxConcurrentChunks)
  }, [downloadConfig])

  const themeLabel = themeMode === 'dark' ? '深色' : '浅色'
  const versionLabel = appVersion ? `v${appVersion}` : '未读取'

  const isDownloadDirty = useMemo(() => {
    if (!downloadConfig) {
      return false
    }

    return chunkSizeMb !== downloadConfig.chunkSizeMb || maxConcurrentChunks !== downloadConfig.maxConcurrentChunks
  }, [chunkSizeMb, downloadConfig, maxConcurrentChunks])

  const handleSaveDownloadConfig = async () => {
    try {
      await setConfig({
        chunkSizeMb,
        maxConcurrentChunks,
      })
    } catch (error) {
      console.error('Failed to save download config:', error)
    }
  }

  const handleToggleDevtools = async () => {
    try {
      setDevToolsLoading(true)
      const result = await settingsService.toggleDevtools()

      if (result?.success && result.isOpen !== undefined) {
        setDevToolsOpen(result.isOpen)
      }
    } catch (error) {
      console.error('Failed to toggle DevTools:', error)
    } finally {
      setDevToolsLoading(false)
    }
  }

  const tabItems = [
    {
      key: 'appearance',
      label: (
        <Space size={8}>
          <BgColorsOutlined />
          外观
        </Space>
      ),
      children: (
        <div className={styles.panel}>
          <SettingsRow
            control={
              <Segmented
                className={styles.controlFull}
                onChange={(value) => setThemeMode(value as ThemeMode)}
                options={THEME_OPTIONS}
                value={themeMode}
              />
            }
            last
            title="主题模式"
          />
        </div>
      ),
    },
    {
      key: 'download',
      label: (
        <Space size={8}>
          <CloudDownloadOutlined />
          下载
        </Space>
      ),
      children:
        configLoading && !downloadConfig ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : downloadConfig ? (
          <div className={styles.panel}>
            <SettingsRow
              control={
                <Select
                  className={styles.controlFull}
                  onChange={(value) => setChunkSizeMb(value)}
                  options={CHUNK_SIZE_OPTIONS}
                  value={chunkSizeMb}
                />
              }
              description="下载大文件时的单次分块体积。分块越大，请求次数越少，但失败重试成本也更高。"
              title="分块大小"
            />
            <SettingsRow
              control={
                <Select
                  className={styles.controlFull}
                  onChange={(value) => setMaxConcurrentChunks(value)}
                  options={MAX_CONCURRENT_OPTIONS}
                  value={maxConcurrentChunks}
                />
              }
              description="同时下载的分块数量。更高并发可以提升速度，但会增加网络与磁盘写入压力。"
              last
              title="最大并发分块数"
            />
            <div className={styles.footer}>
              <Text className={styles.note}>保存后应用到后续下载任务，已开始的下载不会中断。</Text>
              <Button
                disabled={!isDownloadDirty}
                loading={configLoading}
                onClick={handleSaveDownloadConfig}
                type="primary"
              >
                保存下载设置
              </Button>
            </div>
          </div>
        ) : null,
    },
    {
      key: 'developer',
      label: (
        <Space size={8}>
          <CodeOutlined />
          开发者
        </Space>
      ),
      children: (
        <div className={styles.panel}>
          <SettingsRow
            control={
              <Button className={styles.controlFull} loading={devToolsLoading} onClick={handleToggleDevtools}>
                {devToolsOpen === null ? '切换开发者工具' : devToolsOpen ? '关闭开发者工具' : '打开开发者工具'}
              </Button>
            }
            description="打开内置开发者工具以检查 DOM、样式、网络请求与控制台日志。"
            last
            title="浏览器调试面板"
          />
          <Text className={styles.note}>
            当前状态：{devToolsOpen === null ? '未同步' : devToolsOpen ? '已开启' : '已关闭'}。
          </Text>
        </div>
      ),
    },
    {
      key: 'about',
      label: (
        <Space size={8}>
          <InfoCircleOutlined />
          关于
        </Space>
      ),
      children: (
        <div className={styles.aboutBlock}>
          <Descriptions
            column={1}
            items={[
              {
                key: 'version',
                label: '应用版本',
                children: versionLabel,
              },
              {
                key: 'theme',
                label: '主题体系',
                children: 'Ant Design Light / Dark',
              },
              {
                key: 'ui',
                label: '界面组件',
                children: 'Ant Design 6',
              },
              {
                key: 'runtime',
                label: '运行框架',
                children: 'Tauri + React 19',
              },
            ]}
            labelStyle={{ color: token.colorTextSecondary, width: 88 }}
          />
          <div className={styles.aboutTags}>
            <Tag color="blue">Ant Design</Tag>
            <Tag color="geekblue">React 19</Tag>
            <Tag color="purple">Tauri</Tag>
            <Tag color="cyan">{themeLabel}主题</Tag>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className={`${styles.container} app-page`}>
      <div className={styles.header}>
        <Title className={styles.title} level={2}>
          设置
        </Title>
        <Paragraph className={styles.description}>按功能分类整理常用设置，切换分类即可查看和修改对应选项。</Paragraph>
      </div>

      <Card className={styles.tabsCard}>
        <Tabs animated={false} items={tabItems} />
      </Card>
    </div>
  )
}
