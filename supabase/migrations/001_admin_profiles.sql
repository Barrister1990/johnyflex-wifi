-- WiFiHub admin (operator) profiles — linked to Supabase Auth.
-- Run in the Supabase SQL editor (or via supabase db push).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  business_name text,
  phone text,
  support_email text,
  currency text not null default 'GHS',
  timezone text not null default 'Africa/Accra',
  notify_payment_success boolean not null default true,
  notify_session_expired boolean not null default true,
  notify_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Admins can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Admins can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_admin_user_created on auth.users;
create trigger on_auth_admin_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_admin_user();
