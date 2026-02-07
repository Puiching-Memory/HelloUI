import { createReadStream, createWriteStream } from 'fs'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

/**
 * 带有进度报告的文件复制函数
 */
export async function copyFileWithProgress(
  src: string,
  dest: string,
  onProgress: (chunkLength: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = createReadStream(src)
    const writeStream = createWriteStream(dest)

    readStream.on('data', (chunk) => {
      onProgress(chunk.length)
    })

    readStream.on('error', reject)
    writeStream.on('error', reject)
    writeStream.on('finish', resolve)

    readStream.pipe(writeStream)
  })
}

/**
 * 递归获取文件夹总大小
 */
export async function getFolderSize(folderPath: string): Promise<number> {
  let totalSize = 0
  const entries = await fs.readdir(folderPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(folderPath, entry.name)
    if (entry.isDirectory()) {
      totalSize += await getFolderSize(fullPath)
    } else {
      const stats = await fs.stat(fullPath)
      totalSize += stats.size
    }
  }

  return totalSize
}

/**
 * 计算文件的快速采样哈希（智能多点采样）
 */
export async function calculateQuickHash(filePath: string, fileSize: number): Promise<string> {
  const baseSampleSize = 32 * 1024
  const hash = createHash('md5')

  const fd = await fs.open(filePath, 'r')

  try {
    const startBuffer = Buffer.alloc(Math.min(baseSampleSize, fileSize))
    await fd.read(startBuffer, 0, startBuffer.length, 0)
    hash.update(startBuffer)

    if (fileSize <= baseSampleSize) {
      // 小文件：只读取开头
    } else if (fileSize <= 100 * 1024 * 1024) {
      const endPos = Math.max(0, fileSize - baseSampleSize)
      const endBuffer = Buffer.alloc(fileSize - endPos)
      await fd.read(endBuffer, 0, endBuffer.length, endPos)
      hash.update(endBuffer)
    } else {
      const samplePoints = [
        0,
        Math.floor(fileSize * 0.25) - baseSampleSize / 2,
        Math.floor(fileSize * 0.5) - baseSampleSize / 2,
        Math.floor(fileSize * 0.75) - baseSampleSize / 2,
        Math.max(0, fileSize - baseSampleSize),
      ]

      for (const pos of samplePoints) {
        const safePos = Math.max(0, Math.min(pos, fileSize - baseSampleSize))
        const buffer = Buffer.alloc(baseSampleSize)
        await fd.read(buffer, 0, baseSampleSize, safePos)
        hash.update(buffer)
      }
    }

    hash.update(Buffer.from(fileSize.toString()))
    return hash.digest('hex')
  } finally {
    await fd.close()
  }
}

/**
 * 快速检查目标文件夹中是否已有相同文件
 */
export async function findDuplicateFile(
  targetFolder: string,
  sourcePath: string,
  sourceSize: number,
): Promise<string | null> {
  const { existsSync } = await import('fs')
  if (!existsSync(targetFolder)) return null

  const sourceQuickHash = await calculateQuickHash(sourcePath, sourceSize)
  const entries = await fs.readdir(targetFolder, { withFileTypes: true })

  const candidates: Array<{ path: string; size: number }> = []
  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = join(targetFolder, entry.name)
      const stats = await fs.stat(filePath)
      if (stats.size === sourceSize) {
        candidates.push({ path: filePath, size: stats.size })
      }
    }
  }

  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    const candidateQuickHash = await calculateQuickHash(candidate.path, candidate.size)
    if (candidateQuickHash === sourceQuickHash) return candidate.path
  }

  return null
}
