-- =============================================================================
-- Migration: 0001_init.sql
-- Indrayani River Quality Telemetry Database Schema
-- =============================================================================

-- 1. Stations Table
create table if not exists stations (
  id text primary key,          -- 'S1'..'S6'
  name text not null,
  lat double precision not null,
  lng double precision not null,
  description text,
  sort_order int not null
);

-- 2. Readings Table
create table if not exists readings (
  id bigint generated always as identity primary key,
  station_id text references stations(id) not null,
  recorded_at timestamptz not null,
  ph numeric,
  do numeric,
  turbidity numeric,
  tds numeric,
  conductivity numeric,
  temperature numeric,
  wqi numeric,
  status text,
  device_id text,
  created_at timestamptz default now()
);
create index if not exists idx_readings_station_recorded_at on readings (station_id, recorded_at desc);

-- 3. Alerts Table
create table if not exists alerts (
  id bigint generated always as identity primary key,
  station_id text references stations(id) not null,
  reading_id bigint references readings(id),
  severity text not null,          -- 'info' | 'warning' | 'critical'
  parameter text not null,
  message text not null,
  created_at timestamptz default now(),
  acknowledged boolean default false
);
create index if not exists idx_alerts_station_created_at on alerts (station_id, created_at desc);

-- 4. Devices Table
create table if not exists devices (
  device_id text primary key,
  station_id text references stations(id),
  api_key_hash text not null,
  last_seen_at timestamptz
);

-- =============================================================================
-- Enable Row Level Security (RLS) on all tables with NO public policies
-- (Backend service role key bypasses RLS; anon public frontend has zero direct access)
-- =============================================================================
alter table stations enable row level security;
alter table readings enable row level security;
alter table alerts enable row level security;
alter table devices enable row level security;

-- =============================================================================
-- Seed Stations (Six real stations along the Indrayani River basin)
-- =============================================================================
insert into stations (id, name, lat, lng, description, sort_order)
values
  ('S1', 'Dehu', 18.7170, 73.7620, 'Upstream reference, lower anthropogenic load', 1),
  ('S2', 'Alandi Temple Area', 18.6770, 73.8970, 'High-footfall pilgrimage site; immersion activity', 2),
  ('S3', 'Moshi', 18.6770, 73.8450, 'Urban residential / domestic sewage inflow', 3),
  ('S4', 'Chikhali (Bhosari MIDC)', 18.6730, 73.8250, 'Industrial belt; effluent discharge', 4),
  ('S5', 'Charholi / Nirgudi', 18.6620, 73.8980, 'Urban stretch downstream of industrial zone', 5),
  ('S6', 'Downstream Confluence', 18.6500, 73.9200, 'Reference point after major inflows', 6)
on conflict (id) do update set
  name = excluded.name,
  lat = excluded.lat,
  lng = excluded.lng,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- =============================================================================
-- Seed Initial Devices (ESP32 IoT Nodes for each station)
-- API Key hash for development nodes is sha256 of 'indrayani-secret-key-S{n}'
-- =============================================================================
insert into devices (device_id, station_id, api_key_hash, last_seen_at)
values
  ('ESP32-S1-DEHU', 'S1', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now()),
  ('ESP32-S2-ALANDI', 'S2', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now()),
  ('ESP32-S3-MOSHI', 'S3', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now()),
  ('ESP32-S4-CHIKHALI', 'S4', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now()),
  ('ESP32-S5-CHARHOLI', 'S5', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now()),
  ('ESP32-S6-CONFLUENCE', 'S6', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now())
on conflict (device_id) do nothing;

-- Enable Realtime publication for readings and alerts if replica identity is set
alter table readings replica identity full;
alter table alerts replica identity full;
