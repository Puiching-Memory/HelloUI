import { useState, useEffect, useCallback } from 'react'
import type { ModelGroup, TaskType } from '../../shared/types'
import { modelWeightsService } from '@/features/model-weights/services/modelWeightsService'

type FileStatus = { file: string; exists: boolean; size?: number; verified: boolean; expectedSize?: number }

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
      const groups = await modelWeightsService.listModelGroups()
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
        const result = await modelWeightsService.checkModelGroupFiles(group.id)
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
