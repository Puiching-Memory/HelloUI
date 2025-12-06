/**
 * 模型相关类型定义（前后端共享）
 */

export interface WeightFile {
  name: string;
  size: number;
  path: string;
  modified: number;
}

export interface ModelGroup {
  id: string;
  name: string;
  sdModel?: string;
  vaeModel?: string;
  llmModel?: string;
  defaultSteps?: number;
  defaultCfgScale?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultSamplingMethod?: string;
  defaultScheduler?: string;
  defaultSeed?: number;
  createdAt: number;
  updatedAt: number;
}

