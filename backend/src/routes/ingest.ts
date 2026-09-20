import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { calculateWqi } from '../lib/wqi';
import { detectAnomalies } from '../lib/anomaly';
import { broadcastSSE } from '../lib/stream';
import { authenticateDevice, updateDeviceLastSeen } from '../lib/devices';

export const ingestRouter = Router();

// Zod schema for individual telemetry readings (strict range checking)
const rawReadingItemSchema = z.object({
  device_id: z.string().optional(),
  deviceId: z.string().optional(),
  station_id: z.string().optional(),
  stationId: z.string().optional(),
  api_key: z.string().optional(),
  apiKey: z.string().optional(),
  timestamp: z.string().optional(),
  ph: z
    .number({ required_error: 'pH value is required' })
    .min(0, 'pH cannot be less than 0')
    .max(14, 'pH cannot exceed 14 (impossible chemical value)'),
  do: z.number().min(0, 'Dissolved oxygen cannot be negative').optional(),
  dissolvedOxygen: z.number().min(0, 'Dissolved oxygen cannot be negative').optional(),
  turbidity: z
    .number({ required_error: 'Turbidity value is required' })
    .min(0, 'Turbidity cannot be negative (impossible optical value)'),
  tds: z.number().min(0, 'TDS cannot be negative').optional(),
  conductivity: z
    .number({ required_error: 'Conductivity value is required' })
    .min(0, 'Conductivity cannot be negative'),
  temperature: z
    .number({ required_error: 'Temperature value is required' })
    .min(-10, 'Temperature cannot be below -10°C')
    .max(70, 'Temperature cannot exceed 70°C'),
});

// Normalized internal reading format
interface NormalizedReading {
  deviceId: string;
  stationId: string;
  apiKey?: string;
  timestamp: string;
  ph: number;
  do: number;
  turbidity: number;
  tds: number;
  conductivity: number;
  temperature: number;
}

/**
 * POST /api/ingest
 * Accepts either:
 * 1. Single reading: { "device_id": "ESP32-S4", "station_id": "S4", "api_key": "...", ... }
 * 2. Batch object: { "device_id": "ESP32-S4", "api_key": "...", "readings": [ ... ] }
 * 3. Batch array: [ { ... }, { ... } ]
 */
ingestRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body;

  let rawList: unknown[] = [];
  let rootDeviceId: string | undefined = undefined;
  let rootStationId: string | undefined = undefined;
  let rootApiKey: string | undefined =
    (req.headers['x-api-key'] as string) || undefined;

  if (Array.isArray(body)) {
    rawList = body;
  } else if (body && typeof body === 'object') {
    if (Array.isArray(body.readings)) {
      rawList = body.readings;
      rootDeviceId = body.device_id || body.deviceId;
      rootStationId = body.station_id || body.stationId;
      rootApiKey = body.api_key || body.apiKey || rootApiKey;
    } else {
      // Single reading object
      rawList = [body];
    }
  }

  if (rawList.length === 0) {
    return res.status(400).json({ error: 'Payload must contain at least one reading.' });
  }

  // Parse and validate all readings in batch
  const normalizedList: NormalizedReading[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const parseResult = rawReadingItemSchema.safeParse(item);

    if (!parseResult.success) {
      return res.status(400).json({
        error: `Validation failed on reading #${i + 1}: ${parseResult.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      });
    }

    const data = parseResult.data;
    const devId = data.device_id || data.deviceId || rootDeviceId;

    if (!devId) {
      return res.status(400).json({
        error: `Missing device identifier on reading #${i + 1}. device_id is required.`,
      });
    }

    const stId = data.station_id || data.stationId || rootStationId || devId.replace(/^ESP32-/i, '');
    const apiKey = data.api_key || data.apiKey || rootApiKey;
    const dissolvedOxygen = data.do ?? data.dissolvedOxygen ?? 6.0;
    const tds = data.tds ?? Math.round(data.conductivity * 0.64);
    const recordedAt = data.timestamp || new Date().toISOString();

    normalizedList.push({
      deviceId: devId,
      stationId: stId.toUpperCase(),
      apiKey,
      timestamp: recordedAt,
      ph: data.ph,
      do: dissolvedOxygen,
      turbidity: data.turbidity,
      tds,
      conductivity: data.conductivity,
      temperature: data.temperature,
    });
  }

  // Authenticate primary device credentials
  const primaryDev = normalizedList[0];
  const auth = await authenticateDevice(primaryDev.deviceId, primaryDev.apiKey);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error || 'Device authentication failed.' });
  }

  // Overwrite stationId if device has specific registered station mapping
  if (auth.stationId) {
    for (const r of normalizedList) {
      r.stationId = auth.stationId;
    }
  }

  // Handle out-of-order timestamps from SD card buffering:
  // Sort chronologically ascending so historical rolling windows progress correctly
  normalizedList.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const processedResults: unknown[] = [];
  const triggeredAlerts: unknown[] = [];
  let latestProcessedReading: Record<string, unknown> | null = null;

  for (const reading of normalizedList) {
    // 1. Calculate WQI using server-side weighted-sum algorithm
    const wqiResult = calculateWqi({
      ph: reading.ph,
      dissolvedOxygen: reading.do,
      turbidity: reading.turbidity,
      temperature: reading.temperature,
      conductivity: reading.conductivity,
      tds: reading.tds,
    });

    let status: 'good' | 'moderate' | 'poor' | 'very-poor' = 'good';
    if (wqiResult.score >= 80) status = 'good';
    else if (wqiResult.score >= 60) status = 'moderate';
    else if (wqiResult.score >= 40) status = 'poor';
    else status = 'very-poor';

    // 2. Run 3-layer anomaly detection (Z-score, rate-of-change, BIS limits)
    const anomalyReport = detectAnomalies(
      {
        ph: reading.ph,
        dissolvedOxygen: reading.do,
        turbidity: reading.turbidity,
        temperature: reading.temperature,
        conductivity: reading.conductivity,
        tds: reading.tds,
      },
      reading.stationId
    );

    let readingDbId: number | null = null;

    // 3. Insert reading into Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { data: readingRow, error: insertError } = await supabase
          .from('readings')
          .insert({
            station_id: reading.stationId,
            recorded_at: reading.timestamp,
            ph: reading.ph,
            do: reading.do,
            turbidity: reading.turbidity,
            tds: reading.tds,
            conductivity: reading.conductivity,
            temperature: reading.temperature,
            wqi: wqiResult.score,
            status,
            device_id: reading.deviceId,
          })
          .select()
          .single();

        if (!insertError && readingRow) {
          readingDbId = readingRow.id;
        }

        // Insert alerts into alerts table
        if (anomalyReport.isAnomaly && anomalyReport.alerts) {
          for (const alert of anomalyReport.alerts) {
            await supabase.from('alerts').insert({
              station_id: reading.stationId,
              reading_id: readingDbId,
              severity: alert.severity,
              parameter: alert.parameter || 'water_quality',
              message: alert.message,
              created_at: reading.timestamp,
              acknowledged: false,
            });
          }
        }
      } catch (err) {
        console.error('[ingest.ts] Database transaction error:', err);
      }
    }

    // 4. Format reading payload
    const formattedReading = {
      id: readingDbId || Date.now(),
      stationId: reading.stationId,
      timestamp: reading.timestamp,
      ph: reading.ph,
      do: reading.do,
      turbidity: reading.turbidity,
      tds: reading.tds,
      conductivity: reading.conductivity,
      temperature: reading.temperature,
      wqi: wqiResult.score,
      status,
      deviceId: reading.deviceId,
    };

    latestProcessedReading = formattedReading;
    processedResults.push({
      timestamp: reading.timestamp,
      wqi: wqiResult.score,
      status,
      isAnomaly: anomalyReport.isAnomaly,
    });

    if (anomalyReport.alerts && anomalyReport.alerts.length > 0) {
      triggeredAlerts.push(...anomalyReport.alerts);
    }
  }

  // 5. Update devices.last_seen_at timestamp to latest reading's timestamp
  const latestTs = normalizedList[normalizedList.length - 1].timestamp;
  await updateDeviceLastSeen(primaryDev.deviceId, latestTs);

  // 6. Broadcast latest reading and alerts to all connected frontend clients over SSE
  if (latestProcessedReading) {
    broadcastSSE('reading', latestProcessedReading);
  }

  for (const alert of triggeredAlerts) {
    broadcastSSE('alert', alert);
  }

  return res.status(201).json({
    data: {
      message: `Ingestion completed successfully (${normalizedList.length} reading${normalizedList.length > 1 ? 's' : ''} processed).`,
      count: normalizedList.length,
      stationId: primaryDev.stationId,
      deviceId: primaryDev.deviceId,
      latestWqi: latestProcessedReading?.wqi,
      latestStatus: latestProcessedReading?.status,
      alertsTriggered: triggeredAlerts.length,
      processed: processedResults,
      alerts: triggeredAlerts,
    },
  });
});
