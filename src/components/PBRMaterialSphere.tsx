import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeStyles, tokens } from '@fluentui/react-components';

// 最大纹理分辨率
const MAX_TEXTURE_SIZE = 2048; // 限制为 2048x2048

/**
 * 限制图片分辨率，返回压缩后的 data URL
 */
const limitTextureResolution = (imageUrl: string, maxSize: number = MAX_TEXTURE_SIZE): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // 如果图片尺寸在限制范围内，直接返回原图
      if (width <= maxSize && height <= maxSize) {
        resolve(imageUrl);
        return;
      }
      
      // 计算缩放比例
      const scale = Math.min(maxSize / width, maxSize / height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
      
      // 创建 Canvas 并绘制缩放后的图片
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法获取 Canvas 上下文'));
        return;
      }
      
      // 使用高质量缩放
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // 转换为 data URL
      try {
        const compressedDataUrl = canvas.toDataURL('image/png');
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };
    
    img.src = imageUrl;
  });
};

/**
 * 加载纹理并限制分辨率
 */
const loadTextureWithSizeLimit = async (
  url: string,
  maxSize: number = MAX_TEXTURE_SIZE
): Promise<THREE.Texture> => {
  // 先压缩图片
  const compressedUrl = await limitTextureResolution(url, maxSize);
  
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      compressedUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        resolve(texture);
      },
      undefined,
      reject
    );
  });
};

const useStyles = makeStyles({
  container: {
    width: '100%',
    height: '400px',
    position: 'relative',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5', // 使用明亮的浅灰色背景
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
});

interface PBRMaterialSphereProps {
  basecolor?: string | null;
  metalness?: string | null;
  normal?: string | null;
  roughness?: string | null;
}

export const PBRMaterialSphere = ({
  basecolor,
  metalness,
  normal,
  roughness,
}: PBRMaterialSphereProps) => {
  const styles = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sphere: THREE.Mesh;
    controls?: {
      update: () => void;
    };
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 创建场景
    const backgroundColor = 0xf5f5f5; // 背景颜色
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // 创建相机
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    // 相机距离限制
    const minDistance = 2;
    const maxDistance = 10;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // 创建球体几何体
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // 创建材质
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0.5,
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // 添加光照 - 使用背景颜色作为环境光
    const ambientLight = new THREE.AmbientLight(backgroundColor, 0.8);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    // 鼠标控制旋转
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      sphere.rotation.y += deltaX * 0.01;
      sphere.rotation.x += deltaY * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // 滚轮缩放控制
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // 根据滚轮方向调整相机距离
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      const currentDistance = camera.position.length();
      const newDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance * delta));
      
      // 更新相机位置（保持方向，只改变距离）
      camera.position.normalize().multiplyScalar(newDistance);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      
      // 如果没有拖拽，缓慢自转
      if (!isDragging) {
        sphere.rotation.y += 0.005;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // 保存引用
    sceneRef.current = {
      scene,
      camera,
      renderer,
      sphere,
    };

    // 清理函数
    return () => {
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      
      // 清理材质和纹理
      const mat = sphere.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.dispose();
      if (mat.metalnessMap) mat.metalnessMap.dispose();
      if (mat.normalMap) mat.normalMap.dispose();
      if (mat.roughnessMap) mat.roughnessMap.dispose();
      
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // 更新材质贴图
  useEffect(() => {
    if (!sceneRef.current) return;

    const { sphere } = sceneRef.current;
    const material = sphere.material as THREE.MeshStandardMaterial;

    // 更新 basecolor
    if (basecolor) {
      loadTextureWithSizeLimit(basecolor)
        .then((texture) => {
          // 清理旧的纹理
          if (material.map) {
            material.map.dispose();
          }
          material.map = texture;
          material.needsUpdate = true;
        })
        .catch(console.error);
    } else {
      if (material.map) {
        material.map.dispose();
      }
      material.map = null;
      material.color.setHex(0xffffff);
    }

    // 更新 metalness
    if (metalness) {
      loadTextureWithSizeLimit(metalness)
        .then((texture) => {
          // 清理旧的纹理
          if (material.metalnessMap) {
            material.metalnessMap.dispose();
          }
          material.metalnessMap = texture;
          material.needsUpdate = true;
        })
        .catch(console.error);
    } else {
      if (material.metalnessMap) {
        material.metalnessMap.dispose();
      }
      material.metalnessMap = null;
      material.metalness = 0.5;
    }

    // 更新 normal
    if (normal) {
      loadTextureWithSizeLimit(normal)
        .then((texture) => {
          texture.colorSpace = THREE.LinearSRGBColorSpace;
          // 清理旧的纹理
          if (material.normalMap) {
            material.normalMap.dispose();
          }
          material.normalMap = texture;
          material.normalScale.set(1, 1);
          material.needsUpdate = true;
        })
        .catch(console.error);
    } else {
      if (material.normalMap) {
        material.normalMap.dispose();
      }
      material.normalMap = null;
    }

    // 更新 roughness
    if (roughness) {
      loadTextureWithSizeLimit(roughness)
        .then((texture) => {
          // 清理旧的纹理
          if (material.roughnessMap) {
            material.roughnessMap.dispose();
          }
          material.roughnessMap = texture;
          material.needsUpdate = true;
        })
        .catch(console.error);
    } else {
      if (material.roughnessMap) {
        material.roughnessMap.dispose();
      }
      material.roughnessMap = null;
      material.roughness = 0.5;
    }
  }, [basecolor, metalness, normal, roughness]);

  // 处理窗口大小变化
  useEffect(() => {
    if (!sceneRef.current || !containerRef.current) return;

    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      const { camera, renderer } = sceneRef.current!;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={containerRef} className={styles.container} />;
};

