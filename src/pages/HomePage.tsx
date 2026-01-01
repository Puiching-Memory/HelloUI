import {
  Card,
  Title1,
  Title2,
  Title3,
  Body1,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ImageAddRegular,
  EditRegular,
  VideoClipRegular,
  ZoomInRegular,
  DatabaseRegular,
  CodeRegular,
  ImageRegular,
  ArrowRightRegular,
  SparkleRegular,
  PaintBrushRegular,
  FolderRegular,
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXL,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1600px',
    margin: '0 auto',
  },
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXXL,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    position: 'relative',
  },
  heroContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    position: 'relative',
  },
  heroTitle: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: 1.2,
  },
  heroDescription: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground2,
    maxWidth: '600px',
    lineHeight: 1.6,
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacingVerticalL,
    marginTop: tokens.spacingVerticalL,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXL,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    textDecoration: 'none',
    ':hover': {
      border: `1px solid ${tokens.colorBrandStroke1}`,
      boxShadow: tokens.shadow4,
      transform: 'translateY(-1px)',
    },
  },
  actionCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
  },
  actionIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: tokens.borderRadiusMedium,
    border: `2px solid ${tokens.colorNeutralStroke1}`,
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  actionCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    flex: 1,
  },
  actionCardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    marginTop: tokens.spacingVerticalXS,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  featureCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  featureIcon: {
    fontSize: '28px',
    color: tokens.colorBrandForeground1,
    marginBottom: tokens.spacingVerticalXS,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

export const HomePage = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'generate',
      title: '图片生成',
      description: '使用 AI 技术从文本提示词生成高质量图片',
      icon: <ImageAddRegular fontSize={28} />,
      color: 'brand' as const,
    },
    {
      id: 'edit-image',
      title: '图片编辑',
      description: '使用 AI 技术编辑和修改现有图片',
      icon: <EditRegular fontSize={28} />,
      color: 'success' as const,
    },
    {
      id: 'video-generate',
      title: '视频生成',
      description: '从文本或图片生成动态视频内容',
      icon: <VideoClipRegular fontSize={28} />,
      color: 'danger' as const,
    },
    {
      id: 'image-upscale',
      title: '图像超分辨率',
      description: '提升图片分辨率和质量',
      icon: <ZoomInRegular fontSize={28} />,
      color: 'important' as const,
    },
  ];

  const features = [
    {
      icon: <DatabaseRegular />,
      title: '模型管理',
      description: '统一管理 SD、VAE、LLM 等模型文件',
    },
    {
      icon: <CodeRegular />,
      title: '引擎配置',
      description: '管理 SD.cpp 推理引擎和版本',
    },
    {
      icon: <ImageRegular />,
      title: '结果管理',
      description: '查看和管理所有生成的作品',
    },
  ];

  const handleActionClick = (pageId: string) => {
    navigate(pageId === 'home' ? '/' : '/' + pageId);
  };

  return (
    <div className={styles.container}>
      {/* 英雄区域 */}
      <Card className={styles.heroSection}>
        <div className={styles.heroContent}>
          <Title1 className={styles.heroTitle}>
            HelloUI
          </Title1>
          <Body1 className={styles.heroDescription}>
            一个现代化的 AI 图片生成与编辑桌面应用，基于 SD.cpp 引擎。
            提供直观的图形界面和强大的模型管理功能，让 AI 创作变得简单高效。
          </Body1>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, marginTop: tokens.spacingVerticalS }}>
            <Button
              appearance="primary"
              size="large"
              icon={<ImageAddRegular />}
              onClick={() => handleActionClick('generate')}
            >
              开始生成
            </Button>
            <Button
              appearance="secondary"
              size="large"
              icon={<ImageRegular />}
              onClick={() => handleActionClick('images')}
            >
              查看作品
            </Button>
          </div>
        </div>
      </Card>

      {/* 快速操作 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Title2>快速开始</Title2>
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
            选择以下功能开始您的创作之旅
          </Body1>
        </div>
        <div className={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <Card
              key={action.id}
              className={styles.actionCard}
              onClick={() => handleActionClick(action.id)}
            >
              <div className={styles.actionCardHeader}>
                <div className={styles.actionIcon}>
                  {action.icon}
                </div>
                <div className={styles.actionCardContent}>
                  <Title3>{action.title}</Title3>
                  <Body1 style={{ color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 }}>
                    {action.description}
                  </Body1>
                </div>
              </div>
              <div className={styles.actionCardFooter}>
                立即使用
                <ArrowRightRegular fontSize={16} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 功能特性 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Title2>核心功能</Title2>
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
            了解 HelloUI 的强大功能
          </Body1>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <Card key={index} className={styles.featureCard}>
              <div className={styles.featureIcon}>
                {feature.icon}
              </div>
              <Title3>{feature.title}</Title3>
              <Body1 style={{ color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 }}>
                {feature.description}
              </Body1>
            </Card>
          ))}
        </div>
      </div>

      {/* 使用提示 */}
      <Card className={styles.section} style={{ padding: tokens.spacingVerticalXL, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
        <div className={styles.sectionHeader}>
          <Title2>使用提示</Title2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL }}>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'flex-start' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: tokens.borderRadiusSmall,
              border: `1px solid ${tokens.colorBrandStroke1}`,
              color: tokens.colorBrandForeground1,
              flexShrink: 0,
            }}>
              <SparkleRegular fontSize={16} />
            </div>
            <div style={{ flex: 1 }}>
              <Body1 style={{ fontWeight: tokens.fontWeightSemibold, marginBottom: tokens.spacingVerticalXS }}>
                配置模型权重
              </Body1>
              <Body1 style={{ color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 }}>
                在「模型权重管理」页面中上传和管理您的模型文件，创建模型组以便快速切换。
              </Body1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'flex-start' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: tokens.borderRadiusSmall,
              border: `1px solid ${tokens.colorBrandStroke1}`,
              color: tokens.colorBrandForeground1,
              flexShrink: 0,
            }}>
              <PaintBrushRegular fontSize={16} />
            </div>
            <div style={{ flex: 1 }}>
              <Body1 style={{ fontWeight: tokens.fontWeightSemibold, marginBottom: tokens.spacingVerticalXS }}>
                开始创作
              </Body1>
              <Body1 style={{ color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 }}>
                选择「图片生成」或「图片编辑」功能，输入提示词，调整参数，开始生成您的作品。
              </Body1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'flex-start' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: tokens.borderRadiusSmall,
              border: `1px solid ${tokens.colorBrandStroke1}`,
              color: tokens.colorBrandForeground1,
              flexShrink: 0,
            }}>
              <FolderRegular fontSize={16} />
            </div>
            <div style={{ flex: 1 }}>
              <Body1 style={{ fontWeight: tokens.fontWeightSemibold, marginBottom: tokens.spacingVerticalXS }}>
                管理作品
              </Body1>
              <Body1 style={{ color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 }}>
                在「生成结果」页面查看、下载和管理所有生成的作品，支持批量操作和图片对比。
              </Body1>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
