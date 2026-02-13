export function toUnixSlashes(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

export function getPathBaseName(filePath: string | null | undefined, fallback = ''): string {
  if (!filePath) return fallback

  const normalized = toUnixSlashes(filePath).replace(/\/+$/, '')
  const lastSlashIndex = normalized.lastIndexOf('/')
  const name = lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized

  return name || fallback || filePath
}

export function toMediaUrl(filePath: string): string {
  return `media:///${toUnixSlashes(filePath)}`
}