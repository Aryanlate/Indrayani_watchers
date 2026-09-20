import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readingsRouter } from './routes/readings';
import { ingestRouter } from './routes/ingest';
import { alertsRouter } from './routes/alerts';
import { newsRouter } from './routes/news';
import { devicesRouter } from './routes/devices';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { addSSEClient, initSupabaseRealtime } from './lib/stream';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// CORS configuration - restricted to configured frontend origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server or ESP32)
      if (!origin) return callback(null, true);

      // Match allowed CORS_ORIGIN
      if (origin === CORS_ORIGIN) {
        return callback(null, true);
      }

      // If in development mode and coming from localhost, allow convenience
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy: Access denied for origin ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Base health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    database: isSupabaseConfigured() ? 'supabase-connected' : 'local-in-memory',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/stream - Server-Sent-Events (SSE) Realtime Endpoint
 * Relays Supabase postgres_changes (readings & alerts) directly to frontend clients.
 * Frontend never holds any Supabase key.
 */
app.get('/api/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  addSSEClient(res);
});

// Mount application API routes
app.use('/api/readings', readingsRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/news', newsRouter);
app.use('/api/devices', devicesRouter);

// Standard 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler returning standard JSON error envelope
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`[Indrayani Watch Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Indrayani Watch Backend] CORS restricted to: ${CORS_ORIGIN}`);
  console.log(`[Indrayani Watch Backend] Realtime SSE stream ready at http://localhost:${PORT}/api/stream`);

  // Initialize Supabase Realtime postgres_changes listener
  initSupabaseRealtime(supabase, isSupabaseConfigured());
});

export default app;
