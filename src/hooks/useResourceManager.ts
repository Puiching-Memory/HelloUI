import { useRef, useEffect } from 'react';
import { ResourceManager } from '../utils/ResourceManager';

/**
 * React Hook：自动管理 useEffect 中的资源
 * 在组件卸载时自动清理所有注册的资源
 * 
 * @example
 * ```tsx
 * const resourceManager = useResourceManager();
 * 
 * useEffect(() => {
 *   const intervalId = setInterval(() => {
 *     console.log('tick');
 *   }, 1000);
 *   
 *   resourceManager.register(
 *     () => clearInterval(intervalId),
 *     'interval'
 *   );
 * }, []);
 * ```
 */
export function useResourceManager(): ResourceManager {
  const managerRef = useRef<ResourceManager | null>(null);
  
  if (managerRef.current === null) {
    managerRef.current = new ResourceManager();
  }
  
  useEffect(() => {
    const manager = managerRef.current;
    return () => {
      if (manager) {
        manager.cleanupAll();
      }
    };
  }, []);
  
  return managerRef.current;
}

