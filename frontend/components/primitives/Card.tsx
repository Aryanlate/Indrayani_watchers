'use client';

import React, { useEffect, useState, useRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  pulseKey?: unknown;
  pulse?: boolean;
  surface?: 'default' | 'nested' | 'elevated';
}

/**
 * <Card> Primitive
 * Dark, calm, scientific surface (#121C2E) with 1px border (#1E2C42).
 * Depth created via layered dark tones, zero drop shadows.
 * Triggers a subtle 600ms cyan glow pulse on border upon new data updates.
 */
export function Card({
  children,
  className = '',
  pulseKey,
  pulse = false,
  surface = 'default',
  ...rest
}: CardProps) {
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const isFirstRender = useRef(true);

  // Surface background color mapping
  const surfaceClasses = {
    default: 'bg-[#121C2E]',
    nested: 'bg-[#0D1524]',
    elevated: 'bg-[#17243B]',
  };

  useEffect(() => {
    // Avoid triggering pulse on initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    if (pulseKey !== undefined || pulse) {
      setIsPulsing(true);
      const timer = setTimeout(() => {
        setIsPulsing(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [pulseKey, pulse]);

  return (
    <div
      className={`relative rounded-xl border border-[#1E2C42] ${surfaceClasses[surface]} transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isPulsing ? 'animate-pulse-cyan' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
