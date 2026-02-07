/**
 * 清理 ANSI 转义序列（控制字符）
 */
export function stripAnsiCodes(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b[\(\)][0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b./g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
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
