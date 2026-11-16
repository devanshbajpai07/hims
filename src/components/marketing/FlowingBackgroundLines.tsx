import React from 'react';

interface FlowingBackgroundLinesProps {
  theme?: 'light' | 'dark';
  className?: string;
}

export const FlowingBackgroundLines: React.FC<FlowingBackgroundLinesProps> = ({
  theme = 'light',
  className = '',
}) => {
  const isDark = theme === 'dark';

  const strokeColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(100, 116, 139, 0.22)';
  const secondaryStrokeColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(148, 163, 184, 0.15)';

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id={`glow-${theme}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Path 1: Primary High-Altitude Curve */}
        <path
          id={`flow-line-1-${theme}`}
          d="M -100 240 C 260 120, 520 340, 840 210 C 1120 90, 1320 280, 1550 180"
          stroke={strokeColor}
          strokeWidth="1.2"
          fill="none"
        />

        {/* Path 2: Central Flowing Horizon */}
        <path
          id={`flow-line-2-${theme}`}
          d="M -50 490 C 220 580, 480 380, 780 470 C 1080 560, 1280 430, 1520 520"
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />

        {/* Path 3: Lower Sweeping Wave */}
        <path
          id={`flow-line-3-${theme}`}
          d="M -80 720 C 310 660, 590 820, 940 710 C 1220 620, 1380 780, 1540 690"
          stroke={secondaryStrokeColor}
          strokeWidth="0.85"
          fill="none"
        />

        {/* Path 4: Diagonal Harmonic Flow */}
        <path
          id={`flow-line-4-${theme}`}
          d="M -60 110 C 340 280, 700 160, 1020 380 C 1280 560, 1420 480, 1560 620"
          stroke={secondaryStrokeColor}
          strokeWidth="0.8"
          strokeDasharray="3 3"
          fill="none"
        />
      </svg>
    </div>
  );
};
