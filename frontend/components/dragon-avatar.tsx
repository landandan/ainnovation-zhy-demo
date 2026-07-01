import React from 'react';

interface DragonAvatarProps {
  className?: string;
  style?: React.CSSProperties;
}

export function DragonAvatar({ className = '', style }: DragonAvatarProps) {
  return (
    <div 
      className={`flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 ${className}`}
      style={{ width: '100%', height: '100%', ...style }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full avatar-animate-float" style={{ transform: 'scale(1.15) translateY(5%)' }}>
        {/* 龙角 (左) */}
        <path 
          className="horn-animate-left"
          d="M 35 30 Q 25 15 15 20 Q 25 25 30 35 Z" 
          fill="#FFD700" 
          stroke="#B8860B" 
          strokeWidth="1"
        />
        {/* 龙角 (右) */}
        <path 
          className="horn-animate-right"
          d="M 65 30 Q 75 15 85 20 Q 75 25 70 35 Z" 
          fill="#FFD700" 
          stroke="#B8860B" 
          strokeWidth="1"
        />
        
        {/* 脸部底色 (圆形) */}
        <circle cx="50" cy="55" r="35" fill="#E0F7FA" />
        
        {/* 脸颊红晕 */}
        <circle cx="30" cy="60" r="6" fill="#FFB6C1" opacity="0.6" />
        <circle cx="70" cy="60" r="6" fill="#FFB6C1" opacity="0.6" />

        {/* 眼睛 (左) - 包含眨眼动画 */}
        <g className="eye-blink" style={{ transformOrigin: '35px 50px' }}>
          <ellipse cx="35" cy="50" rx="4" ry="6" fill="#000000" />
          <circle cx="36" cy="48" r="1.5" fill="#FFFFFF" />
        </g>

        {/* 眼睛 (右) - 包含眨眼动画 */}
        <g className="eye-blink" style={{ transformOrigin: '65px 50px' }}>
          <ellipse cx="65" cy="50" rx="4" ry="6" fill="#000000" />
          <circle cx="66" cy="48" r="1.5" fill="#FFFFFF" />
        </g>

        {/* 嘴巴 (微笑) */}
        <path 
          d="M 42 65 Q 50 72 58 65" 
          fill="none" 
          stroke="#000000" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* 龙须 (左) */}
        <path 
          className="horn-animate-left"
          d="M 25 65 Q 15 75 10 70" 
          fill="none" 
          stroke="#87CEEB" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        {/* 龙须 (右) */}
        <path 
          className="horn-animate-right"
          d="M 75 65 Q 85 75 90 70" 
          fill="none" 
          stroke="#87CEEB" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
