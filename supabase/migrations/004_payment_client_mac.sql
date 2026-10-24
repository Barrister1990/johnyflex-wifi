-- Store captive-portal client MAC so pay/voucher can authorize the right station.
alter table public.payments
  add column if not exists client_mac text;

comment on column public.payments.client_mac is
  'Client MAC from MikroTik captive portal query string (normalized aa:bb:...).';
