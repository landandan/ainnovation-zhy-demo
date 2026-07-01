"use client"

import React, { useEffect, useRef } from 'react';

interface CanvasDragonAvatarProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export function CanvasDragonAvatar({ className = '', style, size = 36 }: CanvasDragonAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topPadding = 15; // 给顶部留空间
  const totalCanvasSize = size + topPadding; // 画布总大小

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 画布内部更大，但是CSS显示的是size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalCanvasSize * dpr;
    canvas.height = totalCanvasSize * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId: number;
    let startTime = Date.now();

    // --- 状态管理 ---

    // 眨眼状态
    let isBlinking = false;
    let blinkStartTime = 0;
    let blinkDuration = 150;
    let nextBlinkTime = startTime + Math.random() * 3000 + 1000;
    let isDoubleBlink = false; // 是否是连眨的第二次

    // 跳跃状态机
    type JumpState = 'IDLE' | 'JUMPING';
    let jumpState: JumpState = 'IDLE';
    let stateStartTime = startTime;
    
    // 当前跳跃的参数 (每次跳跃随机生成)
    let currentJumpDuration = 800;
    let currentJumpHeight = 15;
    let currentIdleDuration = 1000;

    // 物理属性
    let jumpY = 0;
    let scaleX = 1;
    let scaleY = 1;

    const draw = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      // 清空画布
      ctx.clearRect(0, 0, totalCanvasSize, totalCanvasSize);

      // --- 1. 跳跃逻辑 (状态机 + 随机性) ---
      const stateElapsed = now - stateStartTime;

      if (jumpState === 'IDLE') {
        jumpY = 0;
        
        // 落地后的轻微呼吸/压扁恢复
        if (stateElapsed < 300) {
          // 刚落地，有一个阻尼震荡的恢复过程
          const progress = stateElapsed / 300;
          const squash = Math.sin(progress * Math.PI * 2) * Math.exp(-progress * 5) * 0.2;
          scaleY = 1 - squash;
          scaleX = 1 + squash;
        } else {
          // 平静状态下的极轻微呼吸
          const breath = Math.sin(elapsed * 0.003) * 0.02;
          scaleY = 1 + breath;
          scaleX = 1 - breath;
        }

        // 检查是否该起跳了
        if (stateElapsed > currentIdleDuration) {
          jumpState = 'JUMPING';
          stateStartTime = now;
          // 随机生成下一次跳跃的参数
          currentJumpDuration = 600 + Math.random() * 400; // 600ms - 1000ms
          currentJumpHeight = 10 + Math.random() * 15;     // 10 - 25 的高度
        }
      } else if (jumpState === 'JUMPING') {
        const progress = stateElapsed / currentJumpDuration; // 0 到 1

        if (progress >= 1) {
          // 落地，切换回 IDLE
          jumpState = 'IDLE';
          stateStartTime = now;
          // 随机生成下一次在地面停留的时间
          currentIdleDuration = 500 + Math.random() * 2500; // 0.5s - 3s
          jumpY = 0;
          scaleX = 1;
          scaleY = 1;
        } else {
          // 跳跃中
          // 抛物线轨迹: 4 * x * (1 - x)
          const heightFactor = 4 * progress * (1 - progress);
          jumpY = -heightFactor * currentJumpHeight;

          // 压扁与拉伸 (Squash & Stretch)
          if (progress < 0.2) {
            // 起跳瞬间：拉伸
            const stretch = progress / 0.2; // 0 -> 1
            scaleY = 1 + stretch * 0.3;
            scaleX = 1 / scaleY;
          } else if (progress > 0.8) {
            // 落地瞬间：拉伸准备迎接冲击
            const stretch = (1 - progress) / 0.2; // 1 -> 0
            scaleY = 1 + stretch * 0.3;
            scaleX = 1 / scaleY;
          } else {
            // 滞空：逐渐恢复圆形
            scaleY = 1 + (heightFactor * 0.1); // 在最高点稍微拉长一点点
            scaleX = 1 / scaleY;
          }
        }
      }

      // 轻微左右晃动 (仅在跳跃时明显)
      const jumpProgress = jumpState === 'JUMPING' ? stateElapsed / currentJumpDuration : 0;
      const tiltAngle = jumpState === 'JUMPING' ? Math.sin(jumpProgress * Math.PI) * 0.08 : Math.sin(elapsed * 0.002) * 0.02;

      // --- 2. 智能眨眼 (增加连眨概率) ---
      if (!isBlinking && now > nextBlinkTime) {
        isBlinking = true;
        blinkStartTime = now;
        blinkDuration = 100 + Math.random() * 80; // 眨眼速度稍微随机 100-180ms
        
        if (isDoubleBlink) {
          // 如果这是连眨的第二次，下一次眨眼要等很久
          nextBlinkTime = now + 2000 + Math.random() * 4000;
          isDoubleBlink = false;
        } else {
          // 30% 的概率触发连眨
          if (Math.random() < 0.3) {
            nextBlinkTime = now + blinkDuration + 50; // 极短的间隔后再次眨眼
            isDoubleBlink = true;
          } else {
            nextBlinkTime = now + 2000 + Math.random() * 4000;
          }
        }
      }

      let eyeScaleY = 1;
      if (isBlinking) {
        const blinkProgress = (now - blinkStartTime) / blinkDuration;
        if (blinkProgress >= 1) {
          isBlinking = false;
        } else {
          // 快速闭眼再睁开
          eyeScaleY = Math.abs(Math.cos(blinkProgress * Math.PI));
        }
      }

      // --- 开始绘制 ---
      ctx.save();
      
      // 向下偏移，给顶部留出跳跃空间
      ctx.translate(0, topPadding);
      
      // 整体缩放和居中
      const scale = size / 100;
      ctx.scale(scale, scale);
      
      // 1. 绘制阴影 (联动)
      // 跳得越高，阴影越大、越淡
      const shadowWidth = 40 + Math.abs(jumpY) * 0.5;
      const shadowAlpha = 0.3 - Math.abs(jumpY) * 0.01;
      ctx.beginPath();
      ctx.ellipse(50, 85, shadowWidth, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.05, shadowAlpha)})`;
      ctx.fill();

      // 移动到主体中心点，应用跳跃、缩放和倾斜
      ctx.translate(50, 65 + jumpY);
      ctx.rotate(tiltAngle);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-50, -65);

      // 2. 绘制主体身体 (果冻质感圆球)
      const bodyGradient = ctx.createRadialGradient(40, 40, 5, 50, 50, 40);
      bodyGradient.addColorStop(0, '#A6C8FF'); // 中心亮蓝
      bodyGradient.addColorStop(1, '#4D7FFF'); // 边缘蓝宝石色

      ctx.beginPath();
      ctx.arc(50, 50, 35, 0, Math.PI * 2);
      ctx.fillStyle = bodyGradient;
      ctx.fill();

      // 内发光/内描边
      ctx.beginPath();
      ctx.arc(50, 50, 34, 0, Math.PI * 2); // 半径稍微小一点点
      ctx.strokeStyle = '#B0D4FF'; // 浅蓝色
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // 顶部高光点 (增强果冻感)
      ctx.beginPath();
      ctx.ellipse(40, 25, 12, 4, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      // 3. 绘制五官 (极简白色胶囊眼)
      ctx.fillStyle = '#FFFFFF';
      
      // 左眼
      ctx.save();
      ctx.translate(38, 48);
      ctx.scale(1, eyeScaleY);
      ctx.beginPath();
      ctx.roundRect(-3.5, -7, 7, 14, 3.5);
      ctx.fill();
      ctx.restore();

      // 右眼
      ctx.save();
      ctx.translate(62, 48);
      ctx.scale(1, eyeScaleY);
      ctx.beginPath();
      ctx.roundRect(-3.5, -7, 7, 14, 3.5);
      ctx.fill();
      ctx.restore();

      // 脸颊红晕 (淡紫色，水平椭圆)
      ctx.fillStyle = 'rgba(202, 178, 255, 0.6)'; // #CAB2FF with opacity
      ctx.beginPath();
      ctx.ellipse(28, 56, 7, 3.5, 0, 0, Math.PI * 2); // 水平向外晕染
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(72, 56, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 循环动画
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div style={{ 
      width: size, 
      height: size, 
      overflow: 'visible', 
      display: 'flex', 
      alignItems: 'flex-start',
      justifyContent: 'center',
      ...style 
    }} className={className}>
      <canvas
        ref={canvasRef}
        className="rounded-full"
        style={{ 
          width: totalCanvasSize, 
          height: totalCanvasSize,
          marginTop: -topPadding // 向上偏移，让底部对齐
        }}
      />
    </div>
  );
}
