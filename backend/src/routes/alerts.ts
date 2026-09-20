import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Alert } from '../types';
import { broadcastSSE } from '../lib/stream';

export const alertsRouter = Router();

const alertsQuerySchema = z.object({
  station: z.string().optional(),
  stationId: z.string().optional(),
  severity: z.enum(['critical', 'warning', 'info', 'all']).optional(),
  algorithm: z.enum(['z-score', 'rate-of-change', 'threshold', 'combined', 'all']).optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().min(1).max(200)),
});

export const SEEDED_ALERTS: Alert[] = [
  {
    id: 'alert-001',
    stationId: 'S4',
    stationName: 'Chikhali (Bhosari MIDC)',
    severity: 'critical',
    parameter: 'multi',
    observedValue: 68.4,
    expectedRange: 'Turbidity ≤ 15.0 NTU, DO ≥ 5.0 mg/L',
    causeHint: 'Sharp turbidity rise (+115%) coupled with acute DO drop (-48%) in 22 minutes — classic signature of untreated industrial chemical effluent dumping.',
    message: 'Industrial Effluent Discharge Signature Detected (High Turbidity + DO Depletion)',
    algorithm: 'rate-of-change',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: 'alert-002',
    stationId: 'S4',
    stationName: 'Chikhali (Bhosari MIDC)',
    severity: 'critical',
    parameter: 'do',
    observedValue: 2.15,
    expectedRange: '≥ 5.0 mg/L (Min statutory)',
    causeHint: 'Severe hypoxia (< 3.0 mg/L). Heavy chemical oxygen demand from industrial outfall actively suffocating benthic ecosystem.',
    message: 'Critical Hypoxia Alert: Dissolved Oxygen collapsed to 2.15 mg/L',
    algorithm: 'threshold',
    timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: 'alert-003',
    stationId: 'S5',
    stationName: 'Charholi / Nirgudi',
    severity: 'warning',
    parameter: 'conductivity',
    observedValue: 1420,
    expectedRange: '480 – 950 µS/cm',
    causeHint: 'Conductivity jumped 3.2σ above 24h rolling baseline. Influx of high-salinity industrial wash water or untreated domestic sewage.',
    message: 'Statistical Anomaly: Conductivity Z-score 3.2σ excursion (1,420 µS/cm)',
    algorithm: 'z-score',
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: 'alert-004',
    stationId: 'S3',
    stationName: 'Moshi (Moshi-Alandi Bridge)',
    severity: 'warning',
    parameter: 'turbidity',
    observedValue: 28.5,
    expectedRange: '≤ 5.0 NTU (BIS Permissible)',
    causeHint: 'Turbidity exceeds statutory BIS limit by 470%. Upstream construction runoff or illegal stone-crushing washings.',
    message: 'BIS IS 10500:2012 Breach: Turbidity (28.5 NTU) exceeds limit',
    algorithm: 'threshold',
    timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    acknowledged: true,
    resolved: false,
  },
  {
    id: 'alert-005',
    stationId: 'S2',
    stationName: 'Alandi (Sant Dnyaneshwar Samadhi)',
    severity: 'info',
    parameter: 'tds',
    observedValue: 265,
    expectedRange: '180 – 240 ppm',
    causeHint: 'Mild TDS elevation (265 ppm) during afternoon pilgrimage mass bathing peak; remains within BIS acceptable limit (500 ppm).',
    message: 'Pilgrimage Bathing Peak: Transient TDS elevation',
    algorithm: 'z-score',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    acknowledged: true,
    resolved: true,
  },
  {
    id: 'alert-006',
    stationId: 'S4',
    stationName: 'Chikhali (Bhosari MIDC)',
    severity: 'warning',
    parameter: 'ph',
    observedValue: 5.72,
    expectedRange: '6.5 – 8.5 (BIS Permissible)',
    causeHint: 'Acidic excursion (pH 5.72) indicating acidic metal pickling rinse discharge from nearby Bhosari electroplating units.',
    message: 'Acidic Outfall Detected: pH dropped to 5.72',
    algorithm: 'threshold',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    acknowledged: true,
    resolved: true,
  },
];

/**
 * GET /api/alerts
 * Filterable by severity, station, algorithm, and limit
 */
alertsRouter.get('/', async (req: Request, res: Response) => {
  const parseResult = alertsQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({
      error: `Invalid query parameters: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
    });
  }

  const { station, stationId, severity, algorithm, limit } = parseResult.data;
  const targetStation = station || stationId;

  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 50);

      if (targetStation) {
        query = query.eq('station_id', targetStation);
      }
      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const formatted: Alert[] = data.map((row) => ({
          id: String(row.id),
          stationId: row.station_id,
          stationName: row.station_name || `Station ${row.station_id}`,
          readingId: row.reading_id,
          severity: row.severity,
          parameter: row.parameter,
          observedValue: row.value || row.observed_value,
          expectedRange: row.expected_range || row.threshold,
          causeHint: row.cause_hint || row.message,
          message: row.message,
          algorithm: row.algorithm || 'threshold',
          timestamp: row.created_at,
          acknowledged: row.acknowledged,
          resolved: row.resolved,
        }));
        return res.status(200).json({ data: formatted });
      }
    } catch (err) {
      console.error('[alerts.ts] Supabase alerts query failed:', err);
    }
  }

  // Filter in-memory seeded alerts
  let filtered = [...SEEDED_ALERTS];
  if (targetStation && targetStation !== 'all') {
    filtered = filtered.filter((a) => a.stationId === targetStation);
  }
  if (severity && severity !== 'all') {
    filtered = filtered.filter((a) => a.severity === severity);
  }
  if (algorithm && algorithm !== 'all') {
    filtered = filtered.filter((a) => a.algorithm === algorithm);
  }

  return res.status(200).json({ data: filtered.slice(0, limit || 50), fallback: true });
});

/**
 * POST /api/alerts/simulate
 * Development / testing endpoint to trigger a simulated critical alert over SSE
 */
alertsRouter.post('/simulate', (req: Request, res: Response) => {
  const stationId = req.body.stationId || 'S4';
  const param = req.body.parameter || 'do';
  const severity: 'critical' | 'warning' | 'info' = req.body.severity || 'critical';

  const newAlert: Alert = {
    id: `alert-sim-${Date.now()}`,
    stationId,
    stationName: stationId === 'S4' ? 'Chikhali (Bhosari MIDC)' : `Station ${stationId}`,
    severity,
    parameter: param,
    observedValue: param === 'do' ? 1.85 : 94.0,
    expectedRange: param === 'do' ? '≥ 5.0 mg/L' : '≤ 5.0 NTU',
    causeHint: param === 'do'
      ? 'Sharp drop in DO (-52%) in 15 mins — toxic reducing agent or raw effluent flush from Bhosari industrial sector.'
      : 'Acute turbidity spike (+140% in 18 mins) — direct illegal sludge or slurry dumping into river.',
    message: param === 'do'
      ? 'CRITICAL DISCHARGE: Severe Hypoxic Effluent Shockwave'
      : 'CRITICAL ALERT: Massive Turbidity Spike Detected',
    algorithm: 'rate-of-change',
    timestamp: new Date().toISOString(),
    acknowledged: false,
    resolved: false,
  };

  // Add to in-memory seeded alerts at the front
  SEEDED_ALERTS.unshift(newAlert);

  // Broadcast live over SSE stream
  broadcastSSE('alert', newAlert);

  return res.status(201).json({
    data: newAlert,
    message: 'Simulated alert broadcasted successfully',
  });
});
