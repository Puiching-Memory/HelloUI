import { useState, useEffect, useCallback } from 'react'
import type { DeviceType, ModelGroup, TaskType } from '../../shared/types'

/**
 * 等待 ipcRenderer 可用后执行回调
 */
function waitForIpc(callback: () => void, maxRetries = 50) {
  let retryCount = 0
  const check = () => {
    if (window.ipcRenderer) {
      callback()
    } else if (retryCount < maxRetries) {
      retryCount++
      setTimeout(check, 100)
    } else {
      console.error('window.ipcRenderer is not available after maximum retries')
    }
  }
  check()
}

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
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available')
        setModelGroups([])
        return
      }
      setLoading(true)
      const groups = await window.ipcRenderer.invoke('model-groups:list')
      const filtered = (groups || []).filter((g: any) => g.taskType === taskType)
      setModelGroups(filtered)
    } catch (error) {
      console.error('Failed to load model groups:', error)
      setModelGroups([])
    } finally {
      setLoading(false)
    }
  }, [taskType])

  useEffect(() => {
    waitForIpc(() => {
      loadModelGroups().catch(console.error)
    })
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
      if (!window.ipcRenderer) return
      const device = await window.ipcRenderer.invoke('sdcpp:get-device')
      if (device) setDeviceType(device as DeviceType)
    } catch (error) {
      console.error('Failed to load device type:', error)
    }
  }, [])

  useEffect(() => {
    waitForIpc(() => {
      loadDeviceType().catch(console.error)
    })
  }, [loadDeviceType])

  const handleDeviceTypeChange = useCallback(async (value: DeviceType) => {
    setDeviceType(value)
    try {
      if (!window.ipcRenderer) return
      await window.ipcRenderer.invoke('sdcpp:set-device', value)
    } catch (error) {
      console.error('Failed to set device type:', error)
    }
  }, [])

  return { deviceType, setDeviceType, handleDeviceTypeChange }
}
