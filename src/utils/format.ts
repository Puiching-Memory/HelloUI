/**
 * 清理 ANSI 转义序列（控制字符）
 */
export function stripAnsiCodes(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b[()][0-9;]*[a-zA-Z]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b./g, '')
}

/**
 * ANSI 颜色代码到 CSS 颜色的映射
 */
const ANSI_COLORS: Record<number, string> = {
  30: '#1e1e1e', // 黑色
  31: '#cd3131', // 红色
  32: '#0dbc79', // 绿色
  33: '#e5e510', // 黄色
  34: '#2472c8', // 蓝色
  35: '#bc3fbc', // 品红
  36: '#11a8cd', // 青色
  37: '#e5e5e5', // 白色
  90: '#666666', // 亮黑色（灰色）
  91: '#f14c4c', // 亮红色
  92: '#23d18b', // 亮绿色
  93: '#f5f543', // 亮黄色
  94: '#3b8eea', // 亮蓝色
  95: '#d670d6', // 亮品红
  96: '#29b8db', // 亮青色
  97: '#ffffff', // 亮白色
}

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#1e1e1e',
  41: '#cd3131',
  42: '#0dbc79',
  43: '#e5e510',
  44: '#2472c8',
  45: '#bc3fbc',
  46: '#11a8cd',
  47: '#e5e5e5',
  100: '#666666',
  101: '#f14c4c',
  102: '#23d18b',
  103: '#f5f543',
  104: '#3b8eea',
  105: '#d670d6',
  106: '#29b8db',
  107: '#ffffff',
}

/**
 * ANSI 文本段
 */
export interface AnsiSegment {
  text: string
  style?: React.CSSProperties
}

/**
 * 解析 ANSI 转义序列为带样式的文本段
 */
export function parseAnsiToSegments(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\u001b\[([0-9;]*)m/g
  let currentStyle: React.CSSProperties = {}
  let lastIndex = 0
  let match

  while ((match = ansiRegex.exec(text)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      const t = text.substring(lastIndex, match.index)
      if (t) {
        segments.push({ text: t, style: Object.keys(currentStyle).length > 0 ? { ...currentStyle } : undefined })
      }
    }
    lastIndex = match.index + match[0].length

    // 解析 SGR 参数
    const params = match[1].split(';').map(Number)
    for (const code of params) {
      if (code === 0 || isNaN(code)) {
        currentStyle = {}
      } else if (code === 1) {
        currentStyle = { ...currentStyle, fontWeight: 'bold' }
      } else if (code === 2) {
        currentStyle = { ...currentStyle, opacity: 0.7 }
      } else if (code === 3) {
        currentStyle = { ...currentStyle, fontStyle: 'italic' }
      } else if (code === 4) {
        currentStyle = { ...currentStyle, textDecoration: 'underline' }
      } else if (ANSI_COLORS[code]) {
        currentStyle = { ...currentStyle, color: ANSI_COLORS[code] }
      } else if (ANSI_BG_COLORS[code]) {
        currentStyle = { ...currentStyle, backgroundColor: ANSI_BG_COLORS[code] }
      }
    }
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex)
    // 再清理一次残余的其他转义序列
    const clean = remaining
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b[()][0-9;]*[a-zA-Z]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b./g, '')
    if (clean) {
      segments.push({ text: clean, style: Object.keys(currentStyle).length > 0 ? { ...currentStyle } : undefined })
    }
  }

  // 如果没有任何 ANSI 序列，返回原始文本（清理后）
  if (segments.length === 0) {
    const clean = stripAnsiCodes(text)
    if (clean) segments.push({ text: clean })
  }

  return segments
}

/**
 * 检查文本是否包含 ANSI 转义序列
 */
export function hasAnsiCodes(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\u001b\[/.test(text)
}

/**
 * 处理 CLI 原始输出中的 \r（回车）覆写行为，模拟终端显示效果。
 * - \r\n → \n（Windows 换行规范化）
 * - 每个物理行内按 \r 拆分，仅保留最后一个可见段（覆写后的最终状态）
 * - 返回拆分后的多行数组（已去除空行）
 */
export function processRawCliText(rawText: string): string[] {
  // 规范化 Windows 换行
  const normalized = rawText.replace(/\r\n/g, '\n')
  // 按 \n 拆分为物理行
  const physicalLines = normalized.split('\n')
  const result: string[] = []
  for (const line of physicalLines) {
    if (!line) continue
    // 按 \r 拆分，取最后一个 strip 后非空的段（模拟终端覆写）
    const crParts = line.split('\r')
    // 从后往前找第一个非空段
    let visible = ''
    for (let i = crParts.length - 1; i >= 0; i--) {
      if (crParts[i].trim()) {
        visible = crParts[i]
        break
      }
    }
    if (visible.trim()) {
      result.push(visible)
    }
  }
  return result
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 格式化下载速度
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return ''
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

/**
 * 计算下载剩余时间（秒）
 */
export function calculateEta(downloadedBytes: number, totalBytes: number, speed: number): number | null {
  if (speed <= 0 || totalBytes <= 0 || downloadedBytes >= totalBytes) return null
  return (totalBytes - downloadedBytes) / speed
}

/**
 * 格式化剩余时间
 */
export function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return ''
  if (seconds < 60) return `剩余 ${Math.ceil(seconds)} 秒`
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.ceil(seconds % 60)
    return `剩余 ${minutes}:${secs.toString().padStart(2, '0')}`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `剩余 ${hours}:${minutes.toString().padStart(2, '0')}:00`
}

/**
 * 计算下载百分比
 */
export function calculatePercent(downloadedBytes: number, totalBytes: number): string {
  if (totalBytes <= 0) return ''
  const percent = (downloadedBytes / totalBytes) * 100
  return `${percent.toFixed(1)}%`
}
