-- Operator Free Mode: holiday / promo Wi‑Fi access window.
-- Safe to run even if some earlier tables are missing; FK/constraints apply when present.

alter table public.profiles
  add column if not exists free_mode_enabled boolean not null default false,
  add column if not exists free_mode_starts_at timestamptz,
  add column if not exists free_mode_ends_at timestamptz,
  add column if not exists free_mode_package_id uuid;

comment on column public.profiles.free_mode_enabled is
  'When true and now is within starts/ends, portal offers free (GHS 0) access.';
comment on column public.profiles.free_mode_starts_at is
  'Free Mode window start (inclusive).';
comment on column public.profiles.free_mode_ends_at is
  'Free Mode window end (inclusive); session access ends at this time.';
comment on column public.profiles.free_mode_package_id is
  'Package used for speed profile during free grants (optional; falls back to first enabled).';

-- Link package id only after packages table exists (migration 002).
do $$
begin
  if to_regclass('public.packages') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'profiles_free_mode_package_id_fkey'
     )
  then
    alter table public.profiles
      add constraint profiles_free_mode_package_id_fkey
      foreign key (free_mode_package_id)
      references public.packages (id)
      on delete set null;
  end if;
end $$;

-- Allow free grants as zero-amount payments (migration 003 creates payments).
do $$
begin
  if to_regclass('public.payments') is not null then
    alter table public.payments drop constraint if exists payments_provider_check;
    alter table public.payments
      add constraint payments_provider_check
      check (provider in ('mock', 'paystack', 'voucher', 'free'));
  end if;
end $$;
