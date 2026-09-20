import { ApiResponse, Reading, Alert, NewsItem } from './types';
import { useRiverStore } from './store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private pollingIntervalId: NodeJS.Timeout | null = null;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor(baseUrl: string) {
    // Strip trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Generic GET request handler
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(options?.headers || {}),
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.error || `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network request failed';
      return {
        error: errorMessage,
      };
    }
  }

  /**
   * Generic POST request handler
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options?.headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.error || `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network request failed';
      return {
        error: errorMessage,
      };
    }
  }

  /**
   * Direct health check endpoint utility
   */
  async checkHealth(): Promise<{ status: string; ok: boolean; database?: string }> {
    const url = `${this.baseUrl}/api/health`;
    try {
      const res = await fetch(url, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        return { status: data.status || 'ok', ok: true, database: data.database };
      }
      return { status: `error (${res.status})`, ok: false };
    } catch {
      return { status: 'unreachable', ok: false };
    }
  }

  /**
   * Fetch latest readings for all stations from backend
   */
  async getLatestReadings(): Promise<Reading[]> {
    const res = await this.get<Reading[]>('/api/readings');
    if (res.data) {
      useRiverStore.getState().setAllReadings(res.data);
      return res.data;
    }
    return [];
  }

  /**
   * Fetch historical readings for a specific station
   */
  async getStationHistory(stationId: string, hours: number = 24): Promise<Reading[]> {
    const res = await this.get<Reading[]>(`/api/readings?station=${stationId}&hours=${hours}`);
    return res.data || [];
  }

  /**
   * Fetch recent alerts from backend
   */
  async getAlerts(severity?: string, station?: string): Promise<Alert[]> {
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (station) params.set('station', station);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await this.get<Alert[]>(`/api/alerts${query}`);
    if (res.data) {
      useRiverStore.getState().setAlerts(res.data);
      return res.data;
    }
    return [];
  }

  /**
   * Fetch regional news articles from backend /api/news
   */
  async getNews(category?: string): Promise<NewsItem[]> {
    const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
    const res = await this.get<NewsItem[]>(`/api/news${query}`);
    return res.data || [];
  }

  /**
   * Connect to backend Server-Sent-Events (SSE) Realtime Stream (/api/stream).
   * Relays Supabase postgres_changes down to Zustand state.
   * Falls back to polling /api/readings every 15s if stream disconnects.
   */
  connectStream(): void {
    if (typeof window === 'undefined' || this.isConnecting) return;
    this.isConnecting = true;

    // Clean up any existing connection
    this.disconnectStream();

    const streamUrl = `${this.baseUrl}/api/stream`;
    useRiverStore.getState().setStreamStatus('connecting');

    try {
      const es = new EventSource(streamUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.isConnecting = false;
        useRiverStore.getState().setStreamStatus('connected');
        this.stopFallbackPolling();
      };

      // Listen for 'reading' events
      es.addEventListener('reading', (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data);
          const normalized: Reading = {
            stationId: raw.station_id || raw.stationId,
            timestamp: raw.recorded_at || raw.timestamp || new Date().toISOString(),
            ph: Number(raw.ph),
            do: Number(raw.do),
            turbidity: Number(raw.turbidity),
            tds: Number(raw.tds),
            conductivity: Number(raw.conductivity),
            temperature: Number(raw.temperature),
            wqi: Number(raw.wqi),
            status: raw.status,
          };
          useRiverStore.getState().updateReading(normalized);
        } catch (err) {
          console.error('[SSE] Failed to parse reading event:', err);
        }
      });

      // Listen for 'alert' events
      es.addEventListener('alert', (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data);
          const alert: Alert = {
            id: String(raw.id || Date.now()),
            stationId: raw.station_id || raw.stationId,
            stationName: raw.stationName || `Station ${raw.station_id || raw.stationId}`,
            severity: raw.severity || 'warning',
            message: raw.message,
            parameter: raw.parameter,
            timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
            resolved: Boolean(raw.acknowledged),
          };
          useRiverStore.getState().addAlert(alert);
        } catch (err) {
          console.error('[SSE] Failed to parse alert event:', err);
        }
      });

      es.onerror = () => {
        this.isConnecting = false;
        useRiverStore.getState().setStreamStatus('disconnected');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Start fallback polling every 15 seconds
        this.startFallbackPolling(15000);

        // Attempt reconnection after 8 seconds
        if (!this.reconnectTimeoutId) {
          this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = null;
            this.connectStream();
          }, 8000);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      console.error('[SSE] Connection setup error:', err);
      useRiverStore.getState().setStreamStatus('disconnected');
      this.startFallbackPolling(15000);
    }
  }

  /**
   * Close active SSE stream connection
   */
  disconnectStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.isConnecting = false;
  }

  /**
   * Fallback polling every 15s if stream disconnects
   */
  private startFallbackPolling(intervalMs: number = 15000): void {
    if (this.pollingIntervalId) return;

    // Immediately trigger one poll
    this.getLatestReadings().catch(() => {});

    this.pollingIntervalId = setInterval(() => {
      this.getLatestReadings().catch((err) => {
        console.warn('[Polling] Fallback readings poll failed:', err);
      });
    }, intervalMs);
  }

  private stopFallbackPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
