/// <reference types="../vite-env" />
import {
  Card,
  Title1,
  Title2,
  Body1,
  makeStyles,
  tokens,
  Spinner,
} from '@fluentui/react-components';
import { useState, useEffect } from 'react';
import type { DeviceType } from '../../shared/types';
import { formatFileSize } from '@/utils/format';
import { getDeviceLabel } from '@/utils/modelUtils';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1400px',
    margin: '0 auto',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  engineCard: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  engineInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  infoValue: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
});

interface EngineFile {
  name: string;
  size: number;
  path: string;
  modified: number;
  deviceType: DeviceType;
}

export const SDCppPage = () => {
  const styles = useStyles();
  const [engineFolder, setEngineFolder] = useState<string>('');
  const [files, setFiles] = useState<EngineFile[]>([]);
  const [deviceVersions, setDeviceVersions] = useState<Record<DeviceType, string | null>>({
    cpu: null,
    vulkan: null,
    cuda: null,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 加载引擎文件夹路径
  useEffect(() => {
    const initialize = async () => {
      await loadEngineFolder().catch(console.error);
      setIsInitialized(true);
    };
    initialize();
  }, []);

  // 当文件夹路径改变时，加载文件列表（仅在初始化完成后）
  useEffect(() => {
    if (isInitialized && engineFolder) {
      loadFiles();
    }
  }, [engineFolder, isInitialized]);

  const loadEngineFolder = async () => {
    if (!window.ipcRenderer) {
      return;
    }
    
    try {
      let folder = await window.ipcRenderer.invoke('sdcpp:get-folder');
      
      if (!folder) {
        folder = await window.ipcRenderer.invoke('sdcpp:init-default-folder');
      }
      
      if (folder) {
        console.log(`[SDCppPage] SD.cpp engine search path: ${folder}`);
        setEngineFolder(folder);
      }
    } catch (error) {
      console.error('Failed to load engine folder:', error);
    }
  };

  const loadFiles = async () => {
    if (!engineFolder || !window.ipcRenderer) return;
    setLoading(true);
    try {
      // 加载所有设备类型的文件和版本号
      const deviceTypes: DeviceType[] = ['cpu', 'vulkan', 'cuda'];
      const allFilesPromises = deviceTypes.map(async (deviceType) => {
        try {
          const result = await window.ipcRenderer.invoke('sdcpp:list-files', engineFolder, deviceType);
          // 为每个文件添加设备类型信息
          const files = (result?.files || []).map((file: Omit<EngineFile, 'deviceType'>) => ({
            ...file,
            deviceType,
          }));
          return { files, version: result?.version || null, deviceType };
        } catch (error) {
          console.error(`Failed to load files for ${deviceType}:`, error);
          return { files: [], version: null, deviceType };
        }
      });

      const results = await Promise.all(allFilesPromises);
      const allFiles = results.flatMap(r => r.files);
      const versions: Record<DeviceType, string | null> = {
        cpu: null,
        vulkan: null,
        cuda: null,
      };
      
      // 收集版本号信息
      results.forEach(r => {
        versions[r.deviceType] = r.version;
      });
      
      // 按修改时间降序排序
      allFiles.sort((a, b) => b.modified - a.modified);
      
      console.log(`[SDCppPage] Found ${allFiles.length} files across all device types`);
      setFiles(allFiles);
      setDeviceVersions(versions);
    } catch (error) {
      console.error('Failed to load file list:', error);
      setFiles([]);
      setDeviceVersions({ cpu: null, vulkan: null, cuda: null });
    } finally {
      setLoading(false);
    }
  };



  // 按设备类型计算引擎概览
  const engineSummaries = (['cpu', 'vulkan', 'cuda'] as DeviceType[]).map((deviceType) => {
    const deviceFiles = files.filter(f => f.deviceType === deviceType);
    const totalSize = deviceFiles.reduce((sum, file) => sum + file.size, 0);
    const version = deviceVersions[deviceType];
    const label = getDeviceLabel(deviceType);
    const hasFiles = deviceFiles.length > 0;

    return {
      type: deviceType,
      label,
      totalSize,
      version,
      hasFiles
    };
  });

  return (
    <div className={styles.container}>
      <Title1>SD.cpp 推理引擎</Title1>

      {loading && files.length === 0 ? (
        <div className={styles.emptyState}>
          <Spinner size="large" />
          <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
        </div>
      ) : (
        <div className={styles.summaryGrid}>
          {engineSummaries.map((summary) => (
            <Card className={styles.engineCard} key={summary.type}>
              <div className={styles.engineInfoRow}>
                <Title2>{summary.label} 引擎</Title2>
              </div>
              
              {!summary.hasFiles ? (
                <Body1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                  暂无相关文件
                </Body1>
              ) : (
                <>
                  <div className={styles.engineInfoRow} style={{ marginTop: tokens.spacingVerticalM }}>
                    <span className={styles.infoLabel}>当前版本</span>
                    <span className={styles.infoValue}>{summary.version || '未知'}</span>
                  </div>
                  
                  <div className={styles.engineInfoRow}>
                    <span className={styles.infoLabel}>占用空间</span>
                    <span className={styles.infoValue}>{formatFileSize(summary.totalSize)}</span>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

