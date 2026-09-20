'use client';

import React, { useEffect, useState, useRef } from 'react';

export interface LiveValueProps {
  value: number;
  unit?: string;
  decimals?: number;
  className?: string;
  unitClassName?: string;
  prefix?: string;
}

/**
 * Exact cubic-bezier(0.22, 1, 0.36, 1) timing function evaluation
 */
function cubicBezierEasing(t: number): number {
  // P0 = (0, 0), P1 = (0.22, 1.0), P2 = (0.36, 1.0), P3 = (1.0, 1.0)
  // For x(u) and y(u) with P1.y = 1 and P2.y = 1:
  // Using 5 Newton-Raphson iterations to solve for parameter u from time t
  let u = t;
  for (let i = 0; i < 5; i++) {
    const currentX =
      3 * (1 - u) * (1 - u) * u * 0.22 +
      3 * (1 - u) * u * u * 0.36 +
      u * u * u;
    const diff = currentX - t;
    if (Math.abs(diff) < 1e-4) break;
    const derivativeX =
      3 * (1 - u) * (1 - u) * 0.22 +
      6 * (1 - u) * u * (0.36 - 0.22) +
      3 * u * u * (1 - 0.36);
    if (Math.abs(derivativeX) < 1e-4) break;
    u -= diff / derivativeX;
  }
  u = Math.max(0, Math.min(1, u));

  // Compute y(u)
  const y =
    3 * (1 - u) * (1 - u) * u * 1.0 +
    3 * (1 - u) * u * u * 1.0 +
    u * u * u;

  return y;
}

/**
 * <LiveValue> Primitive
 * Telemetry number that smoothly counts up/down over 400ms without snapping.
 * Uses JetBrains Mono monospace font with tabular-nums so digits do not jitter.
 * Strictly respects prefers-reduced-motion.
 */
export function LiveValue({
  value,
  unit,
  decimals = 1,
  className = '',
  unitClassName = '',
  prefix = '',
}: LiveValueProps) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeValue);
  const currentRenderedRef = useRef<number>(safeValue);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(safeValue);
      currentRenderedRef.current = safeValue;
      return;
    }

    const startValue = currentRenderedRef.current;
    const targetValue = safeValue;
    const diff = targetValue - startValue;

    if (Math.abs(diff) < 1e-6) {
      setDisplayValue(targetValue);
      currentRenderedRef.current = targetValue;
      return;
    }

    const duration = 400; // 400ms count transition
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = cubicBezierEasing(progress);

      const currentInterp = startValue + diff * easedProgress;
      setDisplayValue(currentInterp);
      currentRenderedRef.current = currentInterp;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(targetValue);
        currentRenderedRef.current = targetValue;
      }
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(updateCounter);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [safeValue]);

  const formattedNumber = displayValue.toFixed(decimals);

  return (
    <span className="inline-flex items-baseline gap-1 font-mono tabular-nums tracking-tight">
      {prefix && <span className="text-[#8A9BB4] select-none">{prefix}</span>}
      <span className={`text-[#E6EDF7] font-semibold ${className}`}>
        {formattedNumber}
      </span>
      {unit && (
        <span
          className={`ml-0.5 text-xs font-normal text-[#8A9BB4] tracking-normal font-sans ${unitClassName}`}
        >
          {unit}
        </span>
      )}
    </span>
  );
}

export default LiveValue;
