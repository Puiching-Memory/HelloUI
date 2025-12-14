import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
});

interface PBRMaterialPreviewProps {
  basecolor?: string | null;
}

export const PBRMaterialPreview = ({ basecolor }: PBRMaterialPreviewProps) => {
  const styles = useStyles();

  if (!basecolor) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>暂无预览</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <img src={basecolor} alt="材质预览" className={styles.previewImage} />
    </div>
  );
};
