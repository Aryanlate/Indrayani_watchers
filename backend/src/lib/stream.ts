import { Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

// Connected frontend SSE client responses
const clients = new Set<Response>();

/**
 * Register a new Server-Sent-Events (SSE) client
 */
export function addSSEClient(res: Response): void {
  clients.add(res);

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientsCount: clients.size, time: new Date().toISOString() })}\n\n`);

  res.on('close', () => {
    clients.delete(res);
  });
}

/**
 * Broadcast event to all active SSE clients
 */
export function broadcastSSE(event: 'reading' | 'alert' | 'ping', data: unknown): void {
  if (clients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error('[SSE] Error sending to client, removing:', err);
      clients.delete(client);
    }
  }
}

/**
 * Periodically send SSE keep-alive ping
 */
setInterval(() => {
  if (clients.size > 0) {
    for (const client of clients) {
      try {
        client.write(`: keep-alive ${Date.now()}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
}, 20000);

/**
 * Initialize Supabase Realtime postgres_changes listener
 */
export function initSupabaseRealtime(supabase: SupabaseClient, isConfigured: boolean): void {
  if (!isConfigured) {
    console.log('[Realtime] Supabase credentials not configured; local in-memory event relay active.');
    return;
  }

  try {
    const channel = supabase
      .channel('indrayani-realtime-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        (payload) => {
          console.log('[Supabase Realtime] New reading detected:', payload.new?.id, payload.new?.station_id);
          broadcastSSE('reading', payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          console.log('[Supabase Realtime] New alert detected:', payload.new?.id, payload.new?.station_id);
          broadcastSSE('alert', payload.new);
        }
      )
      .subscribe((status) => {
        console.log(`[Supabase Realtime] Channel subscription status: ${status}`);
      });

    console.log('[Realtime] Supabase postgres_changes listener registered.');
  } catch (err) {
    console.error('[Realtime] Failed to initialize Supabase realtime listener:', err);
  }
}
