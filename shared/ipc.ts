import type { DeviceType, ModelGroup, WeightFile, GenerateImageParams, GeneratedImageInfo, MirrorSource, SDCppRelease, SDCppDownloadProgress, MirrorTestResult, SDCppReleaseAsset, HfMirror, HfMirrorId, HfFileRef, ModelDownloadProgress } from './types.js'

// IPC channel allowlists
export const IPC_INVOKE_CHANNELS = [
  'aliyun-api:call',
  'app:get-version',
  'devtools:toggle',
  'dialog:open-image',
  'edit-image:read-image-base64',
  'edit-image:select-file',
  'generate-video:cancel',
  'generate-video:start',
  'generate:cancel',
  'generate:start',
  'generated-images:batch-download',
  'generated-images:delete',
  'generated-images:download',
  'generated-images:get-preview',
  'generated-images:get-video-data',
  'generated-images:list',
  'model-groups:build-and-export',
  'model-groups:create',
  'model-groups:delete',
  'model-groups:get',
  'model-groups:import',
  'model-groups:list',
  'model-groups:select-folder',
  'model-groups:update',
  'models:cancel-download',
  'models:check-files',
  'models:download-group-files',
  'models:get-hf-mirror',
  'models:set-hf-mirror',
  'perfect-pixel:read-image',
  'perfect-pixel:save',
  'perfect-pixel:select-image',
  'sdcpp:add-mirror',
  'sdcpp:auto-select-mirror',
  'sdcpp:cancel-download',
  'sdcpp:delete-file',
  'sdcpp:download-engine',
  'sdcpp:download-file',
  'sdcpp:fetch-releases',
  'sdcpp:get-device',
  'sdcpp:get-folder',
  'sdcpp:get-mirrors',
  'sdcpp:init-default-folder',
  'sdcpp:list-files',
  'sdcpp:remove-mirror',
  'sdcpp:set-device',
  'sdcpp:test-mirrors',
  'weights:check-folder',
  'weights:delete-file',
  'weights:download-file',
  'weights:get-folder',
  'weights:init-default-folder',
  'weights:list-files',
  'weights:select-file',
  'weights:set-folder',
] as const

export const IPC_EVENT_CHANNELS = [
  'generate:cli-output',
  'generate:preview-update',
  'generate:progress',
  'generate-video:cli-output',
  'generate-video:progress',
  'model-groups:export-progress',
  'model-groups:import-progress',
  'sdcpp:download-progress',
  'models:download-progress',
] as const

export const IPC_EVENT_PATTERNS = [
  /^sdcpp:(stdout|stderr|exit|error):/,
]

export type IpcInvokeChannel = typeof IPC_INVOKE_CHANNELS[number]
export type IpcEventChannel = typeof IPC_EVENT_CHANNELS[number]

export interface IPCRequestMap {
  'weights:init-default-folder': { request: void; response: string }
  'weights:check-folder': { request: string; response: boolean }
  'weights:set-folder': { request: string; response: boolean }
  'weights:get-folder': { request: void; response: string | null }
  'weights:list-files': { request: string; response: WeightFile[] }
  'weights:select-file': { request: void; response: string | null }
  'weights:download-file': { request: string; response: boolean }
  'weights:delete-file': { request: string; response: boolean }

  'sdcpp:init-default-folder': { request: void; response: string }
  'sdcpp:get-folder': { request: void; response: string | null }
  'sdcpp:set-device': { request: DeviceType; response: boolean }
  'sdcpp:get-device': { request: void; response: DeviceType }
  'sdcpp:list-files': { request: [string, DeviceType]; response: { files: WeightFile[]; version: string | null } }
  'sdcpp:download-file': { request: string; response: boolean }
  'sdcpp:delete-file': { request: string; response: boolean }
  'sdcpp:fetch-releases': { request: { mirrorId?: string; count?: number }; response: SDCppRelease[] }
  'sdcpp:download-engine': { request: { asset: SDCppReleaseAsset; release: SDCppRelease; mirrorId?: string }; response: { success: boolean; error?: string } }
  'sdcpp:cancel-download': { request: void; response: boolean }
  'sdcpp:get-mirrors': { request: void; response: MirrorSource[] }
  'sdcpp:add-mirror': { request: Omit<MirrorSource, 'id' | 'builtin'>; response: MirrorSource }
  'sdcpp:remove-mirror': { request: string; response: boolean }
  'sdcpp:test-mirrors': { request: void; response: MirrorTestResult[] }
  'sdcpp:auto-select-mirror': { request: void; response: MirrorSource }

  'models:get-hf-mirror': { request: void; response: HfMirrorId }
  'models:set-hf-mirror': { request: HfMirrorId; response: boolean }
  'models:download-group-files': { request: { groupId: string; mirrorId?: HfMirrorId }; response: { success: boolean; error?: string } }
  'models:cancel-download': { request: void; response: boolean }
  'models:check-files': { request: { groupId: string }; response: Array<{ file: string; exists: boolean; size?: number }> }

  'model-groups:list': { request: void; response: ModelGroup[] }
  'model-groups:create': { request: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>; response: ModelGroup }
  'model-groups:update': { request: { id: string; updates: Partial<Omit<ModelGroup, 'id' | 'createdAt'>> }; response: ModelGroup }
  'model-groups:delete': { request: { id: string; deleteFiles?: boolean }; response: boolean }
  'model-groups:get': { request: string; response: ModelGroup | null }
  'model-groups:select-folder': { request: void; response: string | null }
  'model-groups:import': { request: { folderPath: string; targetFolder: string }; response: { success: boolean; message?: string; group?: ModelGroup; error?: string } }
  'model-groups:build-and-export': { request: Omit<ModelGroup, 'id' | 'createdAt' | 'updatedAt'>; response: { success: boolean; message?: string; exportPath?: string; error?: string } }

  'generate:start': { request: GenerateImageParams; response: { success: boolean; image?: string; imagePath?: string; duration?: number; error?: string } }
  'generate:cancel': { request: void; response: { success: boolean; message?: string; error?: string } }

  'generate-video:start': { request: GenerateImageParams & { frames?: number; fps?: number; mode?: string }; response: { success: boolean; video?: string; videoPath?: string; duration?: number; frames?: string[]; error?: string } }
  'generate-video:cancel': { request: void; response: boolean }

  'generated-images:list': { request: void; response: GeneratedImageInfo[] }
  'generated-images:download': { request: string; response: boolean }
  'generated-images:delete': { request: string; response: boolean }
  'generated-images:get-preview': { request: string; response: string }
  'generated-images:get-video-data': { request: string; response: { data: number[]; mimeType: string } }
  'generated-images:batch-download': { request: [string[]]; response: { success: boolean; zipPath?: string; size?: number; canceled?: boolean } }

  'dialog:open-image': { request: void; response: string | null }
  'edit-image:select-file': { request: void; response: string | null }
  'edit-image:read-image-base64': { request: string; response: string }

  'devtools:toggle': { request: void; response: { success: boolean; isOpen?: boolean; error?: string } }
  'app:get-version': { request: void; response: string }

  'aliyun-api:call': { request: { method: string; url: string; headers?: Record<string, string>; body?: unknown }; response: { status: number; statusText: string; data?: unknown; error?: string } }

  'perfect-pixel:select-image': { request: void; response: string | null }
  'perfect-pixel:read-image': { request: string; response: string }
  'perfect-pixel:save': { request: string; response: { success: boolean; filePath?: string } }
}

export interface IPCEventMap {
  'model-groups:import-progress': { progress: number; copied: number; total: number; fileName: string }
  'model-groups:export-progress': { progress: number; copied: number; total: number; fileName: string }
  'generate:progress': { progress: string | number; image?: string }
  'generate:cli-output': { type: 'stdout' | 'stderr'; text: string }
  'generate:preview-update': { previewImage: string }
  'generate-video:progress': { progress: string | number; video?: string; frames?: string[] }
  'generate-video:cli-output': { type: 'stdout' | 'stderr'; text: string }
  'sdcpp:download-progress': SDCppDownloadProgress
  'models:download-progress': ModelDownloadProgress
}

export type IpcInvokeArgs<C extends IpcInvokeChannel> = IPCRequestMap[C]['request'] extends void
  ? []
  : IPCRequestMap[C]['request'] extends any[]
    ? IPCRequestMap[C]['request']
    : [IPCRequestMap[C]['request']]

export type IpcInvokeResponse<C extends IpcInvokeChannel> = IPCRequestMap[C]['response']

const invokeChannelSet = new Set<string>(IPC_INVOKE_CHANNELS as readonly string[])
const eventChannelSet = new Set<string>(IPC_EVENT_CHANNELS as readonly string[])

export const isAllowedInvokeChannel = (channel: string): channel is IpcInvokeChannel => invokeChannelSet.has(channel)
export const isAllowedSendChannel = (channel: string): channel is IpcInvokeChannel => invokeChannelSet.has(channel)
export const isAllowedEventChannel = (channel: string): channel is IpcEventChannel =>
  eventChannelSet.has(channel) || IPC_EVENT_PATTERNS.some((pattern) => pattern.test(channel))
