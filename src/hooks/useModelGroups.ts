import { useState, useEffect, useCallback } from 'react'
import type { DeviceType, CpuVariant, AvailableEngine, ModelGroup, TaskType } from '../../shared/types'
import { ipcInvoke } from '../lib/tauriIpc'

type FileStatus = { file: string; exists: boolean; size?: number; verified: boolean; expectedSize?: number }

export interface SelectedEngine {
  deviceType: DeviceType
  cpuVariant?: CpuVariant
}

/**
 * 加载并管理模型组列表
 * @param taskType 任务类型过滤（如 'generate', 'edit', 'upscale', 'video'）
 */
export function useModelGroups(taskType: TaskType) {
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([])
  const [fileStatusMap, setFileStatusMap] = useState<Record<string, FileStatus[]>>({})
  const [loading, setLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  const loadModelGroups = useCallback(async () => {
    try {
      setLoading(true)
      const groups = await ipcInvoke('model-groups:list')
      const filtered = (groups || []).filter((g) => g.taskType === taskType)
      setModelGroups(filtered)
    } catch (error) {
      console.error('Failed to load model groups:', error)
      setModelGroups([])
    } finally {
      setLoading(false)
    }
  }, [taskType])

  const checkAllGroupFiles = useCallback(async () => {
    const statusMap: Record<string, FileStatus[]> = {}
    for (const group of modelGroups) {
      try {
        const result = await ipcInvoke('models:check-files', { groupId: group.id })
        statusMap[group.id] = result
      } catch (error) {
        console.error(`Failed to check files for group ${group.id}:`, error)
        statusMap[group.id] = []
      }
    }
    setFileStatusMap(statusMap)
  }, [modelGroups])

  useEffect(() => {
    loadModelGroups().catch(console.error)
  }, [loadModelGroups])

  useEffect(() => {
    if (modelGroups.length > 0) {
      checkAllGroupFiles()
    }
  }, [modelGroups, checkAllGroupFiles])

  const isGroupComplete = useCallback((groupId: string): boolean => {
    const status = fileStatusMap[groupId]
    if (!status || status.length === 0) return false
    return status.every(f => f.exists && f.verified)
  }, [fileStatusMap])

  const selectedGroup = modelGroups.find((g) => g.id === selectedGroupId)

  return {
    modelGroups,
    fileStatusMap,
    loading,
    selectedGroupId,
    setSelectedGroupId,
    selectedGroup,
    isGroupComplete,
    reloadModelGroups: loadModelGroups,
    checkAllGroupFiles,
  }
}

/**
 * 加载和管理 SD.cpp 设备类型
 */
export function useDeviceType() {
  const [deviceType, setDeviceType] = useState<DeviceType>('cuda')
  const [cpuVariant, setCpuVariant] = useState<CpuVariant | undefined>(undefined)
  const [availableEngines, setAvailableEngines] = useState<AvailableEngine[]>([])

  const loadAvailableEngines = useCallback(async () => {
    try {
      const engines = await ipcInvoke('system:get-available-engines')
      setAvailableEngines(engines as AvailableEngine[])
      return engines as AvailableEngine[]
    } catch (error) {
      console.error('Failed to load available engines:', error)
      setAvailableEngines([])
      return []
    }
  }, [])

  const loadDeviceType = useCallback(async (engines: AvailableEngine[]) => {
    try {
      const saved = await ipcInvoke('sdcpp:get-device') as string
      const parsed = parseDeviceString(saved)
      
      const matched = engines.find(
        e => e.deviceType === parsed.deviceType && 
             (e.deviceType !== 'cpu' || e.cpuVariant === parsed.cpuVariant)
      )
      
      if (matched) {
        setDeviceType(matched.deviceType)
        setCpuVariant(matched.cpuVariant)
      } else if (engines.length > 0) {
        const preferredOrder: DeviceType[] = ['cuda', 'vulkan', 'rocm', 'cpu']
        const defaultEngine = engines.find(e => preferredOrder.includes(e.deviceType)) || engines[0]
        setDeviceType(defaultEngine.deviceType)
        setCpuVariant(defaultEngine.cpuVariant)
        await ipcInvoke('sdcpp:set-device', formatDeviceString(defaultEngine.deviceType, defaultEngine.cpuVariant))
      }
    } catch (error) {
      console.error('Failed to load device type:', error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const engines = await loadAvailableEngines()
      if (engines.length > 0) {
        await loadDeviceType(engines)
      }
    }
    init().catch(console.error)
  }, [loadAvailableEngines, loadDeviceType])

  const handleDeviceTypeChange = useCallback(async (engine: AvailableEngine) => {
    setDeviceType(engine.deviceType)
    setCpuVariant(engine.cpuVariant)
    try {
      await ipcInvoke('sdcpp:set-device', formatDeviceString(engine.deviceType, engine.cpuVariant))
    } catch (error) {
      console.error('Failed to set device type:', error)
    }
  }, [])

  const selectedEngine: SelectedEngine = {
    deviceType,
    cpuVariant,
  }

  return { 
    deviceType, 
    cpuVariant,
    selectedEngine,
    setDeviceType, 
    handleDeviceTypeChange, 
    availableEngines 
  }
}

function parseDeviceString(value: string): SelectedEngine {
  if (value.startsWith('cpu-')) {
    const variant = value.substring(4) as CpuVariant
    return { deviceType: 'cpu', cpuVariant: variant }
  }
  return { deviceType: value as DeviceType, cpuVariant: undefined }
}

function formatDeviceString(deviceType: DeviceType, cpuVariant?: CpuVariant): string {
  if (deviceType === 'cpu' && cpuVariant) {
    return `cpu-${cpuVariant}`
  }
  return deviceType
}
