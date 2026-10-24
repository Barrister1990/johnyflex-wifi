-- Remaining WiFiHub tables (after 001 profiles + 002 hotspots/packages).
-- Run in the Supabase SQL editor (or via supabase db push).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Routers (operator equipment)
-- ---------------------------------------------------------------------------
create table if not exists public.routers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  hotspot_id uuid references public.hotspots (id) on delete set null,
  catalog_id text not null,
  vendor text not null,
  model text not null,
  adapter_type text not null
    check (adapter_type in ('mock', 'mikrotik', 'unifi', 'pfsense', 'openwrt', 'starlink', 'generic')),
  label text not null,
  host text,
  port integer,
  username text,
  password_stored text,
  connection_status text not null default 'unconfigured'
    check (connection_status in ('unconfigured', 'pending', 'connected', 'error', 'mock')),
  last_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routers_owner_id_idx on public.routers (owner_id);
create index if not exists routers_hotspot_id_idx on public.routers (hotspot_id);

-- ---------------------------------------------------------------------------
-- Customers / devices / sessions
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  hotspot_id uuid references public.hotspots (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_email_lower_idx
  on public.customers (lower(email));
create index if not exists customers_hotspot_id_idx on public.customers (hotspot_id);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  mac_address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_customer_id_idx on public.devices (customer_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  hotspot_id uuid not null references public.hotspots (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete restrict,
  subscription_plan_id uuid,
  customer_email text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'GHS',
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  provider text not null
    check (provider in ('mock', 'paystack', 'voucher')),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_hotspot_id_idx on public.payments (hotspot_id);
create index if not exists payments_customer_email_idx on public.payments (lower(customer_email));
create index if not exists payments_created_at_idx on public.payments (created_at desc);

create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  hotspot_id uuid not null references public.hotspots (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_sessions_hotspot_id_idx on public.device_sessions (hotspot_id);
create index if not exists device_sessions_customer_id_idx on public.device_sessions (customer_id);
create index if not exists device_sessions_device_id_idx on public.device_sessions (device_id);
create index if not exists device_sessions_payment_id_idx on public.device_sessions (payment_id);
create index if not exists device_sessions_status_idx on public.device_sessions (status);

create table if not exists public.payment_callbacks (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  raw_payload jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists payment_callbacks_payment_id_idx
  on public.payment_callbacks (payment_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null
    check (type in ('payment_success', 'session_expired', 'system')),
  title text not null,
  body text not null,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_owner_id_idx on public.notifications (owner_id);
create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.device_sessions (id) on delete cascade,
  hotspot_id uuid not null references public.hotspots (id) on delete cascade,
  event text not null check (event in ('session_started')),
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_session_id_idx on public.usage_logs (session_id);
create index if not exists usage_logs_hotspot_id_idx on public.usage_logs (hotspot_id);

-- ---------------------------------------------------------------------------
-- Vouchers
-- ---------------------------------------------------------------------------
create table if not exists public.voucher_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete restrict,
  hotspot_id uuid references public.hotspots (id) on delete set null,
  label text not null,
  quantity integer not null check (quantity > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voucher_batches_owner_id_idx
  on public.voucher_batches (owner_id);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.voucher_batches (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete restrict,
  hotspot_id uuid references public.hotspots (id) on delete set null,
  code text not null,
  status text not null default 'unused'
    check (status in ('unused', 'redeemed', 'expired', 'void')),
  redeemed_at timestamptz,
  redeemed_by_email text,
  payment_id uuid references public.payments (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create index if not exists vouchers_owner_id_idx on public.vouchers (owner_id);
create index if not exists vouchers_batch_id_idx on public.vouchers (batch_id);
create index if not exists vouchers_code_idx on public.vouchers (upper(code));

-- ---------------------------------------------------------------------------
-- Portal themes
-- ---------------------------------------------------------------------------
create table if not exists public.portal_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  hotspot_id uuid references public.hotspots (id) on delete cascade,
  logo_url text,
  primary_color text not null default '#0F1115',
  accent_color text not null default '#E8784A',
  welcome_message text not null default '',
  background_image_url text,
  terms_text text not null default '',
  show_packages boolean not null default true,
  show_voucher_redeem boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_themes_owner_id_idx on public.portal_themes (owner_id);
create unique index if not exists portal_themes_owner_hotspot_uidx
  on public.portal_themes (
    owner_id,
    (coalesce(hotspot_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null default 0,
  currency text not null default 'GHS',
  speed_profile text not null default '10Mbps',
  data_limit_mb integer,
  interval_days integer not null check (interval_days > 0),
  hotspot_id uuid references public.hotspots (id) on delete set null,
  linked_package_id uuid not null references public.packages (id) on delete restrict,
  enabled boolean not null default true,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_plans_owner_id_idx
  on public.subscription_plans (owner_id);

-- payments.subscription_plan_id FK (table created above)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_subscription_plan_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_subscription_plan_id_fkey
      foreign key (subscription_plan_id)
      references public.subscription_plans (id)
      on delete set null;
  end if;
end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  customer_email text not null,
  hotspot_id uuid not null references public.hotspots (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  last_payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_owner_id_idx on public.subscriptions (owner_id);
create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index if not exists subscriptions_customer_email_idx
  on public.subscriptions (lower(customer_email));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.routers enable row level security;
alter table public.customers enable row level security;
alter table public.devices enable row level security;
alter table public.device_sessions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_callbacks enable row level security;
alter table public.notifications enable row level security;
alter table public.usage_logs enable row level security;
alter table public.voucher_batches enable row level security;
alter table public.vouchers enable row level security;
alter table public.portal_themes enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;

-- Owners manage own rows
create policy "Owners manage own routers"
  on public.routers for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own notifications"
  on public.notifications for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own voucher batches"
  on public.voucher_batches for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own vouchers"
  on public.vouchers for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own portal themes"
  on public.portal_themes for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own subscription plans"
  on public.subscription_plans for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage own subscriptions"
  on public.subscriptions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Public read (captive portal)
create policy "Anyone can read portal themes"
  on public.portal_themes for select
  using (true);

create policy "Anyone can read enabled subscription plans"
  on public.subscription_plans for select
  using (enabled = true);

-- customers / devices / device_sessions / payments / payment_callbacks /
-- usage_logs: no anon/authenticated policies — service role only (bypasses RLS).
