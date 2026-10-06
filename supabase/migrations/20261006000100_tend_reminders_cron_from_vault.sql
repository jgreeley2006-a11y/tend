-- The every-minute schedule that runs send-reminders. It reads the shared secret
-- from Vault at run time instead of having it written into the job.
-- (cron.schedule with an existing name replaces that job.)
select cron.schedule(
  'tend-reminders',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://eztsbheokrpkbyjkntxc.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tend_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
