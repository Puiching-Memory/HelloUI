import { describe, it, expect, vi } from 'vitest'
import { ResourceManager } from './ResourceManager'

describe('ResourceManager', () => {
  it('should start with zero resources', () => {
    const rm = new ResourceManager()
    expect(rm.getResourceCount()).toBe(0)
  })

  it('should register a resource and increment count', () => {
    const rm = new ResourceManager()
    const cleanup = vi.fn()
    const id = rm.register(cleanup, 'interval')
    expect(id).toContain('interval')
    expect(rm.getResourceCount()).toBe(1)
  })

  it('should unregister a resource and call cleanup', () => {
    const rm = new ResourceManager()
    const cleanup = vi.fn()
    const id = rm.register(cleanup, 'timeout')
    rm.unregister(id)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(rm.getResourceCount()).toBe(0)
  })

  it('should not throw when unregistering non-existent resource', () => {
    const rm = new ResourceManager()
    expect(() => rm.unregister('non-existent')).not.toThrow()
  })

  it('should cleanup all resources', () => {
    const rm = new ResourceManager()
    const cleanup1 = vi.fn()
    const cleanup2 = vi.fn()
    const cleanup3 = vi.fn()
    rm.register(cleanup1, 'interval')
    rm.register(cleanup2, 'timeout')
    rm.register(cleanup3, 'watcher')

    rm.cleanupAll()

    expect(cleanup1).toHaveBeenCalledOnce()
    expect(cleanup2).toHaveBeenCalledOnce()
    expect(cleanup3).toHaveBeenCalledOnce()
    expect(rm.getResourceCount()).toBe(0)
  })

  it('should cleanup resources by type', () => {
    const rm = new ResourceManager()
    const cleanupInterval1 = vi.fn()
    const cleanupInterval2 = vi.fn()
    const cleanupTimeout = vi.fn()
    rm.register(cleanupInterval1, 'interval')
    rm.register(cleanupInterval2, 'interval')
    rm.register(cleanupTimeout, 'timeout')

    rm.cleanupByType('interval')

    expect(cleanupInterval1).toHaveBeenCalledOnce()
    expect(cleanupInterval2).toHaveBeenCalledOnce()
    expect(cleanupTimeout).not.toHaveBeenCalled()
    expect(rm.getResourceCount()).toBe(1)
  })

  it('should generate unique ids', () => {
    const rm = new ResourceManager()
    const id1 = rm.register(() => {}, 'a')
    const id2 = rm.register(() => {}, 'a')
    expect(id1).not.toBe(id2)
  })
})
