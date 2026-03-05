import {
  Card,
  Title1,
  Title2,
  Body1,
  Button,
  makeStyles,
  tokens,
  RadioGroup,
  Radio,
  Dropdown,
  Option,
  Spinner,
} from '@/ui/components';
import { CodeRegular, CheckmarkCircleFilled } from '@/ui/icons';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore, type ThemeMode } from '../hooks/useAppStore';
import { useDownloadConfig } from '../hooks/useDownloadConfig';
import { ipcInvoke } from '../lib/tauriIpc';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1200px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM,
  },
  themeCard: {
    position: 'relative',
    cursor: 'pointer',
    border: `2px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    ':hover': {
      border: `2px solid ${tokens.colorBrandStroke1}`,
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8,
    },
  },
  themeCardSelected: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    boxShadow: tokens.shadow8,
  },
  themePreview: {
    display: 'flex',
    gap: '4px',
    marginBottom: tokens.spacingVerticalXS,
  },
  themeColorSwatch: {
    flex: 1,
    height: '40px',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  themeName: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  themeDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  checkmarkIcon: {
    position: 'absolute',
    top: tokens.spacingVerticalS,
    right: tokens.spacingVerticalS,
    color: tokens.colorBrandForeground1,
  },
});

export const SettingsPage = () => {
  const styles = useStyles();
  const { themeMode, setThemeMode, colorScheme, setColorScheme } = useAppStore();
  const { config: downloadConfig, isLoading: configLoading, loadConfig, setConfig } = useDownloadConfig();
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const initialChunkSize = useMemo(() => downloadConfig?.chunkSizeMb ?? 10, [downloadConfig]);
  const initialMaxConcurrent = useMemo(() => downloadConfig?.maxConcurrentChunks ?? 4, [downloadConfig]);
  const [chunkSizeMb, setChunkSizeMb] = useState(initialChunkSize);
  const [maxConcurrentChunks, setMaxConcurrentChunks] = useState(initialMaxConcurrent);

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const version = await ipcInvoke('app:get-version');
        setAppVersion(version || '');
      } catch (error) {
        console.error('Failed to load app version:', error);
        setAppVersion('');
      }
    };
    loadVersion();
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveDownloadConfig = async () => {
    try {
      await setConfig({
        chunkSizeMb,
        maxConcurrentChunks,
      });
    } catch (error) {
      console.error('Failed to save download config:', error);
    }
  };

  return (
    <div className={`${styles.container} pencil-page`}>
      <header className="pencil-page-header">
        <div className="pencil-page-title-row">
          <Title1 className="pencil-page-title">设置</Title1>
          <span className="pencil-page-kicker">SYSTEM</span>
        </div>
        <Body1 className="pencil-page-description">
          配置主题、下载并发、系统行为与开发辅助选项，统一管理应用运行策略。
        </Body1>
      </header>
      
      <Card className={styles.section}>
        <Title2>外观设置</Title2>
        <div className={styles.section}>
          <div>
            <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>颜色方案</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }}>
              选择应用的配色方案
            </Body1>
            <div className={styles.themeGrid}>
              {/* 默认 Fluent UI 主题 */}
              <div
                className={`${styles.themeCard} ${colorScheme === 'default' ? styles.themeCardSelected : ''}`}
                onClick={() => setColorScheme('default')}
              >
                {colorScheme === 'default' && (
                  <CheckmarkCircleFilled className={styles.checkmarkIcon} />
                )}
                <div className={styles.themePreview}>
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#ffffff' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#0078d4' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#107c10' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#d13438' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#ffaa44' }} />
                </div>
                <div className={styles.themeName}>默认</div>
                <div className={styles.themeDescription}>Fluent UI 原生主题</div>
              </div>

              {/* Catppuccin 主题 */}
              <div
                className={`${styles.themeCard} ${colorScheme === 'catppuccin' ? styles.themeCardSelected : ''}`}
                onClick={() => setColorScheme('catppuccin')}
              >
                {colorScheme === 'catppuccin' && (
                  <CheckmarkCircleFilled className={styles.checkmarkIcon} />
                )}
                <div className={styles.themePreview}>
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#303446' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#8caaee' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#a6d189' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#e78284' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#e5c890' }} />
                </div>
                <div className={styles.themeName}>Catppuccin</div>
                <div className={styles.themeDescription}>经典深色主题</div>
              </div>

              {/* Latte 主题 */}
              <div
                className={`${styles.themeCard} ${colorScheme === 'latte' ? styles.themeCardSelected : ''}`}
                onClick={() => setColorScheme('latte')}
              >
                {colorScheme === 'latte' && (
                  <CheckmarkCircleFilled className={styles.checkmarkIcon} />
                )}
                <div className={styles.themePreview}>
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#eff1f5' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#1e66f5' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#40a02b' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#d20f39' }} />
                  <div className={styles.themeColorSwatch} style={{ backgroundColor: '#df8e1d' }} />
                </div>
                <div className={styles.themeName}>Latte</div>
                <div className={styles.themeDescription}>温暖浅色主题</div>
              </div>
            </div>
          </div>
          
          <div>
            <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>主题模式</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }}>
              选择浅色或深色主题
            </Body1>
            <RadioGroup
              value={themeMode}
              onChange={(_, data) => setThemeMode(data.value as ThemeMode)}
            >
              <Radio label="浅色" value="light" />
              <Radio label="深色" value="dark" />
              <Radio label="跟随系统" value="system" />
            </RadioGroup>
          </div>
        </div>
      </Card>

      <Card className={styles.section}>
        <Title2>下载设置</Title2>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }}>
          调整模型下载时的参数配置
        </Body1>
        
        {configLoading && !downloadConfig && (
          <Spinner size="small" label="加载配置中..." />
        )}
        
        {downloadConfig && (
          <div className={styles.section}>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalXS }}>分块大小</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalS }}>
                下载大文件时的分块大小，较大的值可减少请求次数
              </Body1>
              <Dropdown
                value={String(chunkSizeMb)}
                selectedOptions={[String(chunkSizeMb)]}
                onOptionSelect={(_, data) => setChunkSizeMb(Number(data.optionValue))}
                style={{ maxWidth: '200px' }}
              >
                <Option value="5">5 MB</Option>
                <Option value="10">10 MB</Option>
                <Option value="20">20 MB</Option>
                <Option value="50">50 MB</Option>
                <Option value="100">100 MB</Option>
              </Dropdown>
            </div>
            
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalXS }}>最大并发分块数</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalS }}>
                同时下载的分块数量，较大的值可提高下载速度
              </Body1>
              <Dropdown
                value={String(maxConcurrentChunks)}
                selectedOptions={[String(maxConcurrentChunks)]}
                onOptionSelect={(_, data) => setMaxConcurrentChunks(Number(data.optionValue))}
                style={{ maxWidth: '200px' }}
              >
                <Option value="1">1</Option>
                <Option value="2">2</Option>
                <Option value="4">4</Option>
                <Option value="8">8</Option>
                <Option value="16">16</Option>
              </Dropdown>
            </div>
            
            <div style={{ marginTop: tokens.spacingVerticalM }}>
              <Button
                appearance="primary"
                onClick={handleSaveDownloadConfig}
                disabled={configLoading}
              >
                {configLoading ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className={styles.section}>
        <Title2>开发者工具</Title2>
        <div className={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Body1>打开开发者工具</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                打开浏览器调试工具栏（F12）
              </Body1>
            </div>
            <Button
              icon={<CodeRegular />}
              onClick={async () => {
                try {
                  const result = await ipcInvoke('devtools:toggle');
                  if (result?.success && result.isOpen !== undefined) {
                    setDevToolsOpen(result.isOpen);
                  }
                } catch (error) {
                  console.error('Failed to toggle DevTools:', error);
                }
              }}
              appearance="secondary"
            >
              {devToolsOpen ? '关闭开发者工具' : '打开开发者工具'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className={styles.section}>
        <Title2>关于</Title2>
        <Body1>HelloUI {appVersion ? `v${appVersion}` : ''}</Body1>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
          基于 Tauri + React 19 + Fluent UI 构建
        </Body1>
      </Card>
    </div>
  );
};



