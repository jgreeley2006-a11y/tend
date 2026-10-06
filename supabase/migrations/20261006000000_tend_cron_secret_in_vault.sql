-- Move the reminder schedule's shared secret out of code and into Supabase Vault.
-- The secret is generated here, inside the database, so its value never appears in
-- the repo, a dashboard, or a chat. send-reminders checks it with tend_check_cron_secret().
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'tend_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'tend_cron_secret', 'Shared secret between the tend-reminders cron job and the send-reminders function');
  end if;
end $$;

-- true when the header the function received matches the Vault secret.
-- Only the service role (the edge function) may call it.
create or replace function public.tend_check_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'tend_cron_secret' and decrypted_secret = candidate
  );
$$;
revoke all on function public.tend_check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.tend_check_cron_secret(text) to service_role;
