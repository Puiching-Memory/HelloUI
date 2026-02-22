import { useState, useRef, useEffect, useCallback } from 'react'
import { useIpcListener } from './useIpcListener'
import { stripAnsiCodes, processRawCliText } from '../utils/format'

export interface CliOutputLine {
  type: 'stdout' | 'stderr'
  text: string
  timestamp: number
}

export interface UseCliOutputReturn {
  cliOutput: CliOutputLine[]
  cliOutputExpanded: boolean
  hasUserCollapsed: boolean
  lastViewedOutputCount: number
  copySuccess: boolean
  unreadCount: number
  cliOutputRef: React.RefObject<HTMLDivElement | null>
  setCliOutputExpanded: (expanded: boolean) => void
  setHasUserCollapsed: (collapsed: boolean) => void
  setLastViewedOutputCount: (count: number) => void
  setCopySuccess: (success: boolean) => void
  clearOutput: () => void
  handleCopyOutput: () => void
  handleExportOutput: () => void
  toggleExpanded: () => void
}

/**
 * 管理 CLI 输出状态和行为的自定义 hook
 * @param cliOutputChannel IPC 通道名（如 'generate:cli-output'）
 */
export function useCliOutput(cliOutputChannel: string): UseCliOutputReturn {
  const [cliOutput, setCliOutput] = useState<CliOutputLine[]>([])
  const [cliOutputExpanded, setCliOutputExpanded] = useState(false)
  const [hasUserCollapsed, setHasUserCollapsed] = useState(false)
  const [lastViewedOutputCount, setLastViewedOutputCount] = useState(0)
  const [copySuccess, setCopySuccess] = useState(false)
  const cliOutputRef = useRef<HTMLDivElement | null>(null)

  // 处理 CLI 输出回调
  const handleCliOutput = useCallback((data: { type: 'stdout' | 'stderr'; text: string }) => {
    const lines = processRawCliText(data.text)
    if (lines.length === 0) return
    setCliOutput((prev) => {
      let next = prev
      for (const rawLine of lines) {
        const cleaned = stripAnsiCodes(rawLine)
        if (!cleaned.trim()) continue
        const lastLine = next[next.length - 1]
        // 跳过与上一行完全相同的重复行
        if (lastLine && stripAnsiCodes(lastLine.text) === cleaned && lastLine.type === data.type) {
          // 用新内容替换最后一行（进度条覆写场景）
          next = [...next.slice(0, -1), { type: data.type, text: rawLine, timestamp: Date.now() }]
        } else {
          next = [...next, { type: data.type, text: rawLine, timestamp: Date.now() }]
        }
      }
      return next
    })
  }, [])

  // 监听 CLI 输出
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useIpcListener(cliOutputChannel as any, handleCliOutput)

  // 当有新输出且用户未手动收起时自动展开
  useEffect(() => {
    if (cliOutput.length > 0 && !cliOutputExpanded && !hasUserCollapsed) {
      const timer = setTimeout(() => {
        setCliOutputExpanded(true)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [cliOutput.length, cliOutputExpanded, hasUserCollapsed])

  // 展开时更新已查看数量
  useEffect(() => {
    if (cliOutputExpanded) {
      const timer = setTimeout(() => {
        setLastViewedOutputCount(cliOutput.length)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [cliOutputExpanded, cliOutput.length])

  // 自动滚动到底部
  useEffect(() => {
    if (cliOutputRef.current && cliOutputExpanded) {
      cliOutputRef.current.scrollTop = cliOutputRef.current.scrollHeight
    }
  }, [cliOutput, cliOutputExpanded])

  const unreadCount = cliOutput.length - lastViewedOutputCount

  const clearOutput = useCallback(() => {
    setCliOutput([])
    setLastViewedOutputCount(0)
  }, [])

  const handleCopyOutput = useCallback(() => {
    const text = cliOutput.map((line) => `[${line.type}] ${stripAnsiCodes(line.text)}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }, [cliOutput])

  const handleExportOutput = useCallback(() => {
    const text = cliOutput.map((line) => `[${line.type}] ${stripAnsiCodes(line.text)}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cli-output-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [cliOutput])

  const toggleExpanded = useCallback(() => {
    const newExpanded = !cliOutputExpanded
    setCliOutputExpanded(newExpanded)
    if (!newExpanded) {
      setHasUserCollapsed(true)
    } else {
      setLastViewedOutputCount(cliOutput.length)
    }
  }, [cliOutputExpanded, cliOutput.length])

  return {
    cliOutput,
    cliOutputExpanded,
    hasUserCollapsed,
    lastViewedOutputCount,
    copySuccess,
    unreadCount,
    cliOutputRef,
    setCliOutputExpanded,
    setHasUserCollapsed,
    setLastViewedOutputCount,
    setCopySuccess,
    clearOutput,
    handleCopyOutput,
    handleExportOutput,
    toggleExpanded,
  }
}
