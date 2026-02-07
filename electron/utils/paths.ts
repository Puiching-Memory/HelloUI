import { join, dirname, isAbsolute, resolve } from 'path'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import { app } from 'electron'

/**
 * 获取运行位置目录（可执行文件所在目录）
 */
export function getRunPath(): string {
  return app.isPackaged ? dirname(process.execPath) : join(dirname(import.meta.url.replace('file:///', '')), '..')
}

/**
 * 获取默认的 models 文件夹路径
 */
export function getDefaultModelsFolder(): string {
  return join(getRunPath(), 'models')
}

/**
 * 获取默认的 SD.cpp 引擎文件夹路径
 */
export function getDefaultSDCppFolder(): string {
  return join(getRunPath(), 'engines', 'sdcpp')
}

/**
 * 获取默认的 outputs 文件夹路径
 */
export function getDefaultOutputsFolder(): string {
  return join(getRunPath(), 'outputs')
}

/**
 * 获取 FFmpeg 可执行文件路径
 */
export function getFFmpegPath(): string {
  return join(getRunPath(), 'engines', 'ffmpeg', 'bin', 'ffmpeg.exe')
}

/**
 * 初始化默认 models 文件夹
 */
export async function initDefaultModelsFolder(): Promise<string> {
  const defaultFolder = getDefaultModelsFolder()
  if (!existsSync(defaultFolder)) {
    await fs.mkdir(defaultFolder, { recursive: true })
    console.log(`[Main] Created default models folder: ${defaultFolder}`)
  }
  return defaultFolder
}

/**
 * 初始化默认 SD.cpp 引擎文件夹
 */
export async function initDefaultSDCppFolder(): Promise<string> {
  const defaultFolder = getDefaultSDCppFolder()
  if (!existsSync(defaultFolder)) {
    await fs.mkdir(defaultFolder, { recursive: true })
    console.log(`[Main] Created default SD.cpp engine folder: ${defaultFolder}`)
  }
  const deviceFolders = ['cpu', 'vulkan', 'cuda']
  for (const device of deviceFolders) {
    const deviceFolder = join(defaultFolder, device)
    if (!existsSync(deviceFolder)) {
      await fs.mkdir(deviceFolder, { recursive: true })
      console.log(`[Main] Created device folder: ${deviceFolder}`)
    }
  }
  return defaultFolder
}

/**
 * 初始化默认 outputs 文件夹
 */
export async function initDefaultOutputsFolder(): Promise<string> {
  const defaultFolder = getDefaultOutputsFolder()
  if (!existsSync(defaultFolder)) {
    await fs.mkdir(defaultFolder, { recursive: true })
    console.log(`[Main] Created default outputs folder: ${defaultFolder}`)
  }
  return defaultFolder
}

/**
 * 将相对路径转换为绝对路径（基于运行路径和 models 文件夹）
 */
export function resolveModelPath(modelPath: string | undefined, weightsFolderPath: string | null): string | undefined {
  if (!modelPath) return undefined

  if (isAbsolute(modelPath)) return modelPath

  let normalizedPath = modelPath.replace(/^models[\/\\]/, '')

  const modelsFolder = weightsFolderPath || getDefaultModelsFolder()
  const pathInModels = resolve(modelsFolder, normalizedPath)
  if (existsSync(pathInModels)) return pathInModels

  if (normalizedPath.includes('/') || normalizedPath.includes('\\')) {
    return resolve(getRunPath(), normalizedPath)
  } else {
    return join(getDefaultModelsFolder(), normalizedPath)
  }
}
