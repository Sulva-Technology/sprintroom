# Deploying SprintRoom

Run these in order. Replace `<REF>` with the Supabase project ref and `<DOMAIN>` with the production domain.

## 1. Database

```bash
npx supabase login
npx supabase link --project-ref <REF>
npx supabase db push
```

`db push` applies every migration not yet on the remote DB. Until it runs, role-based permissions, focus pause, scheduled-session auto-start and the realtime/search_path fixes are inactive.

## 2. Keys

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

Edge function secrets (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically):

```bash
npx supabase secrets set CRON_SECRET=<random-long-string> NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<you@domain>
```

Vercel → Project → Settings → Environment Variables (Production and Preview). Set every key in `.env.example`:
`NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY CRON_SECRET RESEND_API_KEY INVITE_EMAIL_FROM AUTH_EMAIL_FROM GEMINI_API_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT`.
Then redeploy.

## 3. Edge functions

```bash
npx supabase functions deploy rhythm-nudges
npx supabase functions deploy process-schedules
npx supabase functions deploy process-recurring-tasks
```

All three use `verify_jwt = false` (see `supabase/config.toml`). They authenticate with `Authorization: Bearer <CRON_SECRET>`.

## 4. Cron jobs (Supabase SQL editor)

Store the secret once (if it says the name already exists, use `vault.update_secret` instead):

```sql
select vault.create_secret('<CRON_SECRET>', 'CRON_SECRET');
```

Schedule the three jobs. Re-using a job name replaces the old job, which also fixes the broken `[PROJECT-REF]` job created by migration `20260505072722`:

```sql
select cron.schedule('process-recurring-tasks', '0 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/process-recurring-tasks',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)),
    body := '{}'::jsonb);
$$);

select cron.schedule('process-pomodoro-schedules', '* * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/process-schedules',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)),
    body := '{}'::jsonb);
$$);

select cron.schedule('rhythm-nudges-hourly', '0 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/rhythm-nudges',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)),
    body := '{}'::jsonb);
$$);

select jobname, schedule, active from cron.job order by jobname;
```

Expected: the three jobs above, plus the DB-native scheduled-focus job from migration `20260722110000`, all `active = true`.

## 5. Auth redirect

Supabase → Authentication → URL Configuration: add `https://<DOMAIN>/auth/callback` to Redirect URLs, and set Site URL to `https://<DOMAIN>`.

## 6. Smoke test (two browser profiles, two accounts)

1. Account A signs up, creates a workspace and invites B by email.
2. B accepts, then sees the workspace in the switcher.
3. A changes B's role to viewer. B can no longer add tasks.
4. A quick-adds a task on Home. It appears under Today.
5. A assigns a task to B. It appears on B's Home without refresh.
6. B starts and completes a focus session. A's Team page shows the activity.
7. Create a recurring rule. Within an hour, a task is created.
