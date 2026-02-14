import {
  Card,
  Title2,
  Button,
  CounterBadge,
  Text,
  tokens,
} from '@fluentui/react-components'
import {
  ChevronDownRegular,
  ChevronUpRegular,
  CopyRegular,
  DocumentArrowDownRegular,
} from '@fluentui/react-icons'
import { useSharedStyles } from '../styles/sharedStyles'
import type { CliOutputLine } from '../hooks/useCliOutput'

interface CliOutputPanelProps {
  cliOutput: CliOutputLine[]
  cliOutputExpanded: boolean
  unreadCount: number
  copySuccess: boolean
  cliOutputRef: React.RefObject<HTMLDivElement | null>
  onToggleExpanded: () => void
  onCopy: () => void
  onExport: () => void
  emptyMessage?: string
  variant?: 'card' | 'floating'
}

export function CliOutputPanel({
  cliOutput,
  cliOutputExpanded,
  unreadCount,
  copySuccess,
  cliOutputRef,
  onToggleExpanded,
  onCopy,
  onExport,
  emptyMessage = '暂无输出，开始生成后将显示 SD.cpp 的 CLI 输出',
  variant = 'card',
}: CliOutputPanelProps) {
  const styles = useSharedStyles()

  if (variant === 'floating') {
    return (
      <div className={styles.floatingControlPanelCli}>
        <div className={styles.floatingCliHeader} onClick={onToggleExpanded}>
          <div className={styles.floatingCliHeaderLeft}>
            <Text
              weight="semibold"
              style={{ fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap' }}
            >
              CLI 输出
            </Text>
            {!cliOutputExpanded && unreadCount > 0 && (
              <CounterBadge
                count={unreadCount}
                color="brand"
                size="small"
                style={{ position: 'absolute', top: '-4px', right: '-8px' }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
            <Button
              size="small"
              icon={<CopyRegular />}
              onClick={(e) => {
                e.stopPropagation()
                onCopy()
              }}
              disabled={cliOutput.length === 0}
              appearance="subtle"
              style={copySuccess ? { color: tokens.colorPaletteGreenForeground1 } : undefined}
            >
              {copySuccess ? '已复制' : '复制'}
            </Button>
            <Button
              size="small"
              icon={<DocumentArrowDownRegular />}
              onClick={(e) => {
                e.stopPropagation()
                onExport()
              }}
              disabled={cliOutput.length === 0}
              appearance="subtle"
            >
              导出
            </Button>
            {cliOutputExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
          </div>
        </div>
        {cliOutputExpanded && (
          <div ref={cliOutputRef} className={styles.floatingCliContent}>
            {cliOutput.length === 0 ? (
              <div className={styles.cliOutputEmpty}>{emptyMessage}</div>
            ) : (
              cliOutput.map((line, index) => (
                <div
                  key={index}
                  className={`${styles.cliOutputLine} ${
                    line.type === 'stderr' ? styles.cliOutputLineStderr : styles.cliOutputLineStdout
                  }`}
                >
                  {line.text}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card
      className={
        !cliOutputExpanded && unreadCount > 0
          ? styles.cliOutputCardWithNewMessage
          : styles.cliOutputCard
      }
    >
      <div className={styles.cliOutputHeader}>
        <div className={styles.cliOutputHeaderLeft} onClick={onToggleExpanded}>
          <div className={styles.cliOutputTitleContainer}>
            <Title2
              style={{ fontSize: tokens.fontSizeBase400, margin: 0, whiteSpace: 'nowrap' }}
              className={styles.cliOutputTitle}
            >
              CLI 输出
            </Title2>
            {!cliOutputExpanded && unreadCount > 0 && (
              <CounterBadge
                count={unreadCount}
                color="brand"
                size="small"
                style={{ position: 'absolute', top: '-4px', right: '-8px' }}
              />
            )}
          </div>
          {cliOutputExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
        </div>
        <div className={styles.cliOutputHeaderActions}>
          <Button
            size="small"
            icon={<CopyRegular />}
            onClick={(e) => {
              e.stopPropagation()
              onCopy()
            }}
            disabled={cliOutput.length === 0}
            appearance="subtle"
            style={copySuccess ? { color: tokens.colorPaletteGreenForeground1 } : undefined}
          >
            {copySuccess ? '已复制' : '复制'}
          </Button>
          <Button
            size="small"
            icon={<DocumentArrowDownRegular />}
            onClick={(e) => {
              e.stopPropagation()
              onExport()
            }}
            disabled={cliOutput.length === 0}
            appearance="subtle"
          >
            导出
          </Button>
        </div>
      </div>
      {cliOutputExpanded && (
        <div ref={cliOutputRef} className={styles.cliOutputContent}>
          {cliOutput.length === 0 ? (
            <div className={styles.cliOutputEmpty}>{emptyMessage}</div>
          ) : (
            cliOutput.map((line, index) => (
              <div
                key={index}
                className={`${styles.cliOutputLine} ${
                  line.type === 'stderr' ? styles.cliOutputLineStderr : styles.cliOutputLineStdout
                }`}
              >
                {line.text}
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  )
}
