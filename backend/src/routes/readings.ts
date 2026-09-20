import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getStationLiveness } from '../lib/devices';

export const readingsRouter = Router();

// Validation schema for /api/readings query params
const readingsQuerySchema = z.object({
  station: z.string().optional(),
  stationId: z.string().optional(), // alias
  hours: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 24))
    .pipe(z.number().positive().max(168)), // up to 7 days
});

interface CachedEntry<T> {
  data: T;
  cachedAt: number;
}

// In-memory cache for 3–5 seconds
const CACHE_TTL_MS = 4000;
const memoryCache = new Map<string, CachedEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CachedEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T): void {
  memoryCache.set(key, { data, cachedAt: Date.now() });
}

// Seeded fallback readings for when database is newly initialized or offline
const SEEDED_STATION_BASELINES: Record<
  string,
  { name: string; ph: number; do: number; turbidity: number; tds: number; conductivity: number; temp: number; wqi: number; status: string }
> = {
  S1: { name: 'Dehu', ph: 7.65, do: 7.4, turbidity: 4.1, tds: 121, conductivity: 195, temp: 23.2, wqi: 85, status: 'good' },
  S2: { name: 'Alandi Temple Area', ph: 7.42, do: 5.8, turbidity: 9.6, tds: 223, conductivity: 355, temp: 24.5, wqi: 72, status: 'moderate' },
  S3: { name: 'Moshi', ph: 7.22, do: 4.7, turbidity: 16.5, tds: 178, conductivity: 320, temp: 25.1, wqi: 58, status: 'poor' },
  S4: { name: 'Chikhali (Bhosari MIDC)', ph: 6.84, do: 3.8, turbidity: 24.2, tds: 156, conductivity: 560, temp: 26.3, wqi: 48, status: 'poor' },
  S5: { name: 'Charholi / Nirgudi', ph: 6.91, do: 3.5, turbidity: 27.5, tds: 207, conductivity: 630, temp: 26.6, wqi: 45, status: 'poor' },
  S6: { name: 'Downstream Confluence', ph: 7.15, do: 4.3, turbidity: 21.8, tds: 215, conductivity: 525, temp: 25.7, wqi: 54, status: 'poor' },
};

function formatDbReading(row: Record<string, unknown>) {
  return {
    id: row.id,
    stationId: row.station_id,
    timestamp: row.recorded_at,
    ph: Number(row.ph),
    do: Number(row.do),
    turbidity: Number(row.turbidity),
    tds: Number(row.tds),
    conductivity: Number(row.conductivity),
    temperature: Number(row.temperature),
    wqi: Number(row.wqi),
    status: row.status,
    deviceId: row.device_id,
  };
}

/**
 * GET /api/readings
 * - If ?station=S4&hours=24: returns historical readings for that station
 * - Else: returns latest reading for each of the 6 stations
 * - Applies DATA_SOURCE ('mock' | 'live') check: in live mode, marks station 'offline' if > 10m inactive
 */
readingsRouter.get('/', async (req: Request, res: Response) => {
  const parseResult = readingsQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({
      error: `Invalid query parameters: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
    });
  }

  const { station, stationId, hours } = parseResult.data;
  const targetStation = station || stationId;
  const dataSource = (process.env.DATA_SOURCE || 'mock').toLowerCase();

  // History Query for a single station
  if (targetStation) {
    const cacheKey = `history:${targetStation}:${hours}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({ data: cached, cached: true, dataSource });
    }

    if (isSupabaseConfigured()) {
      try {
        const since = new Date(Date.now() - (hours || 24) * 3600 * 1000).toISOString();
        const { data, error } = await supabase
          .from('readings')
          .select('*')
          .eq('station_id', targetStation)
          .gte('recorded_at', since)
          .order('recorded_at', { ascending: true })
          .limit(1000);

        if (!error && data && data.length > 0) {
          const formatted = data.map(formatDbReading);
          setCached(cacheKey, formatted);
          return res.status(200).json({ data: formatted, dataSource });
        }
      } catch (err) {
        console.error(`[readings.ts] Supabase history query failed for ${targetStation}:`, err);
      }
    }

    // Fallback generated history if database is empty or offline
    const base = SEEDED_STATION_BASELINES[targetStation] || SEEDED_STATION_BASELINES.S1;
    const count = Math.min(288, Math.floor(((hours || 24) * 60) / 15));
    const now = Date.now();
    const fallbackHistory = [];

    for (let i = count - 1; i >= 0; i--) {
      const timeMs = now - i * 15 * 60 * 1000;
      const noise = (Math.sin(timeMs / 3600000) * 0.05);
      fallbackHistory.push({
        stationId: targetStation,
        timestamp: new Date(timeMs).toISOString(),
        ph: Math.round((base.ph + noise) * 100) / 100,
        do: Math.round((base.do + noise * 1.5) * 10) / 10,
        turbidity: Math.round((base.turbidity + noise * 3.0) * 10) / 10,
        tds: Math.round(base.tds * (1 + noise)),
        conductivity: Math.round(base.conductivity * (1 + noise)),
        temperature: Math.round((base.temp + noise * 1.2) * 10) / 10,
        wqi: base.wqi,
        status: base.status,
      });
    }

    setCached(cacheKey, fallbackHistory);
    return res.status(200).json({ data: fallbackHistory, fallback: true, dataSource });
  }

  // Latest readings for all stations
  const cacheKey = `latest:all:${dataSource}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.status(200).json({ data: cached, cached: true, dataSource });
  }

  const stationIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const latestResults: Record<string, Record<string, unknown>> = {};

  if (isSupabaseConfigured()) {
    try {
      // Query recent readings
      const { data, error } = await supabase
        .from('readings')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        for (const row of data) {
          const sid = row.station_id as string;
          if (stationIds.includes(sid) && !latestResults[sid]) {
            latestResults[sid] = formatDbReading(row);
          }
        }
      }
    } catch (err) {
      console.error('[readings.ts] Supabase latest readings query error:', err);
    }
  }

  // Fill in any station missing in DB with seeded baseline
  for (const sid of stationIds) {
    if (!latestResults[sid]) {
      const b = SEEDED_STATION_BASELINES[sid];
      latestResults[sid] = {
        stationId: sid,
        timestamp: new Date().toISOString(),
        ph: b.ph,
        do: b.do,
        turbidity: b.turbidity,
        tds: b.tds,
        conductivity: b.conductivity,
        temperature: b.temp,
        wqi: b.wqi,
        status: b.status,
        fallback: true,
      };
    }

    // Apply Liveness check if in live data mode
    const liveness = await getStationLiveness(sid);
    if (dataSource === 'live') {
      if (!liveness.isOnline) {
        // Mark station offline if inactive > 10 minutes
        latestResults[sid].status = 'offline';
        latestResults[sid].isOnline = false;
        latestResults[sid].lastSeen = liveness.lastSeenAt;
      } else {
        latestResults[sid].isOnline = true;
        latestResults[sid].lastSeen = liveness.lastSeenAt;
      }
    } else {
      // In mock mode, station is active
      latestResults[sid].isOnline = true;
      latestResults[sid].lastSeen = latestResults[sid].timestamp;
    }
  }

  const finalData = Object.values(latestResults);
  setCached(cacheKey, finalData);
  return res.status(200).json({ data: finalData, dataSource });
});
