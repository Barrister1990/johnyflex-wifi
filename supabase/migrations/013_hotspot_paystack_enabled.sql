-- Per-location Paystack packages toggle.
-- When false, captive portal hides package/Paystack checkout and shows voucher redeem only.

alter table public.hotspots
  add column if not exists paystack_enabled boolean not null default true;

comment on column public.hotspots.paystack_enabled is
  'When false, portal hides Paystack packages; voucher redeem only.';
