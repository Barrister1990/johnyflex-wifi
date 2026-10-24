-- Harden payment fulfillment integrity for Paystack webhooks / callbacks.
-- One session per payment; faster lookups by provider_ref.

create unique index if not exists device_sessions_payment_id_uidx
  on public.device_sessions (payment_id);

create index if not exists payments_provider_ref_idx
  on public.payments (provider_ref)
  where provider_ref is not null;

create index if not exists payment_callbacks_payment_id_idx
  on public.payment_callbacks (payment_id);
