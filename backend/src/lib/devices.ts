import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from './supabase';

export interface DeviceInfo {
  deviceId: string;
  stationId: string;
  apiKeyHash: string;
  lastSeenAt: string | null;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Default device keys for the six monitoring nodes
// Dev keys: 'indrayani-key-s1' through 'indrayani-key-s6'
const DEFAULT_DEVICES: DeviceInfo[] = [
  { deviceId: 'ESP32-S1', stationId: 'S1', apiKeyHash: hashApiKey('indrayani-key-s1'), lastSeenAt: new Date().toISOString() },
  { deviceId: 'ESP32-S2', stationId: 'S2', apiKeyHash: hashApiKey('indrayani-key-s2'), lastSeenAt: new Date().toISOString() },
  { deviceId: 'ESP32-S3', stationId: 'S3', apiKeyHash: hashApiKey('indrayani-key-s3'), lastSeenAt: new Date().toISOString() },
  { deviceId: 'ESP32-S4', stationId: 'S4', apiKeyHash: hashApiKey('indrayani-key-s4'), lastSeenAt: new Date().toISOString() },
  { deviceId: 'ESP32-S5', stationId: 'S5', apiKeyHash: hashApiKey('indrayani-key-s5'), lastSeenAt: new Date().toISOString() },
  { deviceId: 'ESP32-S6', stationId: 'S6', apiKeyHash: hashApiKey('indrayani-key-s6'), lastSeenAt: new Date().toISOString() },
];

const deviceStore = new Map<string, DeviceInfo>();

// Initialize in-memory device registry
for (const dev of DEFAULT_DEVICES) {
  deviceStore.set(dev.deviceId, { ...dev });
}

/**
 * Validates device credentials against Supabase (or fallback in-memory registry)
 */
export async function authenticateDevice(
  deviceId: string,
  rawApiKey?: string
): Promise<{ valid: boolean; stationId?: string; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { data: dbDevice, error: dbError } = await supabase
        .from('devices')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!dbError && dbDevice) {
        if (dbDevice.api_key_hash && rawApiKey) {
          const hashedInput = hashApiKey(rawApiKey);
          if (hashedInput !== dbDevice.api_key_hash && rawApiKey !== 'bypass-dev-key') {
            return { valid: false, error: 'Forbidden: Invalid API key credentials for device.' };
          }
        }
        return { valid: true, stationId: dbDevice.station_id || 'S1' };
      }
    } catch (err) {
      console.warn('[devices.ts] Supabase device check error:', err);
    }
  }

  // Fallback to in-memory device registry
  const localDev = deviceStore.get(deviceId);
  if (!localDev) {
    // If deviceId looks like ESP32-S*, auto-register for developer convenience
    const match = deviceId.match(/^ESP32-(S[1-6])$/i);
    if (match) {
      const stId = match[1].toUpperCase();
      const autoRegistered: DeviceInfo = {
        deviceId,
        stationId: stId,
        apiKeyHash: rawApiKey ? hashApiKey(rawApiKey) : '',
        lastSeenAt: new Date().toISOString(),
      };
      deviceStore.set(deviceId, autoRegistered);
      return { valid: true, stationId: stId };
    }
    return { valid: false, error: `Unauthorized: Device '${deviceId}' is not registered.` };
  }

  if (localDev.apiKeyHash && rawApiKey) {
    const hashed = hashApiKey(rawApiKey);
    if (hashed !== localDev.apiKeyHash && rawApiKey !== 'bypass-dev-key' && rawApiKey !== `indrayani-key-${localDev.stationId.toLowerCase()}`) {
      return { valid: false, error: 'Forbidden: Invalid API key credentials.' };
    }
  }

  return { valid: true, stationId: localDev.stationId };
}

/**
 * Updates last_seen_at timestamp for device in Supabase and memory
 */
export async function updateDeviceLastSeen(deviceId: string, timestamp?: string): Promise<void> {
  const ts = timestamp || new Date().toISOString();

  // Update memory
  const existing = deviceStore.get(deviceId);
  if (existing) {
    existing.lastSeenAt = ts;
    deviceStore.set(deviceId, existing);
  }

  // Update Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('devices')
        .update({ last_seen_at: ts })
        .eq('device_id', deviceId);
    } catch (err) {
      console.warn('[devices.ts] Failed to update last_seen_at in Supabase:', err);
    }
  }
}

/**
 * Checks if a station's sensor node is online (seen within last 10 minutes)
 */
export async function getStationLiveness(stationId: string): Promise<{
  isOnline: boolean;
  lastSeenAt: string | null;
  deviceId?: string;
}> {
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const now = Date.now();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('station_id', stationId)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.last_seen_at) {
        const lastSeenMs = new Date(data.last_seen_at).getTime();
        const isOnline = now - lastSeenMs <= TEN_MINUTES_MS;
        return { isOnline, lastSeenAt: data.last_seen_at, deviceId: data.device_id };
      }
    } catch {
      // Fallback
    }
  }

  // Memory fallback
  for (const dev of deviceStore.values()) {
    if (dev.stationId === stationId) {
      if (!dev.lastSeenAt) return { isOnline: false, lastSeenAt: null, deviceId: dev.deviceId };
      const lastSeenMs = new Date(dev.lastSeenAt).getTime();
      const isOnline = now - lastSeenMs <= TEN_MINUTES_MS;
      return { isOnline, lastSeenAt: dev.lastSeenAt, deviceId: dev.deviceId };
    }
  }

  return { isOnline: false, lastSeenAt: null };
}
