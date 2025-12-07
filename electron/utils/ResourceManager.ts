/**
 * Node.js 环境的资源管理器
 * 用于 Electron 主进程中的资源管理
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
      resource.cleanup();
      this.resources.delete(id);
    }
  }

  /**
   * 清理所有资源
   */
  cleanupAll(): void {
    const resources = Array.from(this.resources.values());
    this.resources.clear();
    
    for (const resource of resources) {
      resource.cleanup();
    }
  }

  /**
   * 按类型清理资源
   * @param type 资源类型
   */
  cleanupByType(type: string): void {
    for (const [id, resource] of this.resources.entries()) {
      if (resource.type === type) {
        resource.cleanup();
        this.resources.delete(id);
      }
    }
  }

  /**
   * 获取当前注册的资源数量
   */
  getResourceCount(): number {
    return this.resources.size;
  }
}

