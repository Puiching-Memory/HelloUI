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
  DeleteRegular,
} from '@fluentui/react-icons'
import { useSharedStyles } from '../styles/sharedStyles'
import type { CliOutputLine } from '../hooks/useCliOutput'
import { parseAnsiToSegments, hasAnsiCodes } from '../utils/format'

interface CliOutputPanelProps {
  cliOutput: CliOutputLine[]
  cliOutputExpanded: boolean
  unreadCount: number
  copySuccess: boolean
  cliOutputRef: React.RefObject<HTMLDivElement | null>
  onToggleExpanded: () => void
  onCopy: () => void
  onExport: () => void
  onClear: () => void
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
  onClear,
  emptyMessage = '暂无输出，开始生成后将显示 SD.cpp 的 CLI 输出',
  variant = 'card',
}: CliOutputPanelProps) {
  const styles = useSharedStyles()

  const renderLineContent = (line: CliOutputLine) => {
    if (hasAnsiCodes(line.text)) {
      const segments = parseAnsiToSegments(line.text)
      return segments.map((seg, i) =>
        seg.style ? <span key={i} style={seg.style}>{seg.text}</span> : <span key={i}>{seg.text}</span>
      )
    }
    return line.text
  }

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
            <Button
              size="small"
              icon={<DeleteRegular />}
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              disabled={cliOutput.length === 0}
              appearance="subtle"
            >
              清空
            </Button>
            {cliOutputExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
          </div>
        </div>
        <div
          style={{
            maxHeight: cliOutputExpanded ? '175px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.25s ease-in-out',
          }}
        >
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
                  {renderLineContent(line)}
                </div>
              ))
            )}
          </div>
        </div>
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
          <Button
            size="small"
            icon={<DeleteRegular />}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            disabled={cliOutput.length === 0}
            appearance="subtle"
          >
            清空
          </Button>
        </div>
      </div>
      <div
        style={{
          maxHeight: cliOutputExpanded ? '275px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease-in-out',
        }}
      >
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
                {renderLineContent(line)}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}
