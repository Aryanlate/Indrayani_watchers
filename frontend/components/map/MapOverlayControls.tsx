'use client';

import React from 'react';
import { Waves, Tag, SlidersHorizontal } from 'lucide-react';

export type HeatMode = 'wqi' | 'do' | 'ph' | 'turbidity' | 'tds';

interface MapOverlayControlsProps {
  heatMode: HeatMode;
  onHeatModeChange: (mode: HeatMode) => void;
  flowAnimation: boolean;
  onFlowAnimationToggle: () => void;
  showLabels: boolean;
  onShowLabelsToggle: () => void;
}

export default function MapOverlayControls({
  heatMode,
  onHeatModeChange,
  flowAnimation,
  onFlowAnimationToggle,
  showLabels,
  onShowLabelsToggle,
}: MapOverlayControlsProps) {
  const heatModes: { key: HeatMode; label: string }[] = [
    { key: 'wqi', label: 'WQI' },
    { key: 'do', label: 'DO' },
    { key: 'ph', label: 'pH' },
    { key: 'turbidity', label: 'Turbidity' },
    { key: 'tds', label: 'TDS' },
  ];

  return (
    <div className="absolute top-4 left-4 z-20 w-72 rounded-xl bg-[#121C2E]/92 backdrop-blur-xl border border-[#1E2C42] p-3.5 shadow-2xl text-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E2C42] pb-2">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#8A9BB4] text-[11px]">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#22D3EE]" />
          <span>Telemetry Map Layers</span>
        </div>
        <span className="h-2 w-2 rounded-full bg-[#22D3EE] animate-pulse" />
      </div>

      {/* Parameter Heat Mode */}
      <div>
        <label className="block text-[11px] font-semibold text-[#8A9BB4] mb-1.5">
          River Color Heat Mode
        </label>
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-[#0D1524] p-1 border border-[#1E2C42]">
          {heatModes.map((item) => (
            <button
              key={item.key}
              onClick={() => onHeatModeChange(item.key)}
              className={`py-1 text-[11px] font-medium rounded transition-all duration-200 ${heatMode === item.key
                  ? 'bg-[#22D3EE] text-[#0B1220] font-bold shadow-sm'
                  : 'text-[#8A9BB4] hover:text-[#E6EDF7]'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="pt-2 border-t border-[#1E2C42] flex items-center justify-between">
        {/* Animated Flow Toggle */}
        <button
          onClick={onFlowAnimationToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${flowAnimation
              ? 'bg-[#22D3EE]/15 text-[#22D3EE] border-[#22D3EE]/40 font-semibold'
              : 'bg-[#0D1524] text-[#8A9BB4] border-[#1E2C42]'
            }`}
          title="Toggle moving cyan river flow line"
        >
          <Waves className={`h-3.5 w-3.5 ${flowAnimation ? 'animate-pulse' : ''}`} />
          <span>Flow</span>
        </button>

        {/* Station Labels Toggle */}
        <button
          onClick={onShowLabelsToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${showLabels
              ? 'bg-[#22D3EE]/15 text-[#22D3EE] border-[#22D3EE]/40 font-semibold'
              : 'bg-[#0D1524] text-[#8A9BB4] border-[#1E2C42]'
            }`}
          title="Toggle station names and WQI badges on map"
        >
          <Tag className="h-3.5 w-3.5" />
          <span>Labels</span>
        </button>
      </div>
    </div>
  );
}
