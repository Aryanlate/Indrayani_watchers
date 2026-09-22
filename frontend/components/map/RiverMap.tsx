'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type ExpressionSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

if (typeof window !== 'undefined') {
  setWorkerUrl('/map-workers/maplibre-gl-worker.mjs');
}

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

function detectDeviceCapabilities() {
  if (typeof window === 'undefined') {
    return { isLowEndDevice: false, prefersReducedMotion: false };
  }

  const navigatorMem: number | undefined =
    typeof navigator !== 'undefined'
      ? (navigator as NavigatorWithMemory).deviceMemory
      : undefined;

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const lowEnd =
    typeof navigator !== 'undefined' &&
    (navigator.hardwareConcurrency <= 4 ||
      (typeof navigatorMem === 'number' && navigatorMem <= 4) ||
      reducedMotion);

  return { isLowEndDevice: lowEnd, prefersReducedMotion: reducedMotion };
}

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
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const animationFrameRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const styleLoadedRef = useRef<boolean>(false);

  const [{ isLowEndDevice, prefersReducedMotion }] = useState(() =>
    detectDeviceCapabilities()
  );

  const heatModeRef = useRef<HeatMode>('wqi');
  const activeReadingsRef = useRef<Record<string, Reading>>({});
  const showLabelsRef = useRef<boolean>(true);
  const prefersReducedMotionRef = useRef<boolean>(false);
  const isLowEndDeviceRef = useRef<boolean>(false);
  const flowAnimationRef = useRef<boolean>(true);

  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
    isLowEndDeviceRef.current = isLowEndDevice;
  }, [prefersReducedMotion, isLowEndDevice]);

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const [heatMode, setHeatMode] = useState<HeatMode>('wqi');
  const [flowAnimation, setFlowAnimation] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  useEffect(() => { heatModeRef.current = heatMode; }, [heatMode]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { flowAnimationRef.current = flowAnimation; }, [flowAnimation]);

  const [hoursAgo, setHoursAgo] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const activeReadings = React.useMemo(() => {
    if (hoursAgo <= 0.1) {
      return liveReadings;
    }

    const intervalIndex = Math.min(287, Math.floor(hoursAgo * 4));
    const snapshot: Record<string, Reading> = {};

    for (const s of stations) {
      const history = getStationHistory(s.id, 72);
      const targetIdx = Math.max(0, history.length - 1 - intervalIndex);
      snapshot[s.id] = history[targetIdx] || liveReadings[s.id];
    }

    return snapshot;
  }, [hoursAgo, liveReadings, stations]);

  useEffect(() => {
    activeReadingsRef.current = activeReadings;
  }, [activeReadings]);

  function buildLineGradientExpression(): unknown[] {
    const readings = activeReadingsRef.current;
    const hm = heatModeRef.current;
    const s1Color = getParameterColor(hm, readings['S1']);
    const s4Color = getParameterColor(hm, readings['S4']);
    const s3Color = getParameterColor(hm, readings['S3']);
    const s2Color = getParameterColor(hm, readings['S2']);
    const s5Color = getParameterColor(hm, readings['S5']);
    const s6Color = getParameterColor(hm, readings['S6']);

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
  }

  function applyRiverGradient() {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    try {
      const gradient = buildLineGradientExpression();
      if (map.getLayer('river-main-line')) {
        map.setPaintProperty('river-main-line', 'line-gradient', gradient as unknown as ExpressionSpecification);
      }
      if (map.getLayer('river-outer-glow')) {
        map.setPaintProperty('river-outer-glow', 'line-gradient', gradient as unknown as ExpressionSpecification);
      }
    } catch (err) {
      console.warn('[MapLibre] Could not update line gradient:', err);
    }
  }

  function updateAllMarkers() {
    const map = mapRef.current;
    if (!map) return;

    const readings = activeReadingsRef.current;
    const hm = heatModeRef.current;
    const labelsOn = showLabelsRef.current;
    const reducedMotion = prefersReducedMotionRef.current;

    stations.forEach((station) => {
      const reading = readings[station.id];
      const isOffline = reading?.status === 'offline' || reading?.isOnline === false;
      const status = isOffline ? 'offline' : (reading?.status || 'moderate');
      const color = isOffline ? '#64748B' : getParameterColor(hm, reading);
      const wqiVal = isOffline ? 'OFF' : reading ? reading.wqi.toFixed(0) : '—';

      const rippleDuration =
        status === 'very-poor' ? '0.9s' : status === 'poor' ? '1.5s' : status === 'moderate' ? '2.3s' : '3.2s';

      if (!markersRef.current[station.id]) {
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

        const rippleEl = document.createElement('div');
        rippleEl.className = 'sonar-ripple-ring absolute rounded-full pointer-events-none';
        rippleEl.style.width = '36px';
        rippleEl.style.height = '36px';
        rippleEl.style.display = isOffline ? 'none' : 'block';
        rippleEl.style.border = `2px solid ${color}`;
        rippleEl.style.animation = reducedMotion ? 'none' : `sonarRipple ${rippleDuration} cubic-bezier(0, 0.2, 0.8, 1) infinite`;

        const circleEl = document.createElement('div');
        circleEl.className = 'marker-circle relative flex items-center justify-center rounded-full text-white font-mono font-bold shadow-xl transition-all duration-300 group-hover:scale-115';
        circleEl.style.width = '34px';
        circleEl.style.height = '34px';
        circleEl.style.backgroundColor = color;
        circleEl.style.opacity = isOffline ? '0.6' : '1';
        circleEl.style.border = '2px solid #0B1220';
        circleEl.style.boxShadow = isOffline ? 'none' : `0 0 12px ${color}88`;
        circleEl.innerHTML = `<span class="text-[10px] font-bold text-white tracking-tight">${wqiVal}</span>`;

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

        const marker = new Marker({ element: markerEl, anchor: 'center' })
          .setLngLat([station.lng, station.lat])
          .addTo(map);

        markersRef.current[station.id] = marker;
      } else {
        const marker = markersRef.current[station.id];
        const el = marker.getElement();
        const ripple = el.querySelector('.sonar-ripple-ring') as HTMLElement;
        const circle = el.querySelector('.marker-circle') as HTMLElement;
        const label = el.querySelector('.marker-label') as HTMLElement;

        if (ripple) {
          ripple.style.display = isOffline ? 'none' : 'block';
          ripple.style.border = `2px solid ${color}`;
          ripple.style.animation = reducedMotion ? 'none' : `sonarRipple ${rippleDuration} cubic-bezier(0, 0.2, 0.8, 1) infinite`;
        }
        if (circle) {
          circle.style.opacity = isOffline ? '0.6' : '1';
          circle.style.backgroundColor = color;
          circle.style.boxShadow = isOffline ? 'none' : `0 0 12px ${color}88`;
          circle.innerHTML = `<span class="text-[10px] font-bold text-white tracking-tight">${wqiVal}</span>`;
        }
        if (label) {
          label.style.display = labelsOn ? 'block' : 'none';
        }
      }
    });
  }

  function stopFlowAnimation() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startFlowAnimation() {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    if (!flowAnimationRef.current || prefersReducedMotionRef.current) {
      if (map.getLayer('river-flow-line')) {
        map.setLayoutProperty('river-flow-line', 'visibility', 'none');
      }
      return;
    }
    if (map.getLayer('river-flow-line')) {
      map.setLayoutProperty('river-flow-line', 'visibility', 'visible');
    }

    // MapLibre 6 compiles dasharray into a GPU atlas. Mutating line-dasharray
    // every frame throws `Cannot read properties of null (reading 'y')` and
    // stalls the render loop (no markers, Next.js error overlay). Pulse opacity instead.
    const duration = 1800;
    const startTime = performance.now();

    stopFlowAnimation();

    const animateFlow = (now: number) => {
      const t = ((now - startTime) % duration) / duration;
      const opacity = 0.35 + 0.5 * Math.abs(Math.sin(t * Math.PI));
      if (mapRef.current?.getLayer('river-flow-line')) {
        try {
          mapRef.current.setPaintProperty('river-flow-line', 'line-opacity', opacity);
        } catch {
          /* layer may have been removed during teardown */
        }
      }
      animationFrameRef.current = requestAnimationFrame(animateFlow);
    };

    animationFrameRef.current = requestAnimationFrame(animateFlow);
  }

  // 1. Initialize MapLibre GL Map once on mount (empty deps — Strict-Mode safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    let handleLoadRan = false;
    const containerEl = mapContainerRef.current;

    const map = new MapLibreMap({
      container: containerEl,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [73.850, 18.680],
      zoom: 11.2,
      minZoom: 9,
      maxZoom: 17,
      pitch: 15,
      trackResize: true,
    });

    map.on('error', (e) => {
      const message = e.error?.message || String(e.error || e);
      if (/failed to fetch|networkerror|load failed|404/i.test(message)) {
        console.warn('[MapLibre] tile/style request failed:', message);
        return;
      }
      console.error('[MapLibre] error:', message);
    });

    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    const resizeMap = () => {
      if (!cancelled && mapRef.current === map) {
        map.resize();
      }
    };
    requestAnimationFrame(resizeMap);
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(containerEl);

    const handleLoad = () => {
      if (cancelled || handleLoadRan) return;
      handleLoadRan = true;
      styleLoadedRef.current = true;

      try {
        if (!map.getSource('indrayani-river-source')) {
          map.addSource('indrayani-river-source', {
            type: 'geojson',
            data: getRiverGeoJSON(),
            lineMetrics: true,
          });
        }

        if (!map.getLayer('river-outer-glow')) {
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
              'line-gradient': buildLineGradientExpression() as unknown as ExpressionSpecification,
            },
          });
        }

        if (!map.getLayer('river-main-line')) {
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
              'line-gradient': buildLineGradientExpression() as unknown as ExpressionSpecification,
            },
          });
        }

        if (!map.getLayer('river-flow-line')) {
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
            },
          });
        }

        map.resize();
        updateAllMarkers();
        startFlowAnimation();
      } catch (err) {
        console.error('[MapLibre] Failed to add river overlay:', err);
      }
    };

    const onStyleDataFallback = () => {
      if (!handleLoadRan && map.isStyleLoaded()) {
        handleLoad();
      }
    };

    if (map.isStyleLoaded()) {
      handleLoad();
    } else {
      map.once('load', handleLoad);
      map.on('styledata', onStyleDataFallback);
    }

    // Safety fallback: if MapLibre gets stuck (e.g. offline, tiles slow, etc.)
    // but the canvas context is already there, we still want `handleLoad` to fire
    // eventually because we depend on `styleLoadedRef.current` for gradient updates.
    const fallbackTimeout = window.setTimeout(() => {
      if (!handleLoadRan && !cancelled && mapRef.current === map) {
        try {
          handleLoad();
        } catch {
          /* swallow — source/layer add will throw if style still not parsed */
        }
      }
    }, 6000);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      window.clearTimeout(fallbackTimeout);
      try {
        map.off('styledata', onStyleDataFallback);
      } catch {
        /* no-op */
      }
      stopFlowAnimation();
      Object.values(markersRef.current).forEach((marker) => {
        try {
          marker.remove();
        } catch {
          /* ignore */
        }
      });
      markersRef.current = {};
      try {
        map.remove();
      } catch {
        /* double-remove can throw in some MapLibre builds — ignore */
      }
      if (mapRef.current === map) {
        mapRef.current = null;
        styleLoadedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Update River Gradient when activeReadings or heatMode changes (updates existing layers only)
  useEffect(() => {
    applyRiverGradient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReadings, heatMode]);

  // 3. Animated Cyan Water Flow — controlled by state changes, restarts animation on toggle
  useEffect(() => {
    if (!mapRef.current || !styleLoadedRef.current) return;
    stopFlowAnimation();
    startFlowAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowAnimation, isLowEndDevice, prefersReducedMotion]);

  // 4. Create and Update Custom HTML Sonar Pulse Markers (adds new, updates existing — never remounts map)
  useEffect(() => {
    updateAllMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReadings, heatMode, showLabels, stations, prefersReducedMotion]);

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
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#0B1220]"
      aria-label="Indrayani River monitoring map. Use arrow keys to pan, + / - to zoom, Tab to focus station markers."
    >
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

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
