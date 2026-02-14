import { useState, useEffect, useCallback } from 'react'
import type { DeviceType, ModelGroup, TaskType } from '../../shared/types'
import { ipcInvoke } from '../lib/tauriIpc'

type FileStatus = { file: string; exists: boolean; size?: number }

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
    return status.every(f => f.exists)
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
  const [availableEngines, setAvailableEngines] = useState<DeviceType[]>([])

  const loadDeviceType = useCallback(async () => {
    try {
      const device = await ipcInvoke('sdcpp:get-device')
      if (device) setDeviceType(device as DeviceType)
    } catch (error) {
      console.error('Failed to load device type:', error)
    }
  }, [])

  const loadAvailableEngines = useCallback(async () => {
    try {
      const engines = await ipcInvoke('system:get-available-engines')
      setAvailableEngines(engines as DeviceType[])
    } catch (error) {
      console.error('Failed to load available engines:', error)
      setAvailableEngines([])
    }
  }, [])

  useEffect(() => {
    loadDeviceType().catch(console.error)
    loadAvailableEngines().catch(console.error)
  }, [loadDeviceType, loadAvailableEngines])

  const handleDeviceTypeChange = useCallback(async (value: DeviceType) => {
    setDeviceType(value)
    try {
      await ipcInvoke('sdcpp:set-device', value)
    } catch (error) {
      console.error('Failed to set device type:', error)
    }
  }, [])

  return { deviceType, setDeviceType, handleDeviceTypeChange, availableEngines }
}
