import {
  Card,
  Title1,
  Title2,
  Body1,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  HomeRegular,
  StarRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1400px',
    margin: '0 auto',
  },
  welcomeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingVerticalL,
    marginTop: tokens.spacingVerticalL,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
  },
  quickActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const HomePage = () => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {/* 欢迎区域 */}
      <div className={styles.welcomeSection}>
        <Title1>欢迎使用 HelloUI</Title1>
        <Body1>
          这是一个基于 Electron + React 19 + Fluent UI 构建的现代化桌面应用程序。
          具有 WinUI 3 风格的用户界面，提供流畅的用户体验。
        </Body1>
      </div>

      {/* 统计卡片 */}
      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.iconContainer}>
            <HomeRegular fontSize={24} />
          </div>
          <Title2>主页</Title2>
          <Caption1>这是应用的起始页面</Caption1>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.iconContainer}>
            <StarRegular fontSize={24} />
          </div>
          <Title2>功能丰富</Title2>
          <Caption1>集成 Fluent UI 组件库</Caption1>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.iconContainer}>
            <WeatherSunnyRegular fontSize={24} />
          </div>
          <Title2>现代设计</Title2>
          <Caption1>支持浅色/深色主题</Caption1>
        </Card>
      </div>

      {/* 快速操作 */}
      <Card className={styles.quickActions}>
        <Title2>快速操作</Title2>
        <Body1>点击左侧导航栏可以快速切换到不同页面</Body1>
        <div className={styles.actionGrid} style={{ marginTop: tokens.spacingVerticalM }}>
          <Card className={styles.statCard}>
            <Body1>组件展示</Body1>
            <Caption1>查看所有可用组件</Caption1>
          </Card>
          <Card className={styles.statCard}>
            <Body1>设置</Body1>
            <Caption1>配置应用选项</Caption1>
          </Card>
        </div>
      </Card>
    </div>
  );
};

