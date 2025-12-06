/**
 * 异步操作保护器
 * 保护异步操作，防止访问已失效的资源
 * 
 * @example
 * ```ts
 * const guard = new AsyncOperationGuard();
 * 
 * // 在异步操作中检查
 * guard.execute(async () => {
 *   if (!guard.check()) return null;
 *   // 执行异步操作
 *   return await someAsyncOperation();
 * });
 * 
 * // 当需要使操作失效时
 * guard.invalidate();
 * ```
 */
export class AsyncOperationGuard {
  private isValid: boolean = true;

  /**
   * 检查操作是否仍然有效
   */
  check(): boolean {
    return this.isValid;
  }

  /**
   * 使操作失效
   */
  invalidate(): void {
    this.isValid = false;
  }

  /**
   * 重新激活操作（用于重置）
   */
  reset(): void {
    this.isValid = true;
  }

  /**
   * 执行异步操作，如果操作已失效则返回 null
   * @param fn 要执行的函数
   * @returns 执行结果，如果操作已失效则返回 null
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T | null> {
    if (!this.isValid) {
      return null;
    }
    
    try {
      const result = await fn();
      // 再次检查，防止在执行过程中被失效
      if (!this.isValid) {
        return null;
      }
      return result;
    } catch (error) {
      // 如果操作已失效，忽略错误
      if (!this.isValid) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 同步执行操作，如果操作已失效则返回 null
   * @param fn 要执行的函数
   * @returns 执行结果，如果操作已失效则返回 null
   */
  executeSync<T>(fn: () => T): T | null {
    if (!this.isValid) {
      return null;
    }
    
    try {
      const result = fn();
      // 再次检查，防止在执行过程中被失效
      if (!this.isValid) {
        return null;
      }
      return result;
    } catch (error) {
      // 如果操作已失效，忽略错误
      if (!this.isValid) {
        return null;
      }
      throw error;
    }
  }
}

