/// <reference types="../vite-env" />
import {
  Card,
  Title1,
  Title2,
  Body1,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  makeStyles,
  tokens,
  Spinner,
  Tooltip,
} from '@fluentui/react-components';
import { useState, useEffect } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1400px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  tableContainer: {
    overflowX: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  truncatedText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    width: '100%',
  },
  tableCellFileName: {
    maxWidth: '400px',
    minWidth: '200px',
    overflow: 'hidden',
  },
  tableCellSize: {
    maxWidth: '150px',
    minWidth: '100px',
    overflow: 'hidden',
  },
  tableCellDate: {
    maxWidth: '200px',
    minWidth: '150px',
    overflow: 'hidden',
  },
  tableCellVersion: {
    maxWidth: '200px',
    minWidth: '150px',
    overflow: 'hidden',
  },
});

interface EngineFile {
  name: string;
  size: number;
  path: string;
  modified: number;
  deviceType: DeviceType;
}

type DeviceType = 'cpu' | 'vulkan' | 'cuda';

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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getDeviceLabel = (device: DeviceType): string => {
    switch (device) {
      case 'cpu':
        return 'CPU';
      case 'vulkan':
        return 'Vulkan';
      case 'cuda':
        return 'CUDA';
      default:
        return device;
    }
  };

  // 按设备类型分组文件
  const filesByDevice = files.reduce((acc, file) => {
    if (!acc[file.deviceType]) {
      acc[file.deviceType] = [];
    }
    acc[file.deviceType].push(file);
    return acc;
  }, {} as Record<DeviceType, EngineFile[]>);

  // 渲染单个设备类型的文件列表
  const renderDeviceFileList = (deviceType: DeviceType) => {
    const deviceFiles = filesByDevice[deviceType] || [];
    const deviceLabel = getDeviceLabel(deviceType);
    const version = deviceVersions[deviceType];

    return (
      <Card className={styles.section} key={deviceType}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalM }}>
          <Title2>{deviceLabel} 引擎文件</Title2>
          {version && (
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
              版本: {version}
            </Body1>
          )}
        </div>
        {loading && deviceFiles.length === 0 ? (
          <div className={styles.emptyState}>
            <Spinner size="large" />
            <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
          </div>
        ) : deviceFiles.length === 0 ? (
          <div className={styles.emptyState}>
            <Body1>暂无引擎文件</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              {deviceLabel} 设备类型下暂无引擎文件
            </Body1>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>文件名</TableHeaderCell>
                  <TableHeaderCell>大小</TableHeaderCell>
                  <TableHeaderCell>修改时间</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviceFiles.map((file) => (
                  <TableRow key={file.path}>
                    <TableCell className={styles.tableCellFileName}>
                      <Tooltip content={file.name} relationship="label">
                        <div className={styles.truncatedText} title={file.name}>
                          <Body1>{file.name}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell className={styles.tableCellSize}>
                      <Tooltip content={formatFileSize(file.size)} relationship="label">
                        <div className={styles.truncatedText} title={formatFileSize(file.size)}>
                          <Body1>{formatFileSize(file.size)}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                    <TableCell className={styles.tableCellDate}>
                      <Tooltip content={formatDate(file.modified)} relationship="label">
                        <div className={styles.truncatedText} title={formatDate(file.modified)}>
                          <Body1>{formatDate(file.modified)}</Body1>
                        </div>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className={styles.container}>
      <Title1>SD.cpp 推理引擎</Title1>

      {/* 按设备类型分组的文件列表 */}
      {renderDeviceFileList('cpu')}
      {renderDeviceFileList('cuda')}
      {renderDeviceFileList('vulkan')}
    </div>
  );
};

