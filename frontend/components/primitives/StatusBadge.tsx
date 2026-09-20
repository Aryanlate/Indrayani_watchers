import React from 'react';

export type WaterStatus = 'good' | 'moderate' | 'poor' | 'very-poor' | 'offline';

export interface StatusBadgeProps {
  status: WaterStatus;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG = {
  good: {
    label: 'Good',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.28)',
    dotColor: '#22C55E',
  },
  moderate: {
    label: 'Moderate',
    color: '#FDE047',
    bgColor: 'rgba(253, 224, 71, 0.12)',
    borderColor: 'rgba(253, 224, 71, 0.28)',
    dotColor: '#FDE047',
  },
  poor: {
    label: 'Poor',
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.28)',
    dotColor: '#F97316',
  },
  'very-poor': {
    label: 'Very Poor',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.28)',
    dotColor: '#EF4444',
  },
  offline: {
    label: 'Offline',
    color: '#94A3B8',
    bgColor: 'rgba(100, 116, 139, 0.16)',
    borderColor: 'rgba(100, 116, 139, 0.35)',
    dotColor: '#64748B',
  },
};

const SIZE_CONFIG = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    dot: 'h-1.5 w-1.5',
  },
  md: {
    badge: 'px-2.5 py-1 text-xs',
    dot: 'h-2 w-2',
  },
  lg: {
    badge: 'px-3.5 py-1.5 text-sm',
    dot: 'h-2.5 w-2.5',
  },
};

/**
 * <StatusBadge> Primitive
 * Enforces canonical river water-quality status colors (#22C55E, #FDE047, #F97316, #EF4444).
 * Dark, calm, scientific aesthetic with tinted backdrops and subtle borders.
 */
export function StatusBadge({
  status,
  label,
  showDot = true,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.moderate;
  const sizeStyles = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const displayLabel = label || config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium tracking-wide transition-colors ${sizeStyles.badge} ${className}`}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.color,
      }}
    >
      {showDot && (
        <span
          className={`rounded-full shrink-0 ${sizeStyles.dot}`}
          style={{ backgroundColor: config.dotColor }}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
