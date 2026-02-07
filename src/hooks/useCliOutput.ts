import { useState, useRef, useEffect, useCallback } from 'react'
import { useIpcListener } from './useIpcListener'
import { stripAnsiCodes } from '../utils/format'

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
    const cleanedText = stripAnsiCodes(data.text)
    if (cleanedText.trim()) {
      setCliOutput((prev) => {
        const lastLine = prev[prev.length - 1]
        if (lastLine && lastLine.text === cleanedText && lastLine.type === data.type) {
          return prev
        }
        return [...prev, { ...data, text: cleanedText, timestamp: Date.now() }]
      })
    }
  }, [])

  // 监听 CLI 输出
  useIpcListener(cliOutputChannel as any, handleCliOutput)

  // 当有新输出且用户未手动收起时自动展开
  useEffect(() => {
    if (cliOutput.length > 0 && !cliOutputExpanded && !hasUserCollapsed) {
      setCliOutputExpanded(true)
      setLastViewedOutputCount(cliOutput.length)
    }
  }, [cliOutput.length, cliOutputExpanded, hasUserCollapsed])

  // 展开时更新已查看数量
  useEffect(() => {
    if (cliOutputExpanded) {
      setLastViewedOutputCount(cliOutput.length)
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
    const text = cliOutput.map((line) => `[${line.type}] ${line.text}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }, [cliOutput])

  const handleExportOutput = useCallback(() => {
    const text = cliOutput.map((line) => `[${line.type}] ${line.text}`).join('\n')
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
