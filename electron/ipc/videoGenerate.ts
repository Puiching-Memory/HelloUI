import { ipcMain } from 'electron'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { execa } from 'execa'
import type { GenerateImageParams } from '../../shared/types.js'
import type { AppState } from './state.js'
import { loadModelGroups } from './modelGroups.js'
import { AsyncOperationGuard } from '../utils/AsyncOperationGuard.js'
import { ResourceManager } from '../utils/ResourceManager.js'
import { getDefaultOutputsFolder, getDefaultSDCppFolder, getFFmpegPath, resolveModelPath } from '../utils/paths.js'

const VIDEO_DEFAULT_NEGATIVE_PROMPT =
  '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走'

interface VideoGenerateDeps {
  state: AppState
}

function getSDCppExecutablePath(state: AppState): string {
  const engineFolder = state.sdcppFolderPath || getDefaultSDCppFolder()
  const deviceFolder = join(engineFolder, state.sdcppDeviceType)
  return join(deviceFolder, 'sd-cli.exe')
}

export function registerVideoGenerateHandlers({ state }: VideoGenerateDeps): void {
  // 取消视频生成
  ipcMain.handle('generate-video:cancel', async () => {
    if (state.currentGenerateProcess && !state.currentGenerateProcess.killed) {
      if (state.currentGenerateKill) state.currentGenerateKill()
      return true
    }
    return false
  })

  // 开始视频生成
  ipcMain.handle(
    'generate-video:start',
    async (event, params: GenerateImageParams & { frames?: number; fps?: number }) => {
      try {
        const {
          groupId,
          deviceType,
          mode,
          initImage,
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
          frames = 33,
          fps = 8,
          flowShift = 3.0,
          highNoiseSteps,
          highNoiseCfgScale,
          highNoiseSamplingMethod,
        } = params

        let sdModelPath: string | undefined
        let highNoiseModelPath: string | undefined
        let clipVisionModelPath: string | undefined

        if (groupId) {
          const groups = await loadModelGroups(state.weightsFolderPath)
          const group = groups.find((g) => g.id === groupId)
          if (!group || !group.sdModel) throw new Error('模型组配置错误')
          sdModelPath = resolveModelPath(group.sdModel, state.weightsFolderPath)
          if (!sdModelPath || !existsSync(sdModelPath)) throw new Error(`模型文件不存在: ${sdModelPath}`)

          if (group.highNoiseSdModel) highNoiseModelPath = resolveModelPath(group.highNoiseSdModel, state.weightsFolderPath)
          if (group.clipVisionModel) clipVisionModelPath = resolveModelPath(group.clipVisionModel, state.weightsFolderPath)
        } else {
          throw new Error('必须提供模型组ID')
        }

        const sdExePath = getSDCppExecutablePath(state)
        if (!existsSync(sdExePath)) throw new Error(`引擎文件不存在: ${sdExePath}`)

        const outputsDir = getDefaultOutputsFolder()
        if (!existsSync(outputsDir)) await fs.mkdir(outputsDir, { recursive: true })

        const timestamp = Date.now()
        const outputAviPath = join(outputsDir, `video_${timestamp}.avi`)
        const outputMp4Path = join(outputsDir, `video_${timestamp}.mp4`)
        const outputMetadataPath = join(outputsDir, `video_${timestamp}.json`)

        const args: string[] = ['-M', 'vid_gen', '--diffusion-model', sdModelPath, '--prompt', prompt]
        if (mode === 'image2video' && initImage) args.push('-i', initImage)

        if (groupId) {
          const groups = await loadModelGroups(state.weightsFolderPath)
          const group = groups.find((g) => g.id === groupId)
          if (group?.vaeModel) {
            const p = resolveModelPath(group.vaeModel, state.weightsFolderPath)
            if (p && existsSync(p)) args.push('--vae', p)
          }
          if (group?.llmModel) {
            const p = resolveModelPath(group.llmModel, state.weightsFolderPath)
            if (p && existsSync(p)) args.push('--t5xxl', p)
          }
        }

        args.push('--negative-prompt', negativePrompt || VIDEO_DEFAULT_NEGATIVE_PROMPT)
        args.push('--output', outputAviPath)
        if (highNoiseModelPath) args.push('--high-noise-diffusion-model', highNoiseModelPath)
        if (clipVisionModelPath) args.push('--clip_vision', clipVisionModelPath)
        if (frames > 0) args.push('--video-frames', frames.toString())
        if (flowShift !== undefined) args.push('--flow-shift', flowShift.toString())
        if (steps !== 20) args.push('--steps', steps.toString())
        if (highNoiseModelPath) args.push('--high-noise-steps', (highNoiseSteps || steps).toString())
        if (width !== 512) args.push('--width', width.toString())
        if (height !== 512) args.push('--height', height.toString())
        if (Math.abs(cfgScale - 7.0) > 0.0001) args.push('--cfg-scale', cfgScale.toString())
        if (highNoiseModelPath) args.push('--high-noise-cfg-scale', (highNoiseCfgScale || cfgScale).toString())
        if (samplingMethod?.trim()) args.push('--sampling-method', samplingMethod.trim())
        if (highNoiseModelPath)
          args.push('--high-noise-sampling-method', highNoiseSamplingMethod || samplingMethod || 'euler')
        if (scheduler?.trim()) args.push('--scheduler', scheduler.trim())
        if (seed !== undefined && seed >= 0) args.push('--seed', seed.toString())
        if (batchCount > 1) args.push('--batch-count', batchCount.toString())
        if (threads !== undefined && threads > 0) args.push('--threads', threads.toString())

        if (preview && preview !== 'none' && preview.trim() !== '') {
          const p = join(outputsDir, `preview_video_${timestamp}.png`)
          args.push('--preview', preview.trim())
          args.push('--preview-path', join(outputsDir, `preview_video_${timestamp}.png`))
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

        console.log(`[Generate Video] Starting video generation (${deviceType}): ${sdExePath}`)
        const startTime = Date.now()
        event.sender.send('generate-video:progress', { progress: '正在启动 SD.cpp 引擎...' })

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

          const handleVideoCompletion = async () => {
            try {
              if (!existsSync(outputAviPath)) throw new Error('未找到输出视频文件')
              event.sender.send('generate-video:progress', { progress: '正在转换视频格式 (AVI -> MP4)...' })
              const ffmpegPath = getFFmpegPath()
              if (existsSync(ffmpegPath)) {
                await execa(ffmpegPath, [
                  '-i',
                  outputAviPath,
                  '-c:v',
                  'libx264',
                  '-pix_fmt',
                  'yuv420p',
                  '-y',
                  outputMp4Path,
                ])
                await fs.unlink(outputAviPath).catch(() => {})
              } else {
                throw new Error(`未找到 FFmpeg 引擎: ${ffmpegPath}`)
              }

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
                frames,
                fps,
                commandLine: args.join(' '),
                duration,
                type: 'video',
                mediaType: 'video',
              }
              await fs.writeFile(outputMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
              const videoUrl = `media:///${outputMp4Path.replace(/\\/g, '/')}`
              event.sender.send('generate-video:progress', { progress: `生成完成`, video: videoUrl })
              resolvePromise({ success: true, video: videoUrl, videoPath: outputMp4Path, duration })
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
              event.sender.send('generate-video:cli-output', { type: 'stdout', text })
              const m = text.match(/progress[:\s]+(\d+)%/i)
              if (m) event.sender.send('generate-video:progress', { progress: `生成中... ${m[1]}%` })
            }
          })

          childProcess.stderr?.on('data', (data: Buffer) => {
            const text = data.toString('utf8')
            stderr += text
            if (operationGuard.check() && !event.sender.isDestroyed()) {
              event.sender.send('generate-video:cli-output', { type: 'stderr', text })
            }
          })

          childProcess.on('close', (code: number) => {
            cleanup()
            if (isResolved) return
            isResolved = true
            if (code === 0) handleVideoCompletion()
            else reject(new Error(`SD.cpp 退出，错误代码: ${code}`))
          })

          childProcess.on('error', (err: Error) => {
            cleanup()
            if (isResolved) return
            isResolved = true
            reject(err)
          })
        })
      } catch (error: any) {
        console.error('[Generate Video] Error:', error)
        throw error
      }
    },
  )
}
