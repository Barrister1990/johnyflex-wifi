-- Schedule WiFiHub session expiry via pg_cron + pg_net → Edge Function.
-- Same Vault secrets pattern as other scheduled jobs (project_url, service_role_key).
--
-- Prerequisites:
--   1. Vault secrets: project_url, service_role_key
--   2. Edge Function secrets:
--        supabase secrets set WIFIHUB_APP_URL=https://wifi.edumatetechnologies.com
--        supabase secrets set WIFIHUB_CRON_SECRET=<same as VPS CRON_SECRET>
--   3. Deploy: supabase functions deploy expire-sessions
--
-- The Edge Function POSTs to the VPS /api/cron/expire (MikroTik is only
-- reachable from the VPS WireGuard network).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'wifihub-expire-sessions';
exception
  when others then null;
end $$;

select cron.schedule(
  'wifihub-expire-sessions',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/expire-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
