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

    const duration = 1500;
    const startTime = performance.now();
    let frameCounter = 0;

    stopFlowAnimation();

    if (isLowEndDeviceRef.current) {
      intervalRef.current = setInterval(() => {
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
        if (frameCounter % 2 === 0 && isLowEndDeviceRef.current) {
          animationFrameRef.current = requestAnimationFrame(animateDash);
          return;
        }

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
  }

  // 1. Initialize MapLibre GL Map once on mount (empty deps — Strict-Mode safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    let handleLoadRan = false;

    // DIAGNOSTIC CHECK 1: CONTAINER & PARENTS HIERARCHY
    const containerEl = mapContainerRef.current;
    const rect = containerEl.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(containerEl);

    // Walk up DOM parents
    const parentHierarchy: Array<{ tag: string; id: string; className: string; rect: DOMRect; computedHeight: string; computedWidth: string }> = [];
    let curr: HTMLElement | null = containerEl.parentElement;
    while (curr && curr !== document.body) {
      const pRect = curr.getBoundingClientRect();
      const pStyle = window.getComputedStyle(curr);
      parentHierarchy.push({
        tag: curr.tagName.toLowerCase(),
        id: curr.id || '',
        className: curr.className || '',
        rect: pRect,
        computedHeight: pStyle.height,
        computedWidth: pStyle.width,
      });
      curr = curr.parentElement;
    }

    const diagnostics: {
      containerRect: { width: number; height: number; top: number; left: number };
      containerComputed: { width: string; height: string; display: string };
      parentHierarchy: typeof parentHierarchy;
      errors: any[];
      sourcedataEvents: any[];
      styledataEvents: any[];
      loadFired: boolean;
      canvasInfo: any;
      resources: any[];
    } = {
      containerRect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
      containerComputed: { width: computedStyle.width, height: computedStyle.height, display: computedStyle.display },
      parentHierarchy,
      errors: [],
      sourcedataEvents: [],
      styledataEvents: [],
      loadFired: false,
      canvasInfo: null,
      resources: [],
    };
    (window as any).__MAP_DIAGNOSTICS__ = diagnostics;

    console.log('[DEBUG-MAP] 1. Container rect:', diagnostics.containerRect);
    console.log('[DEBUG-MAP] 1. Container computed:', diagnostics.containerComputed);
    console.log('[DEBUG-MAP] 1. Parent hierarchy:', diagnostics.parentHierarchy);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [73.850, 18.680],
      zoom: 11.2,
      minZoom: 9,
      maxZoom: 17,
      pitch: 15,
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('[DEBUG-MAP] Unhandled rejection:', e.reason);
      diagnostics.errors.push({ type: 'unhandledrejection', reason: String(e.reason?.stack || e.reason) });
    });
    window.addEventListener('error', (e) => {
      console.error('[DEBUG-MAP] Window error:', e.error || e.message);
      diagnostics.errors.push({ type: 'window_error', message: e.message, error: String(e.error?.stack || e.error) });
    });

    map.on('sourcedata', (e) => {
      const entry = {
        sourceId: e.sourceId,
        isSourceLoaded: e.isSourceLoaded,
        dataType: e.dataType,
        sourceDataType: (e as any).sourceDataType,
      };
      diagnostics.sourcedataEvents.push(entry);
      console.log('[DEBUG-MAP] 2. sourcedata:', entry);
    });

    map.on('error', (e) => {
      const errDetail = {
        message: e.error?.message || (e as any).message || String(e.error || e),
        status: (e.error as any)?.status,
        url: (e.error as any)?.url,
        stack: e.error?.stack,
      };
      diagnostics.errors.push(errDetail);
      console.error('[DEBUG-MAP] 2. error event:', errDetail);
    });

    const dumpDiagnostics = () => {
      const el = document.getElementById('debug-map-pre');
      if (el) {
        try {
          const style = map.getStyle();
          const resources = performance.getEntriesByType('resource')
            .filter(r => r.name.includes('openfreemap') || r.name.includes('liberty') || r.name.includes('pbf') || r.name.includes('planet'))
            .map(r => ({ name: r.name, status: (r as any).responseStatus, duration: Math.round(r.duration), transferSize: r.transferSize }));

          const omt = map.getSource('openmaptiles') as any;
          const openmaptilesDetails = omt ? {
            _loaded: omt._loaded,
            tiles: omt.tiles,
            minzoom: omt.minzoom,
            maxzoom: omt.maxzoom,
            hasTileJSONRequest: Boolean(omt._tileJSONRequest),
            loadedFn: typeof omt.loaded === 'function' ? omt.loaded() : undefined,
            type: omt.type,
          } : null;

          const styleInternal = (map as any).style;
          const omtTileManager = styleInternal?.tileManagers ? styleInternal.tileManagers['openmaptiles'] : null;
          const omtTmFields = omtTileManager ? {
            _sourceLoaded: omtTileManager._sourceLoaded,
            _sourceErrored: omtTileManager._sourceErrored,
            _updated: omtTileManager._updated,
            _paused: omtTileManager._paused,
            used: omtTileManager.used,
            usedForTerrain: omtTileManager.usedForTerrain,
            tilesCount: omtTileManager._inViewTiles?.getAllTiles?.()?.length,
            tiles: omtTileManager._inViewTiles?.getAllTiles?.()?.map((t: any) => ({ id: t.tileID?.key, state: t.state })),
            hasTransform: Boolean(omtTileManager.transform),
            transformWidth: omtTileManager.transform?.width,
            transformHeight: omtTileManager.transform?.height,
          } : null;
          const tileManagersLoaded: Record<string, boolean> = {};
          if (styleInternal?.tileManagers) {
            for (const id in styleInternal.tileManagers) {
              tileManagersLoaded[id] = typeof styleInternal.tileManagers[id]?.loaded === 'function'
                ? styleInternal.tileManagers[id].loaded()
                : false;
            }
          }

          const debugCheck = {
            style_loaded: styleInternal?._loaded,
            updatedSources: styleInternal?._updatedSources ? Object.keys(styleInternal._updatedSources) : null,
            tileManagersLoaded,
            imageManagerLoaded: styleInternal?.imageManager?.isLoaded ? styleInternal.imageManager.isLoaded() : null,
            transformWidth: (map as any).transform?.width,
            transformHeight: (map as any).transform?.height,
            zoom: map.getZoom(),
            center: map.getCenter(),
          };

          el.textContent = JSON.stringify({
            debugCheck,
            omtTmFields,
            containerRect: diagnostics.containerRect,
            containerComputed: diagnostics.containerComputed,
            parentHierarchy: diagnostics.parentHierarchy,
            isStyleLoaded: map.isStyleLoaded(),
            mapLoaded: map.loaded(),
            style_loaded_internal: (map as any).style?._loaded,
            styleSources: style ? Object.keys(style.sources) : null,
            openmaptilesDetails,
            openmaptilesSource: style?.sources ? (style.sources as any)['openmaptiles'] : null,
            sourcedataCount: diagnostics.sourcedataEvents.length,
            sourcedataLast5: diagnostics.sourcedataEvents.slice(-5),
            errors: diagnostics.errors,
            canvas: map.getCanvas() ? {
              width: map.getCanvas().width,
              height: map.getCanvas().height,
              styleWidth: map.getCanvas().style.width,
              styleHeight: map.getCanvas().style.height,
              clientWidth: map.getCanvas().clientWidth,
              clientHeight: map.getCanvas().clientHeight,
            } : null,
            resources,
          }, null, 2);
        } catch (e: any) {
          el.textContent = 'Error dumping diagnostics: ' + e.message;
        }
      }
    };

    const diagInterval = setInterval(dumpDiagnostics, 500);

    map.on('load', () => {
      diagnostics.loadFired = true;
      console.log('[DEBUG-MAP] load event fired! map.isStyleLoaded():', map.isStyleLoaded());
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const handleLoad = () => {
      if (cancelled || handleLoadRan) return;
      handleLoadRan = true;
      styleLoadedRef.current = true;

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
            'line-gradient': buildLineGradientExpression() as unknown as maplibregl.ExpressionSpecification,
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
            'line-gradient': buildLineGradientExpression() as unknown as maplibregl.ExpressionSpecification,
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
            'line-dasharray': [0, 4, 3],
          },
        });
      }

      updateAllMarkers();
      startFlowAnimation();
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
      clearInterval(diagInterval);
      window.clearTimeout(fallbackTimeout);
      try {
        map.off('styledata', onStyleDataFallback);
      } catch {
        /* no-op */
      }
      stopFlowAnimation();
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
      className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-[#0B1220]"
      aria-label="Indrayani River monitoring map. Use arrow keys to pan, + / - to zoom, Tab to focus station markers."
    >
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />
      <pre id="debug-map-pre" className="hidden" />

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
