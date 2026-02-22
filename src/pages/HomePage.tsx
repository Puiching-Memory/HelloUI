import React from 'react';
import {
  Title1,
  Title2,
  Title3,
  Body1,
  Button,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  EditRegular,
  VideoClipRegular,
  ZoomInRegular,
  DatabaseRegular,
  ImageRegular,
  ArrowRightRegular,
  SparkleRegular,
  FolderRegular,
  SettingsRegular,
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from '../components/ParticleBackground';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    height: '100%',
    width: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.overflow('auto'),
  },
  contentWrapper: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
    backgroundColor: 'transparent',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: tokens.fontWeightBold,
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1}, ${tokens.colorBrandForeground2})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.1,
    marginBottom: tokens.spacingVerticalXS,
  },
  heroDescription: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground2,
    maxWidth: '600px',
    lineHeight: 1.5,
  },
  heroButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: tokens.spacingVerticalM,
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: tokens.spacingHorizontalM,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusLarge,
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    cursor: 'pointer',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    opacity: 0.9, 
    ...shorthands.overflow('hidden'),
    
    ':hover': {
      transform: 'translateY(-5px)',
      boxShadow: tokens.shadow8,
      border: `1px solid ${tokens.colorBrandStroke1}`,
      opacity: 1, 
    },
  },
  cardIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    marginBottom: tokens.spacingVerticalM,
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    flex: 1,
  },
  cardTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  cardDesc: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    lineHeight: 1.4,
  },
  cardFooter: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    color: tokens.colorBrandForeground1,
    fontSize: '13px',
    fontWeight: 600,
    paddingTop: tokens.spacingVerticalM,
  },
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  toolCard: {
    display: 'flex', 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: tokens.spacingVerticalM, 
    gap: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
        backgroundColor: tokens.colorNeutralBackground1Hover,
        border: `1px solid ${tokens.colorNeutralStroke1Hover}`,
        transform: 'translateY(-2px)',
        boxShadow: tokens.shadow4,
    }
  },
  toolIcon: {
    width: '36px', 
    height: '36px', 
    borderRadius: tokens.borderRadiusSmall, 
    backgroundColor: tokens.colorNeutralBackground3, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    color: tokens.colorNeutralForeground1
  },
  toolInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
});

export const HomePage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  const handleActionClick = (path: string) => {
    navigate(path);
  };

  const quickActions = [
    {
      id: '/generate',
      title: 'AI 绘图',
      description: '输入提示词，让 AI 为您生成精美画作。',
      icon: <ImageAddRegular fontSize={24} />,
    },
    {
      id: '/edit-image',
      title: '图片编辑',
      description: '智能修复、局部重绘、扩图。',
      icon: <EditRegular fontSize={24} />,
    },
    {
      id: '/video-generate',
      title: '视频生成',
      description: '赋予静态图片生命，生成创意短视频。',
      icon: <VideoClipRegular fontSize={24} />,
    },
    {
      id: '/image-upscale',
      title: '画质超分',
      description: '无损放大图片，提升清晰度。',
      icon: <ZoomInRegular fontSize={24} />,
    },
  ];

  const managementTools = [
     {
      id: '/models',
      title: '模型管理',
      description: '管理 SD 模型、VAE 和 LoRA 权重',
      icon: <DatabaseRegular fontSize={20} />,
    },
    {
      id: '/generated-images',
      title: '作品库',
      description: '浏览和管理您的所有创作历史',
      icon: <ImageRegular fontSize={20} />,
    },
    {
      id: '/settings',
      title: '系统设置',
      description: '配置推理引擎和应用偏好',
      icon: <SettingsRegular fontSize={20} />,
    },
  ];

  return (
    <div className={styles.root}>
      <ParticleBackground />
      
      <div className={styles.contentWrapper}>
        {/* 英雄区域 */}
        <section className={styles.heroSection}>
          <Title1 className={styles.heroTitle}>HelloUI</Title1>
          <Body1 className={styles.heroDescription}>
            释放您的创意潜能。基于强大的 SD.cpp 引擎，提供极致流畅的本地 AI 创作体验。
            无需繁琐配置，即刻开始创作。
          </Body1>
          
          <div className={styles.heroButtons}>
            <Button
              appearance="primary"
              size="medium"
              shape="rounded"
              icon={<SparkleRegular />}
              onClick={() => handleActionClick('/generate')}
              style={{ minWidth: '140px', height: '40px', fontSize: '14px' }}
            >
              开始创作
            </Button>
            <Button
              appearance="outline"
              size="medium"
              shape="rounded"
              icon={<FolderRegular />}
              onClick={() => handleActionClick('/generated-images')}
              style={{ minWidth: '140px', height: '40px', fontSize: '14px' }}
            >
              查看作品
            </Button>
          </div>
        </section>

        {/* 核心功能卡片 */}
        <section>
          <div className={styles.sectionTitle}>
             <Title2>功能中心</Title2>
          </div>
          <div className={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <div
                key={action.id}
                className={styles.card}
                onClick={() => handleActionClick(action.id)}
              >
                <div className={styles.cardIconWrapper}>
                  {action.icon}
                </div>
                <div className={styles.cardContent}>
                  <span className={styles.cardTitle}>{action.title}</span>
                  <span className={styles.cardDesc}>{action.description}</span>
                </div>
                <div className={styles.cardFooter}>
                   立即使用 <ArrowRightRegular style={{ marginLeft: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 管理工具小卡片 */}
        <section>
          <Title3 style={{ marginBottom: tokens.spacingVerticalM, display: 'block' }}>常用工具</Title3>
          <div className={styles.toolGrid}>
            {managementTools.map((tool) => (
                <div 
                    key={tool.id}
                    className={styles.toolCard}
                    onClick={() => handleActionClick(tool.id)}
                >
                    <div className={styles.toolIcon}>
                        {tool.icon}
                    </div>
                    <div className={styles.toolInfo}>
                         <div style={{ fontWeight: 600, fontSize: tokens.fontSizeBase300, color: tokens.colorNeutralForeground1 }}>{tool.title}</div>
                         <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>{tool.description}</div>
                    </div>
                </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
