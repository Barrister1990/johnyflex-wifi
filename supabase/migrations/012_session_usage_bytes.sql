-- Track per-session download/upload sampled from MikroTik Hotspot Active.
-- router_bytes_* hold the last router counters so reconnect resets accumulate correctly.

alter table public.device_sessions
  add column if not exists bytes_down bigint not null default 0,
  add column if not exists bytes_up bigint not null default 0,
  add column if not exists router_bytes_in bigint not null default 0,
  add column if not exists router_bytes_out bigint not null default 0,
  add column if not exists bytes_sampled_at timestamptz;

comment on column public.device_sessions.bytes_down is
  'Cumulative download bytes for this session (sampled from MikroTik).';
comment on column public.device_sessions.bytes_up is
  'Cumulative upload bytes for this session (sampled from MikroTik).';
