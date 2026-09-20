import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseServiceRoleKey) &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseServiceRoleKey.includes('placeholder')
  );
};

if (!isSupabaseConfigured()) {
  console.warn(
    '[supabase.ts] Notice: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is using a placeholder or missing. Database queries will fall back gracefully.'
  );
}

// Service role client bypasses RLS and handles all server-side queries securely
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
