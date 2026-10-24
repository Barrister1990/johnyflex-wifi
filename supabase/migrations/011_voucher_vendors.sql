-- Voucher resellers (vendors): who holds which printed vouchers, what they owe,
-- and cash collected from them. Commission kept by a vendor is logged as an expense.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  hotspot_id uuid references public.hotspots (id) on delete set null,
  commission_percent numeric(5, 2) not null default 0
    check (commission_percent >= 0 and commission_percent <= 100),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_owner_id_idx on public.vendors (owner_id);

alter table public.vendors enable row level security;

drop policy if exists "vendors_owner_all" on public.vendors;
create policy "vendors_owner_all"
  on public.vendors
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

alter table public.vouchers
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null,
  add column if not exists assigned_at timestamptz;

create index if not exists vouchers_vendor_id_idx on public.vouchers (vendor_id);

create table if not exists public.vendor_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  commission_amount numeric(12, 2) not null default 0 check (commission_amount >= 0),
  currency text not null default 'GHS',
  expense_id uuid references public.expenses (id) on delete set null,
  collected_at date not null default (timezone('utc', now())::date),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists vendor_collections_vendor_idx
  on public.vendor_collections (vendor_id, collected_at desc);
create index if not exists vendor_collections_owner_idx
  on public.vendor_collections (owner_id);

alter table public.vendor_collections enable row level security;

drop policy if exists "vendor_collections_owner_all" on public.vendor_collections;
create policy "vendor_collections_owner_all"
  on public.vendor_collections
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
