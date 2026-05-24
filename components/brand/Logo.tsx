'use client';

import { useState } from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function Logo({ width = 180, height = 60, className = '' }: LogoProps) {
  // 0: try webp, 1: try png, 2: fallback to text
  const [stage, setStage] = useState(0);

  const handleError = () => {
    setStage((prev) => Math.min(prev + 1, 2));
  };

  if (stage >= 2) {
    return (
      <div 
        className={'flex flex-col items-center justify-center text-center select-none ' + className}
        style={{ width, height: 'auto' }}
      >
        <span className="brand-heading text-2xl tracking-[0.3em] text-brandAccent uppercase whitespace-nowrap leading-none mb-1">
          SABBATH
        </span>
        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-brandAccent/60 whitespace-nowrap">
          SPA & WELLNESS HUB
        </span>
      </div>
    );
  }

  const src = stage === 0 ? "/sabbath-logo.webp" : "/sabbath-logo.png";

  return (
    <img
      src={src}
      alt="Sabbath Spa & Wellness Hub Logo"
      width={width}
      height={height}
      className={"object-contain select-none " + className}
      style={{ width, height: 'auto', maxWidth: '100%' }}
      onError={handleError}
    />
  );
}
