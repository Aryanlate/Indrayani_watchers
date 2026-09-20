'use client';

import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimeScrubberProps {
  hoursAgo: number; // 0 = Live (Now), up to 72 = 72h ago
  onChangeHoursAgo: (hours: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onJumpToLive: () => void;
}

export default function TimeScrubber({
  hoursAgo,
  onChangeHoursAgo,
  isPlaying,
  onTogglePlay,
  onJumpToLive,
}: TimeScrubberProps) {
  const isLive = hoursAgo <= 0.1;

  // Compute timestamp label
  const scrubberDate = new Date(Date.now() - hoursAgo * 3600 * 1000);
  const timeFormatted = isLive
    ? 'Live Telemetry (Real-Time)'
    : scrubberDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[92%] sm:w-[640px] rounded-2xl bg-[#121C2E]/92 backdrop-blur-2xl border border-[#1E2C42] p-4 shadow-2xl text-xs space-y-2.5">
      {/* Top Header: Time Status & Live Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#22C55E] border border-[#22C55E]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-ping" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-[#22D3EE]/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#22D3EE] border border-[#22D3EE]/30">
              <RotateCcw className="h-3 w-3 animate-spin" />
              REPLAY: {hoursAgo.toFixed(1)}h ago
            </span>
          )}

          <span className="font-mono text-xs font-semibold text-[#E6EDF7] tracking-tight">
            {timeFormatted}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#8A9BB4] font-mono hidden sm:inline">
            Speed: 1h / sec
          </span>

          {!isLive && (
            <button
              onClick={onJumpToLive}
              className="rounded-lg bg-[#22D3EE]/10 px-2 py-1 text-[11px] font-bold text-[#22D3EE] border border-[#22D3EE]/30 hover:bg-[#22D3EE]/20 transition-colors"
            >
              Jump to Live
            </button>
          )}
        </div>
      </div>

      {/* Main Scrubber Slider & Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#22D3EE] text-[#0B1220] transition-all duration-200 hover:bg-[#38BDF8] active:scale-95 shadow-md shadow-[#22D3EE]/25"
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
        </button>

        {/* Range Slider (Inverted: Left is 72h ago, Right is 0 = Live) */}
        <div className="relative flex-1 flex flex-col justify-center">
          <input
            type="range"
            min="0"
            max="72"
            step="0.25"
            // We invert so slider goes from past on left to live on right
            value={72 - hoursAgo}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChangeHoursAgo(Math.max(0, 72 - val));
            }}
            className="w-full h-2 rounded-lg bg-[#0D1524] accent-[#22D3EE] cursor-pointer appearance-none border border-[#1E2C42]"
          />

          {/* Scale Labels */}
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8A9BB4] mt-1.5 px-0.5">
            <span>-72h (Start)</span>
            <span>-48h</span>
            <span>-24h (Yesterday)</span>
            <span className={isLive ? 'text-[#22C55E] font-bold' : ''}>Live (Now)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
