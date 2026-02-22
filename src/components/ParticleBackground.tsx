import React, { useEffect, useRef } from 'react';
import { 
  tokens, 
  makeStyles 
} from '@fluentui/react-components';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

// 使用 CSS 变量来获取颜色，而不是通过 Ref
// 这样做更稳定，但我们需要一个元素来承载这些颜色
const useStyles = makeStyles({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 0,
    pointerEvents: 'none',
    opacity: 0.6,
  },
  // 隐藏的辅助元素，用于获取颜色值
  colorHelper: {
    visibility: 'hidden',
    position: 'absolute',
    width: '1px',
    height: '1px',
    pointerEvents: 'none',
    color: tokens.colorBrandForeground1,
    borderBottomColor: tokens.colorNeutralForeground2,
  },
});

const ParticleBackground: React.FC = () => {
  const styles = useStyles();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorHelperRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const colorHelper = colorHelperRef.current;

    if (!canvas || !container || !colorHelper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    const particleCount = 60; // 稍微减少一点数量
    const connectionDistance = 150;
    
    // 颜色配置，初始为默认值
    let particleColor = '#0f6cbd'; 
    let lineRgb = '100, 100, 100'; 

    // 获取颜色的函数
    const updateColors = () => {
      const computedStyle = getComputedStyle(colorHelper);
      
      // 获取品牌色 (粒子颜色)
      const pColor = computedStyle.color;
      if (pColor) particleColor = pColor;

      // 获取连线颜色 (中性色)
      const lColor = computedStyle.borderBottomColor;
      if (lColor) {
        // 解析 RGB
        const rgbMatch = lColor.match(/\d+, \s*\d+, \s*\d+/);
        if (rgbMatch) {
            lineRgb = rgbMatch[0].replace(/\s+/g, ', ');
        } else if (lColor.startsWith('#')) {
            // Hex to RGB
            const r = parseInt(lColor.slice(1, 3), 16);
            const g = parseInt(lColor.slice(3, 5), 16);
            const b = parseInt(lColor.slice(5, 7), 16);
            lineRgb = `${r}, ${g}, ${b}`;
        }
      }
    };

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      // 重新初始化时更新颜色
      updateColors();
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          size: Math.random() * 2 + 1,
        });
      }
    };

    // 绘制循环
    let lastTime = 0;
    const draw = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      // 限制帧率大概在 60fps
      if (deltaTime < 16) { 
        animationFrameId.current = requestAnimationFrame(draw);
        return; 
      }
      lastTime = timestamp;

      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制逻辑
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            ctx.beginPath();
            // 动态设置透明度
            const alpha = 1 - dist / connectionDistance;
            ctx.strokeStyle = `rgba(${lineRgb}, ${alpha})`; 
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      animationFrameId.current = requestAnimationFrame(draw);
    };

    // 监听 resize
    window.addEventListener('resize', resizeCanvas);
    
    // 初始化
    resizeCanvas();
    animationFrameId.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} />
      <div ref={colorHelperRef} className={styles.colorHelper} />
    </div>
  );
};

export default ParticleBackground;
