-- Hotspots + packages for WiFiHub (single-company operator).
-- Run after 001_admin_profiles.sql in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.hotspots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  ssid text not null,
  address text not null default '',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'maintenance')),
  qr_payload text not null,
  router_id uuid,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create index if not exists hotspots_owner_id_idx on public.hotspots (owner_id);
create index if not exists hotspots_slug_idx on public.hotspots (slug);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null default 0,
  duration_minutes integer not null check (duration_minutes > 0),
  data_limit_mb integer,
  speed_profile text not null default '10Mbps',
  currency text not null default 'GHS',
  enabled boolean not null default true,
  hotspot_ids uuid[] default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists packages_owner_id_idx on public.packages (owner_id);

alter table public.hotspots enable row level security;
alter table public.packages enable row level security;

-- Operator CRUD
create policy "Owners manage own hotspots"
  on public.hotspots
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own packages"
  on public.packages
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Public portal reads (QR / captive) — single-company safe
create policy "Anyone can read active hotspots"
  on public.hotspots
  for select
  using (status = 'active');

create policy "Anyone can read enabled packages"
  on public.packages
  for select
  using (enabled = true);
