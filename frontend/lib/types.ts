export type Station = {
  id: string;          // "S1".."S6"
  name: string;
  lat: number;
  lng: number;
  description: string; // pollution influence
  order: number;       // 1 = upstream, 6 = downstream
  baselineTds?: number;// ppm
};

export type Reading = {
  stationId: string;
  timestamp: string;   // ISO
  ph: number;          // 0–14
  do: number;          // mg/L
  turbidity: number;   // NTU
  tds: number;         // ppm
  conductivity: number;// µS/cm
  temperature: number; // °C
  wqi: number;         // 0–100
  status: 'good' | 'moderate' | 'poor' | 'very-poor' | 'offline';
  isOnline?: boolean;
};

// API and legacy helper types for backward compatibility
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface WaterReading {
  id: string;
  stationId: string;
  stationName: string;
  timestamp: string;
  ph: number;
  dissolvedOxygen: number; // mg/L
  turbidity: number; // NTU
  temperature: number; // Celsius
  conductivity: number; // µS/cm
  wqi: number; // 0-100 Water Quality Index
  status: 'Good' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
}

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AnomalyAlgorithm = 'z-score' | 'rate-of-change' | 'threshold' | 'combined';

export interface Alert {
  id: string;
  stationId: string;
  stationName: string;
  severity: AlertSeverity;
  message: string;
  parameter?: string;
  value?: number;
  threshold?: number;
  observedValue?: number;
  expectedRange?: string;
  causeHint?: string;
  algorithm?: AnomalyAlgorithm;
  timestamp: string;
  acknowledged?: boolean;
  resolved: boolean;
}

export interface AlertRulesConfig {
  zScoreThreshold: number; // e.g. 2.5
  turbidityRocPercent: number; // e.g. 40%
  doDropPercent: number; // e.g. 25%
  rocTimeWindowMin: number; // e.g. 30 mins
  phMin: number; // e.g. 6.5
  phMax: number; // e.g. 8.5
  doMinMgL: number; // e.g. 5.0 mg/L
  turbidityMaxNtu: number; // e.g. 5.0 NTU
  tdsMaxPpm: number; // e.g. 500 ppm
  conductivityMaxUscm: number; // e.g. 1000 µS/cm
}

export interface Device {
  id: string;
  stationName: string;
  location: {
    lat: number;
    lng: number;
    description: string;
  };
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: string;
  batteryLevel?: number;
  firmwareVersion?: string;
}

export type NewsCategory = 'pollution' | 'government' | 'legal' | 'local' | 'general';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  category: NewsCategory;
  relatedStations?: string[];
}

export interface ESP32IngestPayload {
  deviceId: string;
  apiKey?: string;
  timestamp?: string;
  ph: number;
  dissolvedOxygen: number;
  turbidity: number;
  temperature: number;
  conductivity: number;
}
