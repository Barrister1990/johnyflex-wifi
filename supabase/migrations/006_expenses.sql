-- Operator expenses for Revenue / P&L reporting.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'general',
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'GHS',
  incurred_at date not null default (timezone('utc', now())::date),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_owner_id_idx on public.expenses (owner_id);
create index if not exists expenses_incurred_at_idx on public.expenses (incurred_at desc);
create index if not exists expenses_owner_incurred_idx on public.expenses (owner_id, incurred_at desc);

alter table public.expenses enable row level security;

create policy "expenses_owner_all"
  on public.expenses
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
