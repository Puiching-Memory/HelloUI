import { ReactNode } from 'react';
import {
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  HomeRegular,
  AppsRegular,
  SettingsRegular,
  DatabaseRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    width: '240px',
    minWidth: '240px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingVerticalM,
    gap: tokens.spacingVerticalXS,
    overflowY: 'auto',
  },
  sidebarHeader: {
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
  },
  navButton: {
    justifyContent: 'flex-start',
    width: '100%',
    height: '40px',
    paddingLeft: tokens.spacingHorizontalM,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
});

export type PageType = 'home' | 'components' | 'settings' | 'weights';

interface MainLayoutProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  children: ReactNode;
}

export const MainLayout = ({ currentPage, onPageChange, children }: MainLayoutProps) => {
  const styles = useStyles();

  const navItems = [
    {
      id: 'home' as PageType,
      label: '主页',
      icon: <HomeRegular />,
    },
    {
      id: 'weights' as PageType,
      label: '模型权重管理',
      icon: <DatabaseRegular />,
    },
    {
      id: 'components' as PageType,
      label: '组件展示',
      icon: <AppsRegular />,
    },
    {
      id: 'settings' as PageType,
      label: '设置',
      icon: <SettingsRegular />,
    },
  ];

  return (
    <div className={styles.container}>
      {/* 左侧导航栏 */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 style={{ margin: 0, fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold }}>
            HelloUI
          </h2>
        </div>
        {navItems.map((item) => (
          <Button
            key={item.id}
            appearance={currentPage === item.id ? 'primary' : 'subtle'}
            icon={item.icon}
            className={styles.navButton}
            onClick={() => onPageChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {/* 主内容区 */}
      <div className={styles.content}>
        <div className={styles.mainContent}>
          {children}
        </div>
      </div>
    </div>
  );
};

