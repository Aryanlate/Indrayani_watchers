'use client';

import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

export default function Sparkline({
  data,
  color = '#22D3EE',
  height = 40,
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className={`w-full ${className}`} />;
  }

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const width = 240;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  // Generate SVG points
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const normalizedY = (val - minVal) / range;
    // Invert Y so highest value is at top
    const y = height - paddingY - normalizedY * usableHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    // Smooth bezier curve control points
    const prev = points[idx - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX.toFixed(1)} ${prev.y.toFixed(1)}, ${cpX.toFixed(1)} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const gradientId = `sparkline-grad-${color.replace('#', '')}`;

  return (
    <div style={{ height }} className={`relative w-full overflow-hidden ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Shaded Area Under Sparkline */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Sparkline Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Latest Value End Dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="2.5"
            fill={color}
            className="animate-pulse"
          />
        )}
      </svg>
    </div>
  );
}
