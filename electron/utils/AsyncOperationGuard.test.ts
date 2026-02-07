import { describe, it, expect } from 'vitest'
import { AsyncOperationGuard } from './AsyncOperationGuard'

describe('AsyncOperationGuard', () => {
  it('should be valid initially', () => {
    const guard = new AsyncOperationGuard()
    expect(guard.check()).toBe(true)
  })

  it('should become invalid after invalidate()', () => {
    const guard = new AsyncOperationGuard()
    guard.invalidate()
    expect(guard.check()).toBe(false)
  })

  it('should become valid again after reset()', () => {
    const guard = new AsyncOperationGuard()
    guard.invalidate()
    guard.reset()
    expect(guard.check()).toBe(true)
  })

  it('execute() should return result when valid', async () => {
    const guard = new AsyncOperationGuard()
    const result = await guard.execute(() => 42)
    expect(result).toBe(42)
  })

  it('execute() should return null when invalidated before call', async () => {
    const guard = new AsyncOperationGuard()
    guard.invalidate()
    const result = await guard.execute(() => 42)
    expect(result).toBeNull()
  })

  it('execute() should return null when invalidated during async operation', async () => {
    const guard = new AsyncOperationGuard()
    const result = await guard.execute(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      guard.invalidate()
      return 42
    })
    expect(result).toBeNull()
  })

  it('executeSync() should return result when valid', () => {
    const guard = new AsyncOperationGuard()
    const result = guard.executeSync(() => 'hello')
    expect(result).toBe('hello')
  })

  it('executeSync() should return null when invalidated', () => {
    const guard = new AsyncOperationGuard()
    guard.invalidate()
    const result = guard.executeSync(() => 'hello')
    expect(result).toBeNull()
  })
})
