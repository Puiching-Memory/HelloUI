import { useState, useEffect, useCallback } from 'react'
import type { DeviceType, ModelGroup, TaskType } from '../../shared/types'
import { ipcInvoke } from '../lib/tauriIpc'

/**
 * 加载并管理模型组列表
 * @param taskType 任务类型过滤（如 'generate', 'edit', 'upscale', 'video'）
 */
export function useModelGroups(taskType: TaskType) {
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([])
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

  useEffect(() => {
    loadModelGroups().catch(console.error)
  }, [loadModelGroups])

  const selectedGroup = modelGroups.find((g) => g.id === selectedGroupId)

  return {
    modelGroups,
    loading,
    selectedGroupId,
    setSelectedGroupId,
    selectedGroup,
    reloadModelGroups: loadModelGroups,
  }
}

/**
 * 加载和管理 SD.cpp 设备类型
 */
export function useDeviceType() {
  const [deviceType, setDeviceType] = useState<DeviceType>('cuda')

  const loadDeviceType = useCallback(async () => {
    try {
      const device = await ipcInvoke('sdcpp:get-device')
      if (device) setDeviceType(device as DeviceType)
    } catch (error) {
      console.error('Failed to load device type:', error)
    }
  }, [])

  useEffect(() => {
    loadDeviceType().catch(console.error)
  }, [loadDeviceType])

  const handleDeviceTypeChange = useCallback(async (value: DeviceType) => {
    setDeviceType(value)
    try {
      await ipcInvoke('sdcpp:set-device', value)
    } catch (error) {
      console.error('Failed to set device type:', error)
    }
  }, [])

  return { deviceType, setDeviceType, handleDeviceTypeChange }
}
