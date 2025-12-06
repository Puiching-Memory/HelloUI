/**
 * 统一的资源管理器
 * 自动跟踪和清理所有资源（intervals、timeouts、监听器等）
 */
export class ResourceManager {
  private resources: Map<string, { cleanup: () => void; type: string }> = new Map();
  private nextId = 0;

  /**
   * 注册一个资源
   * @param cleanup 清理函数
   * @param type 资源类型（如 'interval', 'timeout', 'listener', 'watcher'）
   * @returns 资源ID，用于后续取消注册
   */
  register(cleanup: () => void, type: string): string {
    const id = `resource_${this.nextId++}_${type}`;
    this.resources.set(id, { cleanup, type });
    return id;
  }

  /**
   * 取消注册一个资源
   * @param id 资源ID
   */
  unregister(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      try {
        resource.cleanup();
      } catch (error) {
        console.error(`[ResourceManager] Error cleaning up resource ${id}:`, error);
      }
      this.resources.delete(id);
    }
  }

  /**
   * 清理所有资源
   */
  cleanupAll(): void {
    const resources = Array.from(this.resources.entries());
    this.resources.clear();
    
    for (const [id, resource] of resources) {
      try {
        resource.cleanup();
      } catch (error) {
        console.error(`[ResourceManager] Error cleaning up resource ${id}:`, error);
      }
    }
  }

  /**
   * 按类型清理资源
   * @param type 资源类型
   */
  cleanupByType(type: string): void {
    const toRemove: string[] = [];
    
    for (const [id, resource] of this.resources.entries()) {
      if (resource.type === type) {
        try {
          resource.cleanup();
        } catch (error) {
          console.error(`[ResourceManager] Error cleaning up resource ${id}:`, error);
        }
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      this.resources.delete(id);
    }
  }

  /**
   * 获取当前注册的资源数量
   */
  getResourceCount(): number {
    return this.resources.size;
  }

  /**
   * 获取指定类型的资源数量
   */
  getResourceCountByType(type: string): number {
    let count = 0;
    for (const resource of this.resources.values()) {
      if (resource.type === type) {
        count++;
      }
    }
    return count;
  }
}

