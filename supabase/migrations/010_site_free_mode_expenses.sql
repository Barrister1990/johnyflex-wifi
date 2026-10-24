-- Per-site Free Mode (optional override) + optional expense location.

alter table public.hotspots
  add column if not exists free_mode_enabled boolean not null default false,
  add column if not exists free_mode_starts_at timestamptz,
  add column if not exists free_mode_ends_at timestamptz,
  add column if not exists free_mode_package_id uuid;

comment on column public.hotspots.free_mode_enabled is
  'When true, this site uses its own Free Mode window instead of the owner-wide profile setting.';
comment on column public.hotspots.free_mode_starts_at is
  'Per-site Free Mode window start (inclusive).';
comment on column public.hotspots.free_mode_ends_at is
  'Per-site Free Mode window end (inclusive).';
comment on column public.hotspots.free_mode_package_id is
  'Package used for speed profile during free grants at this site.';

do $$
begin
  if to_regclass('public.packages') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'hotspots_free_mode_package_id_fkey'
     )
  then
    alter table public.hotspots
      add constraint hotspots_free_mode_package_id_fkey
      foreign key (free_mode_package_id)
      references public.packages (id)
      on delete set null;
  end if;
end $$;

alter table public.expenses
  add column if not exists hotspot_id uuid;

comment on column public.expenses.hotspot_id is
  'Optional location this expense belongs to; null = all / unassigned.';

do $$
begin
  if to_regclass('public.hotspots') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'expenses_hotspot_id_fkey'
     )
  then
    alter table public.expenses
      add constraint expenses_hotspot_id_fkey
      foreign key (hotspot_id)
      references public.hotspots (id)
      on delete set null;
  end if;
end $$;

create index if not exists expenses_hotspot_id_idx
  on public.expenses (hotspot_id);
