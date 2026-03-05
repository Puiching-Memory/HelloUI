import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { Title1, Body1, makeStyles, tokens } from '@/ui/components';
import { useState, useEffect } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  imageNames: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  imageName: {
    flex: 1,
    textAlign: 'center',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sliderContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalL,
    minHeight: 0,
  },
  compareSlider: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
});

interface ImageCompareData {
  image1: {
    path: string;
    name: string;
    previewImage: string;
  };
  image2: {
    path: string;
    name: string;
    previewImage: string;
  };
}

type CompareWindow = Window & { __compareImageData?: ImageCompareData };

export const ImageComparePage = () => {
  const styles = useStyles();
  const [imageData, setImageData] = useState<ImageCompareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 URL 参数或 window 对象获取图片数据
    const getImageData = () => {
      const compareWindow = window as CompareWindow;
      try {
        // 方法1: 从 URL 参数获取（开发模式）
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');
        
        if (dataParam) {
          const decoded = decodeURIComponent(dataParam);
          const data = JSON.parse(decoded);
          setImageData(data);
          setLoading(false);
          return;
        }

        // 方法2: 从 window 对象获取（生产模式，主进程通过 webContents.executeJavaScript 设置）
        if (compareWindow.__compareImageData) {
          const data = compareWindow.__compareImageData;
          setImageData(data);
          setLoading(false);
          return;
        }

        // 方法3: 监听自定义事件（主进程通过事件传递数据）
        const handleCompareDataReady = (event: CustomEvent) => {
          const data = event.detail as ImageCompareData;
          setImageData(data);
          setLoading(false);
        };
        
        window.addEventListener('compare-data-ready', handleCompareDataReady as EventListener);
        
        // 如果数据已经设置，直接使用
        if (compareWindow.__compareImageData) {
          const data = compareWindow.__compareImageData;
          setImageData(data);
          setLoading(false);
        }
        
        // 清理函数
        return () => {
          window.removeEventListener('compare-data-ready', handleCompareDataReady as EventListener);
        };
      } catch (error) {
        console.error('Failed to load compare image data:', error);
        setLoading(false);
      }
    };

    getImageData();
  }, []);

  const getImageMimeType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: { [key: string]: string } = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
    };
    return mimeTypes[ext || ''] || 'image/png';
  };

  if (loading) {
    return (
      <div className={`${styles.container} pencil-page`}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: tokens.colorNeutralForeground3 
        }}>
          <Body1>加载中...</Body1>
        </div>
      </div>
    );
  }

  if (!imageData) {
    return (
      <div className={`${styles.container} pencil-page`}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: tokens.colorNeutralForeground3 
        }}>
          <Body1>未找到对比图片数据</Body1>
        </div>
      </div>
    );
  }

  const image1Src = `data:${getImageMimeType(imageData.image1.name)};base64,${imageData.image1.previewImage}`;
  const image2Src = `data:${getImageMimeType(imageData.image2.name)};base64,${imageData.image2.previewImage}`;

  return (
    <div className={`${styles.container} pencil-page`}>
      <div className={`${styles.header} pencil-page-header`}>
        <div className="pencil-page-title-row">
          <Title1 className="pencil-page-title" style={{ margin: 0, textAlign: 'center' }}>图片对比</Title1>
          <span className="pencil-page-kicker">COMPARE</span>
        </div>
        <Body1 className="pencil-page-description">
          并排或滑块对比两张图片的细节差异与参数变化，用于质量评估与模型回归验证。
        </Body1>
        <div className={styles.imageNames}>
          <div className={styles.imageName} title={imageData.image1.name}>
            {imageData.image1.name}
          </div>
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>vs</Body1>
          <div className={styles.imageName} title={imageData.image2.name}>
            {imageData.image2.name}
          </div>
        </div>
      </div>
      <div className={styles.sliderContainer}>
        <ReactCompareSlider
          itemOne={<ReactCompareSliderImage src={image1Src} alt={imageData.image1.name} />}
          itemTwo={<ReactCompareSliderImage src={image2Src} alt={imageData.image2.name} />}
          style={{ width: '100%', height: '100%' }}
          position={50}
          keyboardIncrement="5%"
        />
      </div>
    </div>
  );
};


