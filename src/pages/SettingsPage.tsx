import {
  Card,
  Title1,
  Title2,
  Body1,
  Switch,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useState } from 'react';

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

export const SettingsPage = () => {
  const styles = useStyles();
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(false);

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
        <Title2>关于</Title2>
        <Body1>HelloUI v1.0.0</Body1>
        <Body1 style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
          基于 Electron + React 19 + Fluent UI 构建
        </Body1>
      </Card>
    </div>
  );
};

