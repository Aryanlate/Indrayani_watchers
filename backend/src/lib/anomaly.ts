import { WqiInput } from './wqi';
import { Alert, AlertSeverity, AnomalyAlgorithm } from '../types';

export interface AnomalyReport {
  isAnomaly: boolean;
  severity: 'critical' | 'warning' | 'info' | 'none';
  alerts: Alert[];
  triggeredParameters: {
    parameter: string;
    value: number;
    threshold: string;
    description: string;
  }[];
}

export interface ReadingHistoryItem {
  timestamp: string; // ISO
  ph: number;
  dissolvedOxygen: number;
  turbidity: number;
  tds: number;
  conductivity: number;
  temperature: number;
  wqi?: number;
}

const STATION_NAMES: Record<string, string> = {
  S1: 'Dehu (Tukaram Maharaj Ghat)',
  S2: 'Alandi (Sant Dnyaneshwar Samadhi)',
  S3: 'Moshi (Moshi-Alandi Bridge)',
  S4: 'Chikhali (Bhosari MIDC)',
  S5: 'Charholi / Nirgudi',
  S6: 'Downstream Confluence (Tulapur)',
};

// Rolling 24-hour in-memory buffer per station for real-time Z-score and rate-of-change detection
const stationHistoryBuffer = new Map<string, ReadingHistoryItem[]>();

/**
 * Push a reading into the station's rolling history window (pruning items > 24 hours old)
 */
export function recordStationReading(stationId: string, reading: ReadingHistoryItem): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const existing = stationHistoryBuffer.get(stationId) || [];
  const updated = [...existing, reading].filter(
    (r) => new Date(r.timestamp).getTime() >= cutoff
  );
  stationHistoryBuffer.set(stationId, updated);
}

/**
 * Seed historical baseline readings for a station if buffer is empty
 */
function ensureBaselineHistory(stationId: string, current: ReadingHistoryItem): ReadingHistoryItem[] {
  let history = stationHistoryBuffer.get(stationId);
  if (!history || history.length < 5) {
    const seeded: ReadingHistoryItem[] = [];
    const now = Date.now();
    // Generate synthetic 24-hour historical points around current with typical diurnal variance
    for (let i = 24; i >= 1; i--) {
      const ts = new Date(now - i * 60 * 60 * 1000).toISOString();
      const noise = (Math.sin(i / 3) * 0.1);
      seeded.push({
        timestamp: ts,
        ph: Number((current.ph * (1 + noise * 0.05)).toFixed(2)),
        dissolvedOxygen: Number((current.dissolvedOxygen * (1 + noise * 0.1)).toFixed(2)),
        turbidity: Number((current.turbidity * (1 + noise * 0.15)).toFixed(1)),
        tds: Number((current.tds * (1 + noise * 0.08)).toFixed(0)),
        conductivity: Number((current.conductivity * (1 + noise * 0.08)).toFixed(0)),
        temperature: Number((current.temperature * (1 + noise * 0.05)).toFixed(1)),
      });
    }
    seeded.push(current);
    stationHistoryBuffer.set(stationId, seeded);
    return seeded;
  }
  return history;
}

/**
 * 1. Z-Score Anomaly Detection:
 * Flags any reading > 2.5σ from that station's 24-hour rolling mean.
 */
export function detectZScoreAnomalies(
  stationId: string,
  current: ReadingHistoryItem,
  history: ReadingHistoryItem[]
): Alert[] {
  const alerts: Alert[] = [];
  const stationName = STATION_NAMES[stationId] || `Station ${stationId}`;

  if (history.length < 5) return alerts;

  type ParamKey = 'ph' | 'dissolvedOxygen' | 'turbidity' | 'tds' | 'conductivity';
  const paramConfigs: {
    key: ParamKey;
    label: string;
    paramName: string;
    unit: string;
    minStdDev: number;
  }[] = [
    { key: 'ph', label: 'pH', paramName: 'ph', unit: '', minStdDev: 0.15 },
    { key: 'dissolvedOxygen', label: 'Dissolved Oxygen', paramName: 'do', unit: 'mg/L', minStdDev: 0.3 },
    { key: 'turbidity', label: 'Turbidity', paramName: 'turbidity', unit: 'NTU', minStdDev: 2.0 },
    { key: 'tds', label: 'TDS', paramName: 'tds', unit: 'ppm', minStdDev: 15.0 },
    { key: 'conductivity', label: 'Conductivity', paramName: 'conductivity', unit: 'µS/cm', minStdDev: 25.0 },
  ];

  for (const p of paramConfigs) {
    const values = history.map((h) => h[p.key]);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.max(Math.sqrt(variance), p.minStdDev);

    const val = current[p.key];
    const zScore = (val - mean) / stdDev;
    const absZ = Math.abs(zScore);

    // Flag if > 2.5 sigma
    if (absZ >= 2.5) {
      const severity: AlertSeverity = absZ >= 3.5 ? 'critical' : 'warning';
      const expectedMin = Math.max(0, mean - 2 * stdDev);
      const expectedMax = mean + 2 * stdDev;
      const rangeStr = `${expectedMin.toFixed(1)} – ${expectedMax.toFixed(1)} ${p.unit}`.trim();
      const direction = val > mean ? 'abnormally elevated' : 'abnormally suppressed';

      alerts.push({
        id: `zscore-${stationId}-${p.paramName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        stationId,
        stationName,
        severity,
        parameter: p.paramName,
        value: val,
        observedValue: Number(val.toFixed(2)),
        expectedRange: rangeStr,
        algorithm: 'z-score',
        causeHint: `${p.label} is ${direction} at ${val.toFixed(1)} ${p.unit} (${absZ.toFixed(1)}σ deviation from 24h rolling baseline of ${mean.toFixed(1)} ${p.unit}).`,
        message: `Statistical Anomaly: ${p.label} Z-Score ${absZ.toFixed(1)}σ excursion`,
        timestamp: current.timestamp || new Date().toISOString(),
        acknowledged: false,
        resolved: false,
      });
    }
  }

  return alerts;
}

/**
 * 2. Rate-of-Change Detection:
 * Flags turbidity rising >40% or DO falling >25% within 30 minutes.
 * This is the classic signature of an industrial discharge event.
 */
export function detectRateOfChangeAnomalies(
  stationId: string,
  current: ReadingHistoryItem,
  history: ReadingHistoryItem[]
): Alert[] {
  const alerts: Alert[] = [];
  const stationName = STATION_NAMES[stationId] || `Station ${stationId}`;
  const nowMs = new Date(current.timestamp).getTime();

  // Look for previous readings within the 30-minute window (between 5 and 35 mins ago)
  const windowItems = history.filter((h) => {
    const diffMin = (nowMs - new Date(h.timestamp).getTime()) / (1000 * 60);
    return diffMin >= 5 && diffMin <= 35;
  });

  if (windowItems.length === 0) return alerts;

  // Use the closest reading ~20-30 mins ago as baseline
  const baseline = windowItems[0];
  const turbRisePct = baseline.turbidity > 0
    ? ((current.turbidity - baseline.turbidity) / baseline.turbidity) * 100
    : 0;

  const doDropPct = baseline.dissolvedOxygen > 0
    ? ((baseline.dissolvedOxygen - current.dissolvedOxygen) / baseline.dissolvedOxygen) * 100
    : 0;

  const isTurbiditySurge = turbRisePct >= 40 && (current.turbidity - baseline.turbidity) >= 5;
  const isDoCollapse = doDropPct >= 25 && (baseline.dissolvedOxygen - current.dissolvedOxygen) >= 1.0;

  // Combined Industrial Discharge Signature
  if (isTurbiditySurge && isDoCollapse) {
    alerts.push({
      id: `roc-industrial-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: 'critical',
      parameter: 'multi',
      observedValue: Number(current.turbidity.toFixed(1)),
      expectedRange: `Turbidity ≤ ${(baseline.turbidity * 1.15).toFixed(1)} NTU, DO ≥ ${(baseline.dissolvedOxygen * 0.85).toFixed(1)} mg/L`,
      algorithm: 'rate-of-change',
      causeHint: `Sharp turbidity rise (+${turbRisePct.toFixed(0)}%) with acute DO collapse (-${doDropPct.toFixed(0)}%) in 30 minutes — consistent with industrial effluent discharge.`,
      message: `Industrial Effluent Discharge Signature Detected at ${stationName}`,
      timestamp: current.timestamp || new Date().toISOString(),
      acknowledged: false,
      resolved: false,
    });
    return alerts;
  }

  // Single Rate-of-Change Triggers
  if (isTurbiditySurge) {
    alerts.push({
      id: `roc-turbidity-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: turbRisePct >= 75 ? 'critical' : 'warning',
      parameter: 'turbidity',
      observedValue: Number(current.turbidity.toFixed(1)),
      expectedRange: `≤ ${(baseline.turbidity * 1.2).toFixed(1)} NTU (Baseline: ${baseline.turbidity.toFixed(1)} NTU)`,
      algorithm: 'rate-of-change',
      causeHint: `Turbidity surged by ${turbRisePct.toFixed(0)}% within 30 minutes (${baseline.turbidity.toFixed(1)} → ${current.turbidity.toFixed(1)} NTU) — indicates sudden sediment runoff or untreated outfall ingress.`,
      message: `Rapid Turbidity Surge (+${turbRisePct.toFixed(0)}% in 30m)`,
      timestamp: current.timestamp || new Date().toISOString(),
      acknowledged: false,
      resolved: false,
    });
  }

  if (isDoCollapse) {
    alerts.push({
      id: `roc-do-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: 'critical',
      parameter: 'do',
      observedValue: Number(current.dissolvedOxygen.toFixed(2)),
      expectedRange: `≥ ${(baseline.dissolvedOxygen * 0.85).toFixed(1)} mg/L (Baseline: ${baseline.dissolvedOxygen.toFixed(1)} mg/L)`,
      algorithm: 'rate-of-change',
      causeHint: `Dissolved Oxygen plunged by ${doDropPct.toFixed(0)}% within 30 minutes (${baseline.dissolvedOxygen.toFixed(1)} → ${current.dissolvedOxygen.toFixed(1)} mg/L) — severe chemical or biochemical oxygen demand (BOD/COD) influx.`,
      message: `Acute Dissolved Oxygen Depletion (-${doDropPct.toFixed(0)}% in 30m)`,
      timestamp: current.timestamp || new Date().toISOString(),
      acknowledged: false,
      resolved: false,
    });
  }

  return alerts;
}

/**
 * 3. Threshold Detection:
 * Flags any parameter breaching statutory BIS IS 10500:2012 limits.
 */
export function detectThresholdAnomalies(
  stationId: string,
  current: ReadingHistoryItem
): Alert[] {
  const alerts: Alert[] = [];
  const stationName = STATION_NAMES[stationId] || `Station ${stationId}`;
  const ts = current.timestamp || new Date().toISOString();

  // pH: BIS acceptable 6.5 - 8.5
  if (current.ph < 6.5 || current.ph > 8.5) {
    const isCritical = current.ph < 5.0 || current.ph > 9.5;
    alerts.push({
      id: `thresh-ph-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: isCritical ? 'critical' : 'warning',
      parameter: 'ph',
      observedValue: Number(current.ph.toFixed(2)),
      expectedRange: '6.5 – 8.5',
      algorithm: 'threshold',
      causeHint: current.ph < 6.5
        ? `pH of ${current.ph.toFixed(2)} breaches BIS safe minimum (6.5). Acidic chemical runoff risk.`
        : `pH of ${current.ph.toFixed(2)} breaches BIS safe maximum (8.5). Alkaline industrial wash ingress.`,
      message: `BIS IS 10500:2012 Breach: pH out of permissible range (${current.ph.toFixed(2)})`,
      timestamp: ts,
      acknowledged: false,
      resolved: false,
    });
  }

  // Dissolved Oxygen: Statutory minimum 5.0 mg/L (Critical hypoxia < 3.0 mg/L)
  if (current.dissolvedOxygen < 5.0) {
    const isCritical = current.dissolvedOxygen < 3.0;
    alerts.push({
      id: `thresh-do-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: isCritical ? 'critical' : 'warning',
      parameter: 'do',
      observedValue: Number(current.dissolvedOxygen.toFixed(2)),
      expectedRange: '≥ 5.0 mg/L',
      algorithm: 'threshold',
      causeHint: isCritical
        ? `Critical hypoxia (${current.dissolvedOxygen.toFixed(1)} mg/L). Immediate threat of fish mortality and septic conditions.`
        : `Dissolved oxygen is sub-optimal (${current.dissolvedOxygen.toFixed(1)} mg/L), below standard ecological threshold (5.0 mg/L).`,
      message: isCritical
        ? `Critical Hypoxia: DO < 3.0 mg/L (${current.dissolvedOxygen.toFixed(2)} mg/L)`
        : `BIS Ecological Warning: Low DO (${current.dissolvedOxygen.toFixed(2)} mg/L)`,
      timestamp: ts,
      acknowledged: false,
      resolved: false,
    });
  }

  // Turbidity: BIS acceptable 1.0 NTU, permissible 5.0 NTU (Critical > 50 NTU)
  if (current.turbidity > 5.0) {
    const isCritical = current.turbidity > 50.0;
    alerts.push({
      id: `thresh-turbidity-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: isCritical ? 'critical' : 'warning',
      parameter: 'turbidity',
      observedValue: Number(current.turbidity.toFixed(1)),
      expectedRange: '≤ 5.0 NTU',
      algorithm: 'threshold',
      causeHint: `Turbidity of ${current.turbidity.toFixed(1)} NTU violates BIS permissible limit (5.0 NTU). High suspended solids block photosynthesis and carry contaminants.`,
      message: `BIS Standard Exceeded: High Turbidity (${current.turbidity.toFixed(1)} NTU)`,
      timestamp: ts,
      acknowledged: false,
      resolved: false,
    });
  }

  // TDS: BIS acceptable 500 ppm, permissible 2000 ppm
  if (current.tds > 500) {
    const isCritical = current.tds > 2000;
    alerts.push({
      id: `thresh-tds-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: isCritical ? 'critical' : 'warning',
      parameter: 'tds',
      observedValue: Number(current.tds.toFixed(0)),
      expectedRange: '≤ 500 ppm',
      algorithm: 'threshold',
      causeHint: `TDS of ${current.tds.toFixed(0)} ppm exceeds BIS acceptable limit (500 ppm). Elevated dissolved minerals, salts, or industrial wastewater content.`,
      message: `BIS Threshold Breached: Elevated TDS (${current.tds.toFixed(0)} ppm)`,
      timestamp: ts,
      acknowledged: false,
      resolved: false,
    });
  }

  // Conductivity: High threshold > 1000 µS/cm, Critical > 2000 µS/cm
  if (current.conductivity > 1000) {
    const isCritical = current.conductivity > 2000;
    alerts.push({
      id: `thresh-conductivity-${stationId}-${Date.now()}`,
      stationId,
      stationName,
      severity: isCritical ? 'critical' : 'warning',
      parameter: 'conductivity',
      observedValue: Number(current.conductivity.toFixed(0)),
      expectedRange: '≤ 1000 µS/cm',
      algorithm: 'threshold',
      causeHint: `Conductivity of ${current.conductivity.toFixed(0)} µS/cm points to high ionic contamination from untreated industrial or sewage discharge.`,
      message: `Ionic Concentration Warning: High Conductivity (${current.conductivity.toFixed(0)} µS/cm)`,
      timestamp: ts,
      acknowledged: false,
      resolved: false,
    });
  }

  return alerts;
}

/**
 * Master Anomaly Detection Function
 * Combines Z-score (2.5σ), Rate-of-Change (turbidity >40%, DO <-25% in 30m),
 * and BIS IS 10500:2012 Threshold limits.
 */
export function evaluateReadingAnomalies(
  stationId: string,
  input: WqiInput,
  timestamp?: string
): AnomalyReport {
  const currentItem: ReadingHistoryItem = {
    timestamp: timestamp || new Date().toISOString(),
    ph: input.ph,
    dissolvedOxygen: input.dissolvedOxygen,
    turbidity: input.turbidity,
    tds: input.tds ?? Math.round(input.conductivity * 0.64),
    conductivity: input.conductivity,
    temperature: input.temperature,
  };

  // Ensure rolling history exists
  const history = ensureBaselineHistory(stationId, currentItem);
  recordStationReading(stationId, currentItem);

  // Run the 3 detection layers
  const zScoreAlerts = detectZScoreAnomalies(stationId, currentItem, history);
  const rocAlerts = detectRateOfChangeAnomalies(stationId, currentItem, history);
  const thresholdAlerts = detectThresholdAnomalies(stationId, currentItem);

  // Combine and deduplicate alerts
  const allAlerts: Alert[] = [...rocAlerts, ...zScoreAlerts, ...thresholdAlerts];

  const triggeredParameters = allAlerts.map((a) => ({
    parameter: a.parameter || 'Water Quality',
    value: a.observedValue || 0,
    threshold: a.expectedRange || '',
    description: a.causeHint || a.message,
  }));

  const isAnomaly = allAlerts.length > 0;
  let severity: AnomalyReport['severity'] = 'none';

  if (isAnomaly) {
    if (allAlerts.some((a) => a.severity === 'critical')) {
      severity = 'critical';
    } else if (allAlerts.some((a) => a.severity === 'warning')) {
      severity = 'warning';
    } else {
      severity = 'info';
    }
  }

  return {
    isAnomaly,
    severity,
    alerts: allAlerts,
    triggeredParameters,
  };
}

/**
 * Backward-compatible helper for ingest.ts
 */
export function detectAnomalies(input: WqiInput, stationId: string = 'S1'): AnomalyReport {
  return evaluateReadingAnomalies(stationId, input);
}
