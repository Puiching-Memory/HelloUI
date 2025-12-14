import {
  Card,
  Title1,
  Body1,
  Button,
  makeStyles,
  tokens,
  Spinner,
  Badge,
  Text,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular,
  ArrowSyncRegular,
  LayerRegular,
  DismissRegular,
  EyeRegular,
} from '@fluentui/react-icons';
import { useState, useEffect } from 'react';
import { PBRMaterialSphere } from '../components/PBRMaterialSphere';
import { PBRMaterialPreview } from '../components/PBRMaterialPreview';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
    maxWidth: '1600px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalM,
  },
  materialCard: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    ':hover': {
      borderTopColor: tokens.colorNeutralStroke1,
      borderRightColor: tokens.colorNeutralStroke1,
      borderBottomColor: tokens.colorNeutralStroke1,
      borderLeftColor: tokens.colorNeutralStroke1,
      boxShadow: tokens.shadow8,
      transform: 'translateY(-2px)',
    },
  },
  materialPreviewContainer: {
    position: 'relative',
    width: '100%',
    height: '300px',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  materialCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
  },
  materialCardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  materialName: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  materialInfo: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  materialActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  emptyState: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
});

interface MaterialInfo {
  id: string;
  folderPath: string;
  timestamp: number;
  basecolor?: string;
  metalness?: string;
  normal?: string;
  roughness?: string;
}

export const MaterialMaterialsPage = () => {
  const styles = useStyles();
  const [materials, setMaterials] = useState<MaterialInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialInfo | null>(null);

  useEffect(() => {
    loadMaterials().catch(console.error);
  }, []);

  const loadMaterials = async () => {
    try {
      if (!window.ipcRenderer) {
        console.error('window.ipcRenderer is not available');
        return;
      }
      setLoading(true);
      const materialList = await window.ipcRenderer.invoke('materials:list');
      setMaterials(materialList || []);
    } catch (error) {
      console.error('Failed to load materials:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (material: MaterialInfo) => {
    try {
      if (!window.ipcRenderer) {
        alert('IPC 通信不可用');
        return;
      }
      setDownloadingId(material.id);
      const result = await window.ipcRenderer.invoke('materials:download', material.id);
      if (result.success) {
        console.log('材质下载成功');
      } else if (result.canceled) {
        console.log('下载已取消');
      }
    } catch (error) {
      console.error('Failed to download material:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`下载材质失败: ${errorMessage}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePreviewClick = (material: MaterialInfo) => {
    setPreviewMaterial(material);
    setPreviewDialogOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewDialogOpen(false);
    setPreviewMaterial(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title1>已生成材质</Title1>
          <div className={styles.headerActions}>
            <Button
              icon={<ArrowSyncRegular />}
              onClick={loadMaterials}
              disabled={loading}
              appearance="subtle"
            >
              刷新
            </Button>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <Spinner size="large" />
            <Body1 style={{ marginTop: tokens.spacingVerticalM }}>加载中...</Body1>
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.emptyState}>
            <LayerRegular style={{ fontSize: '64px', color: tokens.colorNeutralForeground4 }} />
            <Body1 style={{ marginTop: tokens.spacingVerticalM }}>暂无已生成的材质</Body1>
            <Body1 style={{ fontSize: tokens.fontSizeBase200, marginTop: tokens.spacingVerticalS }}>
              请先在"材质分解"页面生成材质
            </Body1>
          </div>
        ) : (
          <div className={styles.gridContainer}>
            {materials.map((material) => (
              <Card key={material.id} className={styles.materialCard}>
                <div className={styles.materialPreviewContainer}>
                  {material.basecolor || material.metalness || material.normal || material.roughness ? (
                    <PBRMaterialPreview
                      basecolor={material.basecolor}
                    />
                  ) : (
                    <div className={styles.emptyState} style={{ minHeight: '300px' }}>
                      <Body1>材质贴图缺失</Body1>
                    </div>
                  )}
                </div>
                <div className={styles.materialCardContent}>
                  <div className={styles.materialCardHeader}>
                    <Text className={styles.materialName}>材质 {material.id.split('_').pop()?.slice(0, 8)}</Text>
                    <Text className={styles.materialInfo}>
                      生成时间: {formatDate(material.timestamp)}
                    </Text>
                    <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXXS }}>
                      {material.basecolor && <Badge appearance="filled" color="success">Base Color</Badge>}
                      {material.metalness && <Badge appearance="filled" color="success">Metalness</Badge>}
                      {material.normal && <Badge appearance="filled" color="success">Normal</Badge>}
                      {material.roughness && <Badge appearance="filled" color="success">Roughness</Badge>}
                    </div>
                  </div>
                  <div className={styles.materialActions}>
                    <Button
                      icon={<EyeRegular />}
                      onClick={() => handlePreviewClick(material)}
                      appearance="secondary"
                      size="medium"
                    >
                      预览
                    </Button>
                    <Button
                      icon={<ArrowDownloadRegular />}
                      onClick={() => handleDownload(material)}
                      disabled={downloadingId === material.id}
                      appearance="primary"
                      size="medium"
                    >
                      {downloadingId === material.id ? '打包中...' : '下载'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 材质预览对话框 */}
      <Dialog open={previewDialogOpen} onOpenChange={(_, data) => {
        if (!data.open) {
          handleClosePreview();
        }
      }}>
        <DialogSurface style={{ maxWidth: '90vw', width: '900px', maxHeight: '90vh', padding: 0 }}>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={handleClosePreview}
                aria-label="关闭"
              />
            }
          >
            PBR 材质预览 {previewMaterial && `- ${previewMaterial.id.split('_').pop()?.slice(0, 8)}`}
          </DialogTitle>
          <DialogBody>
            <DialogContent style={{ padding: 0 }}>
              {previewMaterial && (
                <div style={{ width: '100%', height: '600px', minHeight: '600px' }}>
                  <PBRMaterialSphere
                    basecolor={previewMaterial.basecolor}
                    metalness={previewMaterial.metalness}
                    normal={previewMaterial.normal}
                    roughness={previewMaterial.roughness}
                  />
                </div>
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
