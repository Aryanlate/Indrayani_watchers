'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Station, Reading } from '@/lib/types';
import { getRiverGeoJSON, STATION_PROGRESS_STOPS } from '@/lib/riverCoordinates';
import StationSidePanel from './StationSidePanel';
import MapOverlayControls, { HeatMode } from './MapOverlayControls';
import TimeScrubber from './TimeScrubber';
import { getStationHistory } from '@/lib/mockData';

interface RiverMapProps {
  stations: Station[];
  liveReadings: Record<string, Reading>;
}

const STATUS_COLORS: Record<string, string> = {
  good: '#22C55E',
  moderate: '#FDE047',
  poor: '#F97316',
  'very-poor': '#EF4444',
  offline: '#64748B',
};

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

const navigatorMem: number | undefined =
  typeof navigator !== 'undefined'
    ? (navigator as NavigatorWithMemory).deviceMemory
    : undefined;

const isLowEndDevice =
  typeof navigator !== 'undefined' &&
  (navigator.hardwareConcurrency <= 4 ||
    (typeof navigatorMem === 'number' && navigatorMem <= 4) ||
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches));

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Parameter color evaluation for Heat Mode
function getParameterColor(param: HeatMode, reading: Reading | undefined): string {
  if (!reading || reading.status === 'offline' || reading.isOnline === false) return '#64748B';
  if (param === 'wqi') {
    return STATUS_COLORS[reading.status] || '#FDE047';
  }
  if (param === 'do') {
    if (reading.do >= 6.5) return '#22C55E';
    if (reading.do >= 5.0) return '#FDE047';
    if (reading.do >= 3.5) return '#F97316';
    return '#EF4444';
  }
  if (param === 'ph') {
    if (reading.ph >= 6.8 && reading.ph <= 7.8) return '#22C55E';
    if (reading.ph >= 6.5 && reading.ph <= 8.5) return '#FDE047';
    if (reading.ph >= 6.0 && reading.ph <= 9.0) return '#F97316';
    return '#EF4444';
  }
  if (param === 'turbidity') {
    if (reading.turbidity <= 5.0) return '#22C55E';
    if (reading.turbidity <= 15.0) return '#FDE047';
    if (reading.turbidity <= 35.0) return '#F97316';
    return '#EF4444';
  }
  if (param === 'tds') {
    if (reading.tds <= 250) return '#22C55E';
    if (reading.tds <= 500) return '#FDE047';
    if (reading.tds <= 800) return '#F97316';
    return '#EF4444';
  }
  return '#22D3EE';
}

export default function RiverMap({ stations, liveReadings }: RiverMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const animationFrameRef = useRef<number | null>(null);

  // Selected station for slide-in side panel
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  // Overlay controls state
  const [heatMode, setHeatMode] = useState<HeatMode>('wqi');
  const [flowAnimation, setFlowAnimation] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  // Time scrubber state (0 = live, up to 72h ago)
  const [hoursAgo, setHoursAgo] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Determine current active readings: either live or scrubbed historical snapshot
  const activeReadings = React.useMemo(() => {
    if (hoursAgo <= 0.1) {
      return liveReadings;
    }

    // Historical lookup: 15-minute interval = 4 per hour
    const intervalIndex = Math.min(287, Math.floor(hoursAgo * 4));
    const snapshot: Record<string, Reading> = {};

    for (const s of stations) {
      const history = getStationHistory(s.id, 72);
      // Index from end
      const targetIdx = Math.max(0, history.length - 1 - intervalIndex);
      snapshot[s.id] = history[targetIdx] || liveReadings[s.id];
    }

    return snapshot;
  }, [hoursAgo, liveReadings, stations]);

  // Build dynamic MapLibre line-gradient expression based on current activeReadings & heatMode
  const getLineGradientExpression = useCallback(() => {
    const s1Color = getParameterColor(heatMode, activeReadings['S1']);
    const s4Color = getParameterColor(heatMode, activeReadings['S4']);
    const s3Color = getParameterColor(heatMode, activeReadings['S3']);
    const s2Color = getParameterColor(heatMode, activeReadings['S2']);
    const s5Color = getParameterColor(heatMode, activeReadings['S5']);
    const s6Color = getParameterColor(heatMode, activeReadings['S6']);

    return [
      'interpolate',
      ['linear'],
      ['line-progress'],
      STATION_PROGRESS_STOPS['S1'], s1Color,
      STATION_PROGRESS_STOPS['S4'], s4Color,
      STATION_PROGRESS_STOPS['S3'], s3Color,
      STATION_PROGRESS_STOPS['S2'], s2Color,
      STATION_PROGRESS_STOPS['S5'], s5Color,
      STATION_PROGRESS_STOPS['S6'], s6Color,
    ];
  }, [activeReadings, heatMode]);

  // 1. Initialize MapLibre GL Map on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [73.850, 18.680], // Centered between Dehu and Confluence
      zoom: 11.2,
      minZoom: 9,
      maxZoom: 17,
      pitch: 15,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // Add River GeoJSON source with lineMetrics enabled for continuous gradient interpolation
      map.addSource('indrayani-river-source', {
        type: 'geojson',
        data: getRiverGeoJSON(),
        lineMetrics: true,
      });

      // 1. Outer River Depth Glow Layer
      map.addLayer({
        id: 'river-outer-glow',
        type: 'line',
        source: 'indrayani-river-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 16,
          'line-blur': 10,
          'line-opacity': 0.45,
          'line-gradient': getLineGradientExpression() as unknown as maplibregl.ExpressionSpecification,
        },
      });

      // 2. Primary River Line Layer with Gradient Degradation
      map.addLayer({
        id: 'river-main-line',
        type: 'line',
        source: 'indrayani-river-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 7,
          'line-gradient': getLineGradientExpression() as unknown as maplibregl.ExpressionSpecification,
        },
      });

      // 3. Animated Cyan Flow Line Layer (dashed)
      map.addLayer({
        id: 'river-flow-line',
        type: 'line',
        source: 'indrayani-river-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#22D3EE',
          'line-width': 2.5,
          'line-opacity': 0.85,
          'line-dasharray': [0, 4, 3],
        },
      });
    });

    mapRef.current = map;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [getLineGradientExpression]);

  // 2. Update River Gradient when activeReadings or heatMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      const gradient = getLineGradientExpression();
      if (map.getLayer('river-main-line')) {
        map.setPaintProperty('river-main-line', 'line-gradient', gradient as unknown as maplibregl.ExpressionSpecification);
      }
      if (map.getLayer('river-outer-glow')) {
        map.setPaintProperty('river-outer-glow', 'line-gradient', gradient as unknown as maplibregl.ExpressionSpecification);
      }
    } catch (err) {
      console.warn('[MapLibre] Could not update line gradient:', err);
    }
  }, [getLineGradientExpression]);

  // 3. Animated Cyan Water Flow (Smooth Moving Map Effect ~1.5s cycle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flowAnimation || prefersReducedMotion) {
      if (map && map.getLayer('river-flow-line')) {
        if (prefersReducedMotion) {
          map.setLayoutProperty('river-flow-line', 'visibility', 'none');
        } else {
          map.setLayoutProperty('river-flow-line', 'visibility', 'none');
        }
      }
      return;
    }

    if (map.getLayer('river-flow-line')) {
      map.setLayoutProperty('river-flow-line', 'visibility', 'visible');
    }

    const duration = 1500; // 1.5s dash cycle
    const startTime = performance.now();
    let frameCounter = 0;
    let lowEndIntervalRef: NodeJS.Timeout | null = null;

    if (isLowEndDevice) {
      lowEndIntervalRef = setInterval(() => {
        const now = performance.now();
        const elapsed = (now - startTime) % duration;
        const progress = elapsed / duration;

        const dash = 2;
        const gap = 2;
        const d1 = Math.max(0.01, progress * 4);
        const g1 = Math.max(0.01, (1 - progress) * 4);

        if (mapRef.current && mapRef.current.getLayer('river-flow-line')) {
          mapRef.current.setPaintProperty('river-flow-line', 'line-dasharray', [d1, dash, g1, gap]);
        }
      }, 33);
    } else {
      const animateDash = (now: number) => {
        const elapsed = (now - startTime) % duration;
        const progress = elapsed / duration;

        frameCounter++;
        if (frameCounter % 2 === 0 && isLowEndDevice) {
          animationFrameRef.current = requestAnimationFrame(animateDash);
          return;
        }

        // Cycle dasharray seamlessly [offset, dash, gap]
        const dash = 2;
        const gap = 2;
        const d1 = Math.max(0.01, progress * 4);
        const g1 = Math.max(0.01, (1 - progress) * 4);

        if (mapRef.current && mapRef.current.getLayer('river-flow-line')) {
          mapRef.current.setPaintProperty('river-flow-line', 'line-dasharray', [d1, dash, g1, gap]);
        }

        animationFrameRef.current = requestAnimationFrame(animateDash);
      };

      animationFrameRef.current = requestAnimationFrame(animateDash);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (lowEndIntervalRef) {
        clearInterval(lowEndIntervalRef);
      }
    };
  }, [flowAnimation]);

  // 4. Create and Update Custom HTML Sonar Pulse Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stations.forEach((station) => {
      const reading = activeReadings[station.id];
      const isOffline = reading?.status === 'offline' || reading?.isOnline === false;
      const status = isOffline ? 'offline' : (reading?.status || 'moderate');
      const color = isOffline ? '#64748B' : getParameterColor(heatMode, reading);
      const wqiVal = isOffline ? 'OFF' : reading ? reading.wqi.toFixed(0) : '—';

      // Pulse speed scales with severity: Very Poor (0.9s), Poor (1.5s), Moderate (2.3s), Good (3.2s)
      const rippleDuration =
        status === 'very-poor' ? '0.9s' : status === 'poor' ? '1.5s' : status === 'moderate' ? '2.3s' : '3.2s';

      if (!markersRef.current[station.id]) {
        // Create custom DOM Marker
        const markerEl = document.createElement('div');
        markerEl.className = 'station-sonar-marker group relative flex flex-col items-center cursor-pointer';
        markerEl.setAttribute('tabindex', '0');
        markerEl.setAttribute('role', 'button');
        markerEl.setAttribute('aria-label', `${station.id}: ${station.name}. Press Enter or Space to view details.`);
        markerEl.style.outline = 'none';

        markerEl.addEventListener('focus', () => {
          markerEl.style.outline = '2px solid #22D3EE';
          markerEl.style.outlineOffset = '2px';
          markerEl.style.borderRadius = '9999px';
        });
        markerEl.addEventListener('blur', () => {
          markerEl.style.outline = 'none';
          markerEl.style.outlineOffset = '0px';
        });

        // Sonar expanding ripple ring
        const rippleEl = document.createElement('div');
        rippleEl.className = 'sonar-ripple-ring absolute rounded-full pointer-events-none';
        rippleEl.style.width = '36px';
        rippleEl.style.height = '36px';
        rippleEl.style.display = isOffline ? 'none' : 'block';
        rippleEl.style.border = `2px solid ${color}`;
        rippleEl.style.animation = prefersReducedMotion ? 'none' : `sonarRipple ${rippleDuration} cubic-bezier(0, 0.2, 0.8, 1) infinite`;

        // Inner filled circle
        const circleEl = document.createElement('div');
        circleEl.className = 'marker-circle relative flex items-center justify-center rounded-full text-white font-mono font-bold shadow-xl transition-all duration-300 group-hover:scale-115';
        circleEl.style.width = '34px';
        circleEl.style.height = '34px';
        circleEl.style.backgroundColor = color;
        circleEl.style.opacity = isOffline ? '0.6' : '1';
        circleEl.style.border = '2px solid #0B1220';
        circleEl.style.boxShadow = isOffline ? 'none' : `0 0 12px ${color}88`;
        circleEl.innerHTML = `<span class="text-[10px] font-bold text-white tracking-tight">${wqiVal}</span>`;

        // Text label below circle
        const labelEl = document.createElement('div');
        labelEl.className = 'marker-label mt-1 rounded bg-[#121C2E]/90 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#E6EDF7] border border-[#1E2C42] shadow pointer-events-none whitespace-nowrap transition-opacity duration-200';
        labelEl.innerText = `${station.id}: ${station.name.split(' ')[0]}`;

        markerEl.appendChild(rippleEl);
        markerEl.appendChild(circleEl);
        markerEl.appendChild(labelEl);

        markerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedStationId(station.id);
        });

        markerEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedStationId(station.id);
          }
        });

        const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
          .setLngLat([station.lng, station.lat])
          .addTo(map);

        markersRef.current[station.id] = marker;
      } else {
        // Update existing marker DOM styling
        const marker = markersRef.current[station.id];
        const el = marker.getElement();
        const ripple = el.querySelector('.sonar-ripple-ring') as HTMLElement;
        const circle = el.querySelector('.marker-circle') as HTMLElement;
        const label = el.querySelector('.marker-label') as HTMLElement;

        if (ripple) {
          ripple.style.display = isOffline ? 'none' : 'block';
          ripple.style.border = `2px solid ${color}`;
          ripple.style.animation = prefersReducedMotion ? 'none' : `sonarRipple ${rippleDuration} cubic-bezier(0, 0.2, 0.8, 1) infinite`;
        }
        if (circle) {
          circle.style.opacity = isOffline ? '0.6' : '1';
          circle.style.backgroundColor = color;
          circle.style.boxShadow = isOffline ? 'none' : `0 0 12px ${color}88`;
          circle.innerHTML = `<span class="text-[10px] font-bold text-white tracking-tight">${wqiVal}</span>`;
        }
        if (label) {
          label.style.display = showLabels ? 'block' : 'none';
        }
      }
    });
  }, [activeReadings, heatMode, showLabels, stations]);

  // 5. Time Scrubber Playback loop (1 hour of historical time per 1 second of playback)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setHoursAgo((prev) => {
        // Step forward in time (reduce hoursAgo by 0.5h every 500ms -> 1h / sec)
        const nextVal = prev - 0.5;
        if (nextVal <= 0) {
          setIsPlaying(false);
          return 0; // Live!
        }
        return nextVal;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const selectedStation = stations.find((s) => s.id === selectedStationId) || null;
  const selectedReading = selectedStation ? activeReadings[selectedStation.id] || null : null;
  const selectedHistory = selectedStation ? getStationHistory(selectedStation.id, 24) : [];

  return (
    <div
      id="indrayani-river-map"
      className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-[#0B1220]"
      aria-label="Indrayani River monitoring map. Use arrow keys to pan, + / - to zoom, Tab to focus station markers."
    >
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Overlay Controls (Top-Left) */}
      <MapOverlayControls
        heatMode={heatMode}
        onHeatModeChange={setHeatMode}
        flowAnimation={flowAnimation}
        onFlowAnimationToggle={() => setFlowAnimation(!flowAnimation)}
        showLabels={showLabels}
        onShowLabelsToggle={() => setShowLabels(!showLabels)}
      />

      {/* Floating 72-Hour Time Scrubber (Bottom) */}
      <TimeScrubber
        hoursAgo={hoursAgo}
        onChangeHoursAgo={(val) => {
          setHoursAgo(val);
          setIsPlaying(false);
        }}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onJumpToLive={() => {
          setHoursAgo(0);
          setIsPlaying(false);
        }}
      />

      {/* Slide-In Glassmorphism Station Side Panel (Right) */}
      <StationSidePanel
        station={selectedStation}
        reading={selectedReading}
        history24h={selectedHistory}
        isOpen={Boolean(selectedStationId)}
        onClose={() => setSelectedStationId(null)}
      />

      {/* Sonar Ripple CSS Keyframe Injection */}
      <style jsx global>{`
        @keyframes sonarRipple {
          0% {
            transform: scale(0.85);
            opacity: 0.95;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
