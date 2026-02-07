import { ipcMain } from 'electron'
import { join, dirname, resolve } from 'path'
import { existsSync, watchFile, unwatchFile } from 'fs'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { execa } from 'execa'
import type { GenerateImageParams } from '../../shared/types.js'
import type { AppState } from './state.js'
import { loadModelGroups } from './modelGroups.js'
import { AsyncOperationGuard } from '../utils/AsyncOperationGuard.js'
import { ResourceManager } from '../utils/ResourceManager.js'
import { getDefaultOutputsFolder, getDefaultSDCppFolder, resolveModelPath } from '../utils/paths.js'

interface GenerateDeps {
  state: AppState
}

function getSDCppExecutablePath(state: AppState): string {
  const engineFolder = state.sdcppFolderPath || getDefaultSDCppFolder()
  const deviceFolder = join(engineFolder, state.sdcppDeviceType)
  return join(deviceFolder, 'sd-cli.exe')
}

export function registerGenerateHandlers({ state }: GenerateDeps): void {
  // 取消生成
  ipcMain.handle('generate:cancel', async () => {
    if (state.currentGenerateProcess && state.currentGenerateKill) {
      state.currentGenerateKill()
      return { success: true }
    }
    return { success: false, message: '没有正在进行的生成任务' }
  })

  // 开始生成图片
  ipcMain.handle('generate:start', async (event, params: GenerateImageParams) => {
    try {
      const {
        groupId,
        deviceType,
        prompt,
        negativePrompt = '',
        steps = 20,
        width = 512,
        height = 512,
        cfgScale = 7.0,
        samplingMethod,
        scheduler,
        seed,
        batchCount = 1,
        threads,
        preview,
        previewInterval = 1,
        verbose = false,
        color = false,
        offloadToCpu = false,
        diffusionFa = false,
        controlNetCpu = false,
        clipOnCpu = false,
        vaeOnCpu = false,
        diffusionConvDirect = false,
        vaeConvDirect = false,
        vaeTiling = false,
        inputImage,
        flowShift,
        qwenImageZeroCondT,
      } = params

      let sdModelPath: string | undefined
      if (groupId) {
        const groups = await loadModelGroups(state.weightsFolderPath)
        const group = groups.find((g) => g.id === groupId)
        if (!group || !group.sdModel) throw new Error('模型组配置错误')
        sdModelPath = resolveModelPath(group.sdModel, state.weightsFolderPath)
        if (!sdModelPath || !existsSync(sdModelPath)) throw new Error(`模型文件不存在: ${sdModelPath}`)
      } else {
        throw new Error('必须提供模型组ID')
      }

      const isQwenEdit2511 = sdModelPath.toLowerCase().includes('qwen-image-edit-2511')
      const sdExePath = getSDCppExecutablePath(state)
      if (!existsSync(sdExePath)) throw new Error(`引擎文件不存在: ${sdExePath}`)

      const outputsDir = getDefaultOutputsFolder()
      if (!existsSync(outputsDir)) await fs.mkdir(outputsDir, { recursive: true })

      const timestamp = Date.now()
      const outputImagePath = join(outputsDir, `generated_${timestamp}.png`)
      const outputMetadataPath = join(outputsDir, `generated_${timestamp}.json`)
      const previewImagePath = join(outputsDir, `preview_${timestamp}.png`)

      const args: string[] = ['--diffusion-model', sdModelPath, '--prompt', prompt]

      if (groupId) {
        const groups = await loadModelGroups(state.weightsFolderPath)
        const group = groups.find((g) => g.id === groupId)
        const taskType = group?.taskType
        args.push('-M', taskType === 'upscale' ? 'upscale' : 'img_gen')
        if (group?.vaeModel) {
          const p = resolveModelPath(group.vaeModel, state.weightsFolderPath)
          if (p && existsSync(p)) args.push('--vae', p)
        }
        if (taskType === 'edit' && !isQwenEdit2511) {
          if (group?.clipLModel) {
            const p = resolveModelPath(group.clipLModel, state.weightsFolderPath)
            if (p && existsSync(p)) args.push('--clip_l', p)
          }
          if (group?.t5xxlModel) {
            const p = resolveModelPath(group.t5xxlModel, state.weightsFolderPath)
            if (p && existsSync(p)) args.push('--t5xxl', p)
          }
        } else if (group?.llmModel) {
          const p = resolveModelPath(group.llmModel, state.weightsFolderPath)
          if (p && existsSync(p)) args.push('--llm', p)
        }
      }

      if (negativePrompt) args.push('--negative-prompt', negativePrompt)
      if (inputImage) {
        const p = resolve(inputImage)
        if (existsSync(p)) args.push(isQwenEdit2511 ? '-r' : '--init-img', p)
      }
      if (isQwenEdit2511) {
        args.push('--qwen-image-zero-cond-t')
        args.push('--flow-shift', (flowShift !== undefined ? flowShift : 3).toString())
      }

      args.push('--output', outputImagePath)
      if (steps !== 20) args.push('--steps', steps.toString())
      if (width !== 512) args.push('--width', width.toString())
      if (height !== 512) args.push('--height', height.toString())
      if (Math.abs(cfgScale - 7.0) > 0.0001) args.push('--cfg-scale', cfgScale.toString())
      if (samplingMethod?.trim()) args.push('--sampling-method', samplingMethod.trim())
      if (scheduler?.trim()) args.push('--scheduler', scheduler.trim())
      if (seed !== undefined && seed >= 0) args.push('--seed', seed.toString())
      if (batchCount > 1) args.push('--batch-count', batchCount.toString())
      if (threads !== undefined && threads > 0) args.push('--threads', threads.toString())

      if (preview && preview !== 'none' && preview.trim() !== '') {
        args.push('--preview', preview.trim())
        args.push('--preview-path', resolve(previewImagePath))
        if (previewInterval > 1) args.push('--preview-interval', previewInterval.toString())
      }

      if (verbose) args.push('--verbose')
      if (color) args.push('--color')
      if (offloadToCpu) args.push('--offload-to-cpu')
      if (diffusionFa) args.push('--diffusion-fa')
      if (controlNetCpu) args.push('--control-net-cpu')
      if (clipOnCpu) args.push('--clip-on-cpu')
      if (vaeOnCpu) args.push('--vae-on-cpu')
      if (diffusionConvDirect) args.push('--diffusion-conv-direct')
      if (vaeConvDirect) args.push('--vae-conv-direct')
      if (vaeTiling) args.push('--vae-tiling')

      console.log(`[Generate] Starting image generation (${deviceType}): ${sdExePath}`)
      const startTime = Date.now()
      event.sender.send('generate:progress', { progress: '正在启动 SD.cpp 引擎...' })

      return new Promise((resolvePromise, reject) => {
        let stdout = ''
        let stderr = ''
        let isResolved = false
        const operationGuard = new AsyncOperationGuard()
        const resourceManager = new ResourceManager()
        let childProcess: any = null

        const killProcess = () => {
          if (isResolved) return
          if (childProcess && childProcess.pid) {
            if (process.platform === 'win32') exec(`taskkill /F /T /PID ${childProcess.pid}`)
            else childProcess.kill()
          }
        }

        state.currentGenerateKill = killProcess

        const cleanup = () => {
          operationGuard.invalidate()
          resourceManager.cleanupAll()
          if (state.currentGenerateProcess === childProcess) {
            state.currentGenerateProcess = null
            state.currentGenerateKill = null
          }
        }

        const handleCompletion = async () => {
          try {
            if (!existsSync(outputImagePath)) throw new Error('未找到输出图片文件')
            const duration = Date.now() - startTime
            const metadata = {
              prompt,
              negativePrompt,
              steps,
              width,
              height,
              cfgScale,
              deviceType,
              groupId,
              timestamp,
              generatedAt: new Date().toISOString(),
              samplingMethod,
              scheduler,
              seed,
              batchCount,
              threads,
              commandLine: args.join(' '),
              duration,
              type: 'generate',
              mediaType: 'image',
            }
            await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

            const imageBuffer = await fs.readFile(outputImagePath)
            const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`

            if (preview && preview !== 'none' && preview.trim() !== '') {
              await fs.unlink(resolve(previewImagePath)).catch(() => {})
            }

            const durationSeconds = (duration / 1000).toFixed(2)
            console.log(`[Generate] Image generation completed in ${durationSeconds}s (${duration}ms)`)
            event.sender.send('generate:progress', {
              progress: `生成完成（耗时: ${durationSeconds}秒）`,
              image: base64Image,
            })
            resolvePromise({ success: true, image: base64Image, imagePath: outputImagePath, duration })
          } catch (e: any) {
            reject(e)
          }
        }

        childProcess = execa(sdExePath, args, { cwd: dirname(sdExePath) })
        state.currentGenerateProcess = childProcess

        childProcess.stdout?.on('data', (data: Buffer) => {
          const text = data.toString('utf8')
          stdout += text
          if (operationGuard.check() && !event.sender.isDestroyed()) {
            event.sender.send('generate:cli-output', { type: 'stdout', text })
            const m = text.match(/progress[:\s]+(\d+)%/i)
            if (m) event.sender.send('generate:progress', { progress: `生成中... ${m[1]}%` })
          }
        })

        childProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString('utf8')
          stderr += text
          if (operationGuard.check() && !event.sender.isDestroyed()) {
            event.sender.send('generate:cli-output', { type: 'stderr', text })
          }
        })

        childProcess.on('close', (code: number, signal: string) => {
          cleanup()
          if (isResolved) return
          isResolved = true
          if (code === 0) {
            handleCompletion()
          } else {
            const wasCancelled = signal === 'SIGTERM' || signal === 'SIGKILL'
            if (wasCancelled) {
              reject(new Error('生成已取消'))
            } else {
              const errorMsg = stderr || stdout || `进程退出，代码: ${code}, 信号: ${signal}`
              reject(new Error(`图片生成失败: ${errorMsg}`))
            }
          }
        })

        childProcess.on('error', (err: Error) => {
          cleanup()
          if (isResolved) return
          isResolved = true
          reject(err)
        })

        if (preview && preview !== 'none' && preview.trim() !== '') {
          const absPath = resolve(previewImagePath)
          let lastUpdate = 0
          const watch = () => {
            if (!operationGuard.check() || !existsSync(absPath)) return
            watchFile(absPath, { interval: 200 }, async (curr, prev) => {
              if (!operationGuard.check() || (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size)) return
              const now = Date.now()
              if (now - lastUpdate < 200) return
              lastUpdate = now
              const buf = await fs.readFile(absPath)
              event.sender.send('generate:preview-update', {
                previewImage: `data:image/png;base64,${buf.toString('base64')}`,
              })
            })
            resourceManager.register(() => unwatchFile(absPath), 'watcher')
          }
          setTimeout(watch, 1000)
        }
      })
    } catch (error: any) {
      console.error('[Generate] Error:', error)
      throw error
    }
  })
}
