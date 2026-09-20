import { Station, Reading, Alert, Device, NewsItem, WaterReading } from './types';
import { calculateWQI, classifyWQI } from './wqi';

/**
 * =============================================================================
 * SEEDED REAL MONITORING STATIONS
 * (Coordinates are approximate and kept in this single editable array)
 * Order: 1 = Upstream to 6 = Downstream along the Indrayani River
 * =============================================================================
 */
export const STATIONS: Station[] = [
  {
    id: 'S1',
    name: 'Dehu',
    lat: 18.7170,
    lng: 73.7620,
    description: 'Upstream reference, lower anthropogenic load',
    order: 1,
    baselineTds: 121,
  },
  {
    id: 'S2',
    name: 'Alandi Temple Area',
    lat: 18.6770,
    lng: 73.8970,
    description: 'High-footfall pilgrimage site; immersion activity',
    order: 2,
    baselineTds: 223,
  },
  {
    id: 'S3',
    name: 'Moshi',
    lat: 18.6770,
    lng: 73.8450,
    description: 'Urban residential / domestic sewage inflow',
    order: 3,
    baselineTds: 178,
  },
  {
    id: 'S4',
    name: 'Chikhali (Bhosari MIDC)',
    lat: 18.6730,
    lng: 73.8250,
    description: 'Industrial belt; effluent discharge',
    order: 4,
    baselineTds: 156,
  },
  {
    id: 'S5',
    name: 'Charholi / Nirgudi',
    lat: 18.6620,
    lng: 73.8980,
    description: 'Urban stretch downstream of industrial zone',
    order: 5,
    baselineTds: 207,
  },
  {
    id: 'S6',
    name: 'Downstream Confluence',
    lat: 18.6500,
    lng: 73.9200,
    description: 'Reference point after major inflows',
    order: 6,
    baselineTds: 215,
  },
];

/**
 * Base characteristics for the 6 stations
 */
interface StationBaseline {
  ph: number;
  do: number;
  turbidity: number;
  tds: number;
  conductivity: number;
  temperature: number;
}

const STATION_BASELINES: Record<string, StationBaseline> = {
  S1: {
    ph: 7.65,
    do: 7.4,
    turbidity: 4.1,
    tds: 121,
    conductivity: 195,
    temperature: 23.2,
  },
  S2: {
    ph: 7.42,
    do: 5.8,
    turbidity: 9.6,
    tds: 223,
    conductivity: 355,
    temperature: 24.5,
  },
  S3: {
    ph: 7.22,
    do: 4.7,
    turbidity: 16.5,
    tds: 178,
    conductivity: 320,
    temperature: 25.1,
  },
  S4: {
    ph: 6.84,
    do: 3.8,
    turbidity: 24.2,
    tds: 156,
    conductivity: 560,
    temperature: 26.3,
  },
  S5: {
    ph: 6.91,
    do: 3.5,
    turbidity: 27.5,
    tds: 207,
    conductivity: 630,
    temperature: 26.6,
  },
  S6: {
    ph: 7.15,
    do: 4.3,
    turbidity: 21.8,
    tds: 215,
    conductivity: 525,
    temperature: 25.7,
  },
};

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 * Ensures reproducible historical telemetry across server/client renders.
 */
function createPrng(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calculates diurnal variations:
 * - DO peaks mid-afternoon (~15:00) with photosynthesis and dips in early morning (~05:30) from respiration.
 * - Temperature reaches coldest before dawn (~05:30) and highest in afternoon (~14:30).
 */
function getDiurnalDeltas(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60;

  // Temperature phase: Peak at 14:30 (14.5)
  const tempAngle = ((hours - 14.5) * 2 * Math.PI) / 24;
  const tempDelta = Math.cos(tempAngle) * 2.2; // +/- 2.2 °C

  // Dissolved Oxygen phase: Peak at 15:00 (15.0), trough at ~05:00-06:00
  const doAngle = ((hours - 15.0) * 2 * Math.PI) / 24;
  const doDelta = Math.cos(doAngle) * 1.35; // +/- 1.35 mg/L

  return { tempDelta, doDelta };
}

/**
 * Generates 72 hours of historical readings at 15-minute intervals per station.
 * 72 hours * 4 intervals/hour = 288 readings per station.
 * Total = 1,728 readings across 6 stations.
 */
export function generateHistoricalReadings(
  hours: number = 72,
  intervalMinutes: number = 15
): Record<string, Reading[]> {
  const totalReadings = Math.floor((hours * 60) / intervalMinutes);
  const now = Date.now();
  const stationReadings: Record<string, Reading[]> = {};

  STATIONS.forEach((station, stationIndex) => {
    const base = STATION_BASELINES[station.id] || STATION_BASELINES.S1;
    const prng = createPrng(42 + stationIndex * 997);
    const readings: Reading[] = [];

    // Pre-determine anomaly trigger positions for S4 and S5 (roughly every 40 readings)
    // An anomaly plume typically spans 3-4 consecutive readings (45-60 mins)
    const anomalyWindows = new Set<number>();
    if (station.id === 'S4' || station.id === 'S5') {
      const step = 40;
      for (let center = 30; center < totalReadings; center += step) {
        // Random jitter of +/- 5 intervals around step
        const jitter = Math.floor(prng() * 11) - 5;
        const trigger = Math.max(5, Math.min(totalReadings - 5, center + jitter));
        anomalyWindows.add(trigger);
        anomalyWindows.add(trigger + 1);
        anomalyWindows.add(trigger + 2);
      }
    }

    for (let i = totalReadings - 1; i >= 0; i--) {
      const timestampMs = now - i * intervalMinutes * 60 * 1000;
      const date = new Date(timestampMs);
      const { tempDelta, doDelta } = getDiurnalDeltas(date);

      // Noise factor +/- 3%
      const noise = () => (prng() * 2 - 1) * 0.03;

      let ph = base.ph * (1 + noise() * 0.5);
      let dOxygen = Math.max(0.8, (base.do + doDelta) * (1 + noise()));
      let turbidity = Math.max(1.0, base.turbidity * (1 + noise() * 1.5));
      let tds = Math.max(50, base.tds * (1 + noise()));
      let conductivity = Math.max(80, base.conductivity * (1 + noise()));
      let temperature = Math.max(16.0, (base.temperature + tempDelta) * (1 + noise() * 0.4));

      // Industrial discharge anomaly event injection
      const readingIndex = totalReadings - 1 - i;
      if (anomalyWindows.has(readingIndex)) {
        // Turbidity spikes dramatically (industrial particulate / silt wash)
        turbidity += 55 + prng() * 45;
        // DO plummets (chemical oxygen demand & organic load)
        dOxygen = Math.max(0.9, dOxygen - (2.2 + prng() * 1.0));
        // Conductivity & TDS surge from chemical electrolytes
        tds += 120 + prng() * 90;
        conductivity += 450 + prng() * 350;
        // Effluent shifts pH acidic
        ph -= 0.6 + prng() * 0.4;
      }

      // Format decimals
      ph = Math.round(ph * 100) / 100;
      dOxygen = Math.round(dOxygen * 10) / 10;
      turbidity = Math.round(turbidity * 10) / 10;
      tds = Math.round(tds);
      conductivity = Math.round(conductivity);
      temperature = Math.round(temperature * 10) / 10;

      const wqi = calculateWQI({
        ph,
        do: dOxygen,
        turbidity,
        tds,
        temperature,
      });

      const status = classifyWQI(wqi);

      readings.push({
        stationId: station.id,
        timestamp: date.toISOString(),
        ph,
        do: dOxygen,
        turbidity,
        tds,
        conductivity,
        temperature,
        wqi,
        status,
      });
    }

    stationReadings[station.id] = readings;
  });

  return stationReadings;
}

/**
 * In-memory cache of historical readings for fast synchronous lookup
 */
export const HISTORICAL_READINGS = generateHistoricalReadings(72, 15);

/**
 * Fetch history for a specific station
 */
export function getStationHistory(stationId: string, hours: number = 72): Reading[] {
  const stationData = HISTORICAL_READINGS[stationId] || [];
  if (hours >= 72) return stationData;
  const count = Math.floor((hours * 60) / 15);
  return stationData.slice(-count);
}

/**
 * Live station internal state tracking for smooth, realistic continuous polling
 */
interface LiveState {
  ph: number;
  do: number;
  turbidity: number;
  tds: number;
  conductivity: number;
  temperature: number;
  tickCount: number;
  anomalyTicksRemaining: number;
}

const liveStateStore: Record<string, LiveState> = {};

function initLiveState(stationId: string): LiveState {
  const base = STATION_BASELINES[stationId] || STATION_BASELINES.S1;
  const now = new Date();
  const { tempDelta, doDelta } = getDiurnalDeltas(now);

  return {
    ph: base.ph,
    do: Math.max(1.0, base.do + doDelta),
    turbidity: base.turbidity,
    tds: base.tds,
    conductivity: base.conductivity,
    temperature: base.temperature + tempDelta,
    tickCount: Math.floor(Math.random() * 30),
    anomalyTicksRemaining: 0,
  };
}

/**
 * Exposes getLiveReading(stationId):
 * Returns a fresh reading each call, drifting around baseline with ±3% noise,
 * diurnal cycle, and periodic anomaly events on S4 or S5.
 * Ideal for UI polling every 3 seconds.
 */
export function getLiveReading(stationId: string): Reading {
  const station = STATIONS.find((s) => s.id === stationId) || STATIONS[0];
  const base = STATION_BASELINES[station.id] || STATION_BASELINES.S1;

  if (!liveStateStore[station.id]) {
    liveStateStore[station.id] = initLiveState(station.id);
  }

  const state = liveStateStore[station.id];
  state.tickCount += 1;

  const now = new Date();
  const { tempDelta, doDelta } = getDiurnalDeltas(now);

  // Random micro-drift noise +/- 3%
  const noise = () => (Math.random() * 2 - 1) * 0.03;

  // Check for anomaly trigger at S4 or S5 roughly every 40 calls
  if (
    (station.id === 'S4' || station.id === 'S5') &&
    state.anomalyTicksRemaining <= 0 &&
    state.tickCount % 40 === 0
  ) {
    // Inject anomaly that lasts for 8-12 ticks (approx 24-36 seconds of 3s polling)
    state.anomalyTicksRemaining = 8 + Math.floor(Math.random() * 5);
  }

  const isAnomaly = state.anomalyTicksRemaining > 0;
  if (isAnomaly) {
    state.anomalyTicksRemaining -= 1;
  }

  // Base diurnal targets
  const targetTemp = base.temperature + tempDelta;
  const targetDO = Math.max(0.8, base.do + doDelta);

  // Drift towards diurnal target with small random noise
  let ph = base.ph + (state.ph - base.ph) * 0.8 + noise() * 0.05;
  let dOxygen = targetDO + (state.do - targetDO) * 0.8 + noise() * 0.15;
  let turbidity = base.turbidity + (state.turbidity - base.turbidity) * 0.8 + noise() * 0.6;
  let tds = base.tds + (state.tds - base.tds) * 0.8 + noise() * 4.0;
  let conductivity = base.conductivity + (state.conductivity - base.conductivity) * 0.8 + noise() * 8.0;
  let temperature = targetTemp + (state.temperature - targetTemp) * 0.8 + noise() * 0.1;

  if (isAnomaly) {
    // Turbidity spike + DO drop simulating industrial effluent discharge
    turbidity += 60 + Math.random() * 40;
    dOxygen = Math.max(1.0, dOxygen - (2.4 + Math.random() * 0.8));
    tds += 110 + Math.random() * 80;
    conductivity += 450 + Math.random() * 300;
    ph -= 0.7 + Math.random() * 0.3;
  }

  // Bound within reasonable physical limits
  ph = Math.max(4.0, Math.min(10.5, Math.round(ph * 100) / 100));
  dOxygen = Math.max(0.5, Math.min(14.0, Math.round(dOxygen * 10) / 10));
  turbidity = Math.max(0.5, Math.round(turbidity * 10) / 10);
  tds = Math.max(20, Math.round(tds));
  conductivity = Math.max(50, Math.round(conductivity));
  temperature = Math.max(12.0, Math.min(38.0, Math.round(temperature * 10) / 10));

  // Save current state for smooth next tick
  state.ph = ph;
  state.do = dOxygen;
  state.turbidity = turbidity;
  state.tds = tds;
  state.conductivity = conductivity;
  state.temperature = temperature;

  const wqi = calculateWQI({
    ph,
    do: dOxygen,
    turbidity,
    tds,
    temperature,
  });

  const status = classifyWQI(wqi);

  return {
    stationId: station.id,
    timestamp: now.toISOString(),
    ph,
    do: dOxygen,
    turbidity,
    tds,
    conductivity,
    temperature,
    wqi,
    status,
  };
}

/**
 * Returns latest live reading for all 6 stations
 */
export function getAllLiveReadings(): Record<string, Reading> {
  const readings: Record<string, Reading> = {};
  for (const station of STATIONS) {
    readings[station.id] = getLiveReading(station.id);
  }
  return readings;
}

/**
 * Helper to get station by ID
 */
export function getStationById(stationId: string): Station | undefined {
  return STATIONS.find((s) => s.id === stationId);
}

// =============================================================================
// Backward compatibility exports for legacy UI components
// =============================================================================

export const mockStations: Device[] = STATIONS.map((s) => ({
  id: s.id,
  stationName: s.name,
  location: {
    lat: s.lat,
    lng: s.lng,
    description: s.description,
  },
  status: 'online',
  lastSeen: new Date().toISOString(),
  batteryLevel: 95,
  firmwareVersion: '1.2.0',
}));

export const mockReadings: WaterReading[] = STATIONS.map((s) => {
  const r = getLiveReading(s.id);
  return {
    id: `read-${s.id}`,
    stationId: s.id,
    stationName: s.name,
    timestamp: r.timestamp,
    ph: r.ph,
    dissolvedOxygen: r.do,
    turbidity: r.turbidity,
    temperature: r.temperature,
    conductivity: r.conductivity,
    wqi: r.wqi,
    status: r.status === 'good' ? 'Good' : r.status === 'moderate' ? 'Moderate' : r.status === 'poor' ? 'Poor' : 'Very Poor',
  };
});

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    stationId: 'S4',
    stationName: 'Chikhali (Bhosari MIDC)',
    severity: 'critical',
    message: 'Dissolved Oxygen dropped below 3.0 mg/L threshold (Critical Hypoxia)',
    parameter: 'dissolvedOxygen',
    value: 2.2,
    threshold: 3.0,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    resolved: false,
  },
  {
    id: 'alert-002',
    stationId: 'S5',
    stationName: 'Charholi / Nirgudi',
    severity: 'warning',
    message: 'Elevated turbidity (78 NTU) indicating industrial effluent discharge',
    parameter: 'turbidity',
    value: 78.0,
    threshold: 25.0,
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    resolved: false,
  },
];

export const mockNews: NewsItem[] = [
  {
    id: 'news-001',
    title: 'PCMC & MPCB Conduct Joint River Inspection at Moshi & Chakan',
    summary: 'Officials inspected industrial effluents flowing into the Indrayani river following alerts raised by citizens and environmental sensors.',
    source: 'Pune Environmental Bureau',
    url: 'https://example.com/news/1',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    category: 'government',
    relatedStations: ['S3', 'S4'],
  },
  {
    id: 'news-002',
    title: 'Community Ghat Clean-up Drive Organised at Alandi Pilgrimage Site',
    summary: 'Over 200 volunteers gathered on Sunday to remove plastic waste and debris from the riverbanks before the upcoming festive pilgrimage.',
    source: 'Indrayani Swachh Abhiyan',
    url: 'https://example.com/news/2',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    category: 'local',
    relatedStations: ['S2'],
  },
];
