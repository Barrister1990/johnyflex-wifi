-- Allow roam grants as zero-amount payments (cross-site remaining-time unlock).

do $$
begin
  if to_regclass('public.payments') is not null then
    alter table public.payments drop constraint if exists payments_provider_check;
    alter table public.payments
      add constraint payments_provider_check
      check (provider in ('mock', 'paystack', 'voucher', 'free', 'roam'));
  end if;
end $$;
