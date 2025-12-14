import {
  Card,
  Title1,
  Title2,
  Body1,
  Switch,
  Button,
  makeStyles,
  tokens,
  RadioGroup,
  Radio,
} from '@fluentui/react-components';
import { CodeRegular } from '@fluentui/react-icons';
import { useState, useEffect } from 'react';
import type { ThemeMode } from '../App';

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
});

interface SettingsPageProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export const SettingsPage = ({ themeMode, onThemeChange }: SettingsPageProps) => {
  const styles = useStyles();
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // 加载应用版本号
  useEffect(() => {
    const loadVersion = async () => {
      if (window.ipcRenderer) {
        try {
          const version = await window.ipcRenderer.invoke('app:get-version');
          setAppVersion(version || '');
        } catch (error) {
          console.error('Failed to load app version:', error);
          setAppVersion('');
        }
      }
    };
    loadVersion();
  }, []);

  return (
    <div className={styles.container}>
      <Title1>设置</Title1>
      
      <Card className={styles.section}>
        <Title2>通用设置</Title2>
        <div className={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Body1>启用通知</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                接收应用通知和更新提醒
              </Body1>
            </div>
            <Switch
              checked={notifications}
              onChange={(_, data) => setNotifications(data.checked || false)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Body1>自动保存</Body1>
              <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                自动保存更改
              </Body1>
            </div>
            <Switch
              checked={autoSave}
              onChange={(_, data) => setAutoSave(data.checked || false)}
            />
          </div>
        </div>
      </Card>

      <Card className={styles.section}>
        <Title2>外观设置</Title2>
        <div className={styles.section}>
          <div>
            <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>颜色主题</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }}>
              选择应用的颜色主题
            </Body1>
            <RadioGroup
              value={themeMode}
              onChange={(_, data) => onThemeChange(data.value as ThemeMode)}
            >
              <Radio label="浅色" value="light" />
              <Radio label="深色" value="dark" />
              <Radio label="跟随系统" value="system" />
            </RadioGroup>
          </div>
        </div>
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
                if (window.ipcRenderer) {
                  try {
                    const result = await window.ipcRenderer.invoke('devtools:toggle');
                    if (result?.success && result.isOpen !== undefined) {
                      setDevToolsOpen(result.isOpen);
                    }
                  } catch (error) {
                    console.error('Failed to toggle DevTools:', error);
                  }
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
          基于 Electron + React 19 + Fluent UI 构建
        </Body1>
      </Card>
    </div>
  );
};

