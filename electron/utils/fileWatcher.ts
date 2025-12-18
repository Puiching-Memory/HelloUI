import { watchFile, unwatchFile, watch, Stats } from 'fs';
import { PathLike } from 'fs';

/**
 * 文件监控工具
 * 封装文件监控逻辑，自动选择正确的 API
 * - watchFile: 用于监控单个文件（使用轮询）
 * - watch: 用于监控目录
 */
export class FileWatcher {
  private watchedFiles: Map<string, () => void> = new Map();
  private watchedDirs: Map<string, () => void> = new Map();

  /**
   * 监控单个文件
   * @param path 文件路径
   * @param callback 回调函数，当文件变化时调用
   * @param options 监控选项
   * @returns 清理函数，调用后停止监控
   */
  watchFile(
    path: PathLike,
    callback: (curr: Stats, prev: Stats) => void,
    options?: { interval?: number; persistent?: boolean }
  ): () => void {
    const pathStr = path.toString();
    
    // 如果已经在监控，先停止
    const existingCleanup = this.watchedFiles.get(pathStr);
    if (existingCleanup) {
      existingCleanup();
    }

    // 开始监控
    watchFile(path, options || { interval: 200 }, callback);

    // 创建清理函数
    const cleanup = () => {
      unwatchFile(path);
      this.watchedFiles.delete(pathStr);
    };

    this.watchedFiles.set(pathStr, cleanup);
    return cleanup;
  }

  /**
   * 监控目录
   * @param path 目录路径
   * @param callback 回调函数，当目录内容变化时调用
   * @returns 清理函数，调用后停止监控
   */
  watchDirectory(
    path: PathLike,
    callback: (eventType: string, filename: string | null) => void
  ): () => void {
    const pathStr = path.toString();
    
    // 如果已经在监控，先停止
    const existingCleanup = this.watchedDirs.get(pathStr);
    if (existingCleanup) {
      existingCleanup();
    }

    // 开始监控
    const watcher = watch(path, { persistent: true }, callback);

    // 创建清理函数
    const cleanup = () => {
      watcher.close();
      this.watchedDirs.delete(pathStr);
    };

    this.watchedDirs.set(pathStr, cleanup);
    return cleanup;
  }

  /**
   * 停止监控指定文件
   * @param path 文件路径
   */
  unwatchFile(path: PathLike): void {
    const pathStr = path.toString();
    const cleanup = this.watchedFiles.get(pathStr);
    if (cleanup) {
      cleanup();
    }
  }

  /**
   * 停止监控指定目录
   * @param path 目录路径
   */
  unwatchDirectory(path: PathLike): void {
    const pathStr = path.toString();
    const cleanup = this.watchedDirs.get(pathStr);
    if (cleanup) {
      cleanup();
    }
  }

  /**
   * 停止所有监控
   */
  cleanupAll(): void {
    // 清理所有文件监控
    this.watchedFiles.forEach((cleanup) => {
      cleanup();
    });
    this.watchedFiles.clear();

    // 清理所有目录监控
    this.watchedDirs.forEach((cleanup) => {
      cleanup();
    });
    this.watchedDirs.clear();
  }

  /**
   * 获取当前监控的文件数量
   */
  getWatchedFileCount(): number {
    return this.watchedFiles.size;
  }

  /**
   * 获取当前监控的目录数量
   */
  getWatchedDirectoryCount(): number {
    return this.watchedDirs.size;
  }
}

