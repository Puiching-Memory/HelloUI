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
  RadioGroup,
  Radio,
  Label,
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
  deviceSelection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
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
});

interface EngineFile {
  name: string;
  size: number;
  path: string;
  modified: number;
}

type DeviceType = 'cpu' | 'vulkan' | 'cuda';

export const SDCppPage = () => {
  const styles = useStyles();
  const [engineFolder, setEngineFolder] = useState<string>('');
  const [deviceType, setDeviceType] = useState<DeviceType>('cpu');
  const [files, setFiles] = useState<EngineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 加载引擎文件夹路径和设备类型
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        loadEngineFolder().catch(console.error),
        loadDeviceType().catch(console.error),
      ]);
      setIsInitialized(true);
    };
    initialize();
  }, []);

  // 当文件夹路径或设备类型改变时，加载文件列表（仅在初始化完成后）
  useEffect(() => {
    if (isInitialized && engineFolder && deviceType) {
      loadFiles();
    }
  }, [engineFolder, deviceType, isInitialized]);

  const loadEngineFolder = async () => {
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

  const loadDeviceType = async () => {
    try {
      const device = await window.ipcRenderer.invoke('sdcpp:get-device');
      if (device) {
        setDeviceType(device as DeviceType);
      }
    } catch (error) {
      console.error('Failed to load device type:', error);
    }
  };

  const loadFiles = async (targetDeviceType?: DeviceType) => {
    const currentDeviceType = targetDeviceType || deviceType;
    if (!engineFolder || !currentDeviceType) return;
    setLoading(true);
    try {
      const devicePath = `${engineFolder}/${currentDeviceType}`;
      console.log(`[SDCppPage] Loading files from SD.cpp engine path (${currentDeviceType}): ${devicePath}`);
      const fileList = await window.ipcRenderer.invoke('sdcpp:list-files', engineFolder, currentDeviceType);
      console.log(`[SDCppPage] Found ${fileList?.length || 0} files in SD.cpp engine path`);
      setFiles(fileList || []);
    } catch (error) {
      console.error('Failed to load file list:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceTypeChange = async (value: DeviceType) => {
    // 先更新状态
    setDeviceType(value);
    try {
      // 保存设备类型到主进程
      await window.ipcRenderer.invoke('sdcpp:set-device', value);
      // 使用新的设备类型加载文件列表
      await loadFiles(value);
    } catch (error) {
      console.error('Failed to set device type:', error);
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

  return (
    <div className={styles.container}>
      <Title1>SD.cpp 推理引擎</Title1>

      {/* 设备类型选择 */}
      <Card className={styles.section}>
        <Title2>推理设备选择</Title2>
        <div className={styles.deviceSelection}>
          <Label>选择推理设备类型</Label>
          <RadioGroup
            value={deviceType}
            onChange={(_, data) => handleDeviceTypeChange(data.value as DeviceType)}
          >
            <Radio value="cpu" label="CPU" />
            <Radio value="vulkan" label="Vulkan" />
            <Radio value="cuda" label="CUDA" />
          </RadioGroup>
        </div>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          当前选择: {getDeviceLabel(deviceType)}。引擎文件将根据选择的设备类型存放在对应的子文件夹中。
        </Body1>
      </Card>

      {/* 文件列表 */}
      <Card className={styles.section}>
        <Title2>引擎文件列表 ({getDeviceLabel(deviceType)})</Title2>
        {loading && files.length === 0 ? (
          <div className={styles.emptyState}>
            <Spinner size="large" />
            <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
          </div>
        ) : files.length === 0 ? (
          <div className={styles.emptyState}>
            <Body1>暂无引擎文件</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              {engineFolder && deviceType ? '暂无引擎文件' : '请先选择设备类型'}
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
                {files.map((file) => (
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

    </div>
  );
};

