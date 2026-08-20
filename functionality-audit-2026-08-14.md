# SprintRoom — full-app functionality audit & remediation plan

**Date:** 2026-08-14 · **Branch:** `main` @ `9748ed4` (+ uncommitted workspace-scoping work)

## Verdict

**Not fully functional.** Every static gate is green, but the gates do not exercise the
broken parts. Three whole features (recurring tasks, scheduled-session push, scheduled
auto-start) are dead on arrival, offline sync can silently drop user edits, and the
finances page still reads the wrong workspace.

### Gate results (all run, all pass)

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean, exit 0 |
| Lint | `npx eslint .` | clean, no output |
| Tests | `npx vitest run` | 17 files, 54 tests, all pass |
| Prod build | `npx next build` | compiled in 61s, 21/21 static pages, 25 routes |
| Dev boot | `npm run dev` | ready in 6.3s |
| Route smoke | curl, dev server | `/` `/login` `/signup` `/forgot-password` `/offline` `/manifest.webmanifest` `/robots.txt` `/sitemap.xml` `/invite/<uuid>` → 200; `/dashboard` → 307 → `/login` (correct signed out) |

The 54 tests cover pure helpers (workspace picker, rhythm nudge slots, weekly-rhythm
grouping, route warmer, offline project derivation) and mocked server actions. **Zero**
tests touch an edge function, an RLS policy, the offline sync executor's error handling,
or recurring tasks — which is exactly where the defects are.

---

## P0 — Blockers

### P0-1. `.env` is missing 8 of 12 required keys

`.env` contains only `APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing versus `.env.example`:

`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `INVITE_EMAIL_FROM`,
`AUTH_EMAIL_FROM`, `GEMINI_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`.

Consequences, all silent (each code path degrades rather than erroring loudly):
AI task suggestions and AI finance insights return "not configured"; invite emails and the
signup-confirmation Resend fallback never send; `createAdminClient()` returns `null`;
web push cannot be subscribed to or delivered; every cron-triggered edge function rejects
its own caller because `CRON_SECRET` is unset (`isAuthorized` returns `false` when the
secret is missing).

**Fix:** populate `.env` locally and the deploy target's secret store. Add a startup
assertion that logs which optional integrations are disabled, so "configured" vs "broken"
is distinguishable at a glance.

### P0-2. Recurring tasks never fire — the edge function writes columns that don't exist

`supabase/functions/process-recurring-tasks/index.ts` builds its insert against
`supabase/schema.sql`, which is a **stale legacy schema** (see P2-1). The live `tasks`
table comes from `0002` + `0004`:

- inserts `user_id` — `tasks` has no `user_id` column (authorship is `created_by`;
  `app/actions/tasks.ts` carries a comment about this exact `PGRST204` failure)
- `priority: rule.priority || 0` — rules store `int`, `tasks.priority` is `text` defaulting
  to `'medium'`
- `project_id` may be `NULL` (the settings dialog creates rules with no project) but
  `tasks.project_id` is `NOT NULL`
- never sets `created_by`; the `set_task_workspace_id` trigger falls back to `auth.uid()`,
  which is `NULL` under the service role

Every rule therefore fails its insert, the function returns 500, and `next_run_at` is never
advanced — so the same rules retry forever.

**Fix:** rewrite the insert as `{ project_id, title, description, status, priority,
created_by: rule.user_id, estimate_pomodoros }`; map `rule.priority` int → the text scale;
reject/skip rules with a null `project_id` (or give the settings dialog a project picker,
see P2-6); advance `next_run_at` per rule inside a transaction with the insert.

### P0-3. `verify_jwt = true` blocks both cron edge functions

`supabase/config.toml`:

```toml
[functions.process-recurring-tasks]
verify_jwt = true
[functions.process-schedules]
verify_jwt = true
```

Both are invoked by pg_cron with `Authorization: Bearer <CRON_SECRET>`, which is not a JWT.
The gateway rejects the call before the handler's own `isAuthorized` check ever runs. The
`rhythm-nudges` block right below them sets `verify_jwt = false` **with a comment stating
precisely this reason** — the other two were never updated.

**Fix:** set `verify_jwt = false` on both, then redeploy. Their `CRON_SECRET` bearer check
is the real auth.

### P0-4. `process-schedules` uses a PostgREST embed that has no relationship

```ts
.from("focus_schedules")
.select("*, web_push_subscriptions(endpoint, keys_p256dh, keys_auth)")
```

There is no foreign key between `focus_schedules` and `web_push_subscriptions` — they only
share a `user_id` pointing at `auth.users`, which PostgREST cannot embed through. Both the
warning query and the auto-start query fail, so no scheduled-session notification is ever
delivered even once P0-3 is fixed.

**Fix:** drop the embed; select the schedules, then fetch
`web_push_subscriptions` separately with `.in('user_id', userIds)` and group in JS — the
pattern `rhythm-nudges/index.ts` already uses correctly.

### P0-5. Scheduled focus sessions become invisible and then wedge the user

Compound failure across four files:

1. `/dashboard/focus` renders `<ScheduleFocusDialog />` with no `taskId`/`projectId`/
   `workspaceId` props, so `scheduleFocusSession` inserts `focus_schedules` with
   `workspace_id = NULL`.
2. `process_due_focus_schedules()` (SECURITY DEFINER, bypasses RLS) copies that NULL into
   the new `focus_sessions` row.
3. The only SELECT policy is `Sessions viewable by members USING (is_workspace_member(workspace_id))`.
   `is_workspace_member(NULL)` is `false`, so **the owner cannot read their own session.**
4. `getActiveFocusSession()` returns null → the focus tube never appears. Worse,
   `startFocusSession`'s "already active?" guard also can't see it, so the next manual start
   hits the `unique_active_focus_session_per_user` partial index and errors out. The user is
   stuck with an invisible session they cannot see, finish, or replace.

**Fix (all three layers):**
- Add an owner clause to the policy:
  `USING (is_workspace_member(workspace_id) OR user_id = auth.uid())`.
- Resolve and persist `workspace_id` in `scheduleFocusSession` via
  `resolveActiveWorkspaceId()` when the caller passes none.
- Pass `workspaceId` into `ScheduleFocusDialog` from `/dashboard/focus`.
- Backfill: `UPDATE focus_sessions SET workspace_id = ... WHERE workspace_id IS NULL`, and
  abandon any stranded active sessions.

### P0-6. Offline sync silently discards failed mutations

`components/offline/offline-provider.tsx` → `syncExecutor`. These branches call the server
action and **ignore the returned `{ success: false, error }`**:

`update_task`, `update_task_status`, `mark_task_blocked`, `create_comment`,
`create_checklist_item`, `update_checklist_item`

`processSyncQueue` only treats a **thrown** error as failure, so a rejected mutation (RLS
denial, validation failure, deleted parent row) resolves normally and the queue item is
deleted. The user's offline edit is gone with no error, no retry, no trace. The
create/focus branches do check — this is an inconsistency, not a design decision.

**Fix:** normalise every action's return and throw on `!success` / `error`, e.g.
`const res = await updateTaskStatus(...); if (res?.error || res?.success === false) throw new Error(...)`.
Add a unit test per action type asserting a rejected result leaves the item queued.

---

## P1 — High

### P1-1. Finances page reads the wrong workspace

`app/dashboard/finances/page.tsx` still does:

```ts
.from('workspace_members').select('workspace_id, role').eq('user_id', user.id).limit(1).single()
```

No `ORDER BY`, and it ignores `resolveActiveWorkspaceId()`. This is the exact bug that
`9748ed4` fixed for the dashboard, projects, team and focus surfaces — finances was missed.
A multi-workspace user sees finances from an arbitrary workspace while the switcher says
otherwise.

**Fix:** replace with `resolveActiveWorkspaceId()`.

### P1-2. `updateTask` writes an unvalidated client object

`app/actions/task-details.ts`:

```ts
export async function updateTask(id: string, data: any, projectId: string) {
  const { error } = await supabase.from('tasks').update(data).eq('id', id)
```

Any authenticated caller can POST arbitrary columns — `workspace_id`, `project_id`,
`created_by`, `status`, `deadline`. `Tasks updatable by editors` declares only `USING`, so
Postgres reuses it as the check: an editor in two workspaces can move any task from one
into the other. The UI only ever sends `{ description }`.

**Fix:** zod schema + explicit field allowlist (`title`, `description`, `priority`,
`deadline`, `estimate_pomodoros`), and add an explicit `WITH CHECK (is_workspace_editor(workspace_id))`
to the task UPDATE policy.

### P1-3. Two competing invite systems

- `app/actions/team.ts::inviteMember` — token → `workspace_invites` row → Resend email →
  `/invite/[token]` → `accept_workspace_invite` RPC. This is the real flow, with an
  acceptance ledger and role checks.
- `app/actions/workspace-members.ts::inviteTeamMember` — looks the user up in `profiles` by
  email and inserts straight into `workspace_members`. No invite record, no consent, no
  email; fails with "Invited user not found in the system" for anyone who hasn't signed up.

Two paths, divergent semantics, one of them bypassing the consent step entirely.

**Fix:** pick the token flow. Delete `inviteTeamMember`, or reduce it to a thin wrapper that
creates an invite with a role. Audit call sites first.

### P1-4. Focus-session writers don't scope by user and log phantom activity

In `app/actions/focus.ts`:
- `incrementDistraction(sessionId)` performs **no auth check at all**.
- `completeFocusSessionCore`, `cancelFocusSessionCore`, `markSessionAbandoned` read the
  session with `.eq('id', ...)` only. `Sessions viewable by members` lets any workspace
  member read a colleague's session. The subsequent `UPDATE` is correctly blocked by
  `Sessions updatable by owner`, but the code does not check the update's result and still
  inserts a `task_activity` row attributed to `session.user_id`.

Net effect: any workspace member can forge "completed a focus session" / "cancelled focus
session" entries in another member's activity feed.

**Fix:** add `.eq('user_id', user.id)` to every focus-session read and write, require an
authenticated user in `incrementDistraction`, and check the update's `error`/row count
before writing activity.

### P1-5. `getWorkspaceRole()` trusts the raw cookie

`app/actions/roles.ts` reads `active_workspace_id` directly instead of going through
`pickActiveWorkspaceId`. A stale cookie (a workspace the user left) makes it return `null`
— "Permission denied" — while every page renders a different, valid workspace. This is the
same class of bug the shared resolver was introduced to kill.

**Fix:** route the no-argument path through `resolveActiveWorkspaceId()`.

### P1-6. SECURITY DEFINER functions without a pinned `search_path`

`is_workspace_member`, `is_workspace_admin`, `is_workspace_owner`, `is_workspace_editor`,
`handle_new_workspace`, `set_task_workspace_id`, `safe_timezone`, `get_due_rhythm_nudges`.
Supabase's own database linter flags `function_search_path_mutable` for exactly this: a
definer function that resolves unqualified names through the caller's `search_path`.

**Fix:** add `SET search_path = public, pg_temp` to each (as
`enforce_workspace_role_rules` and `process_due_focus_schedules` already do).

### P1-7. Global search is unscoped and unescaped

`components/app-shell/global-search.tsx`:

```ts
supabase.from('tasks').select(...).ilike('title', `%${search}%`)
```

Not filtered by workspace — results span every workspace the user belongs to, contradicting
the scoping work everywhere else. And the term is interpolated into a PostgREST filter
without escaping: `%` and `_` are wildcards, and `,` / `(` / `)` change how PostgREST parses
the filter value.

**Fix:** add `.eq('workspace_id', activeWorkspaceId)`, and escape `%`, `_`, `\` and quote
the value before interpolation.

### P1-8. Two smaller hardening items

- `active_workspace_id` cookie is set without `httpOnly` or `secure`
  (`app/actions/set-workspace.ts`, `app/actions/invites.ts`).
- `getSafeRedirectPath` (`lib/auth/redirect.ts`) rejects `//evil.com` but accepts
  `/\evil.com`; browsers normalise `\` to `/`. Reject backslashes and control characters.

---

## P2 — Medium

| # | Finding | Location |
|---|---|---|
| P2-1 | `supabase/schema.sql` is a stale, contradictory schema (`tasks.user_id`, `priority int`, no `project_id`). It is what P0-2 was written against. Delete it or rename to `legacy-schema.sql.bak` with a header. | `supabase/schema.sql` |
| P2-2 | `ALTER PUBLICATION supabase_realtime ADD TABLE` is not idempotent — re-applying the migration errors with "already member of publication". | `20260514093000`, `20260505072722`, `0008` |
| P2-3 | Realtime covers only `tasks`, `projects`, `focus_sessions`, `weekly_rhythm_logs`, `financial_entries`, `task_recurrence_rules`. `task_activity`, `task_comments`, `workspace_members` are absent, so the activity feed, comments and team roster never live-update. | `20260514093000` |
| P2-4 | Sync-queue dead-letter: items reaching `MAX_RETRIES` stay `failed` forever, keep the "pending changes" badge lit, and have no discard/inspect path. | `lib/offline/sync-engine.ts`, `components/offline/pending-changes-drawer.tsx` |
| P2-5 | `financial_entries.visibility` is decorative — RLS is `is_workspace_admin(...) OR created_by = auth.uid()`, so a `'workspace'`-visible entry is still hidden from non-admin members. Either enforce visibility in the policy or drop the column. | `0008_financial_tracker.sql` |
| P2-6 | Two recurring-task dialogs with different shapes; the settings one creates rules with no project, which P0-2 cannot insert. | `components/create-recurring-task-dialog.tsx` vs `app/dashboard/projects/[projectId]/recurring-task-dialog.tsx` |
| P2-7 | `getUpcomingSchedules()` is dead code and its `task:tasks(title)` alias doesn't match the consumer's `schedule.tasks?.title`. | `app/actions/scheduling.ts:163` |
| P2-8 | `AlarmManager` builds its dedupe key from `now.toISOString().slice(0,10)` (UTC) while comparing local `HH:MM` — reminders re-fire after UTC midnight for users west of UTC. `lib/rhythm-nudge.ts` already exports the correct `localDateKey`. Fired-reminder keys are also never pruned from localStorage. | `components/dashboard/alarm-manager.tsx` |
| P2-9 | Instant focus sessions (`task_id IS NULL`) are excluded from dashboard "Active Now" and stats, because those queries filter `.in('task_id', taskIds)`. | `app/dashboard/page.tsx` |
| P2-10 | `/dashboard/focus` session rows link to `/dashboard/projects/undefined` for instant sessions. | `app/dashboard/focus/page.tsx` |
| P2-11 | `.in('project_id', projectIds)` unguarded for the empty array on the team page (the dashboard guards it). Both also send unbounded id lists in the query string — this breaks past a few thousand rows; move to a workspace-scoped query or an RPC. | `app/dashboard/team/page.tsx`, `app/dashboard/page.tsx` |
| P2-12 | Gemini integration uses the deprecated `@google/generative-ai` SDK and the retired `gemini-1.5-flash` model. | `app/actions/ai-suggestions.ts`, `app/actions/ai-finances.ts` |

---

## P3 — Low / hygiene

- Duplicate components: `components/common/stat-card.tsx` vs `components/dashboard/stat-card.tsx`;
  `components/dashboard/start-focus-button.tsx` vs `components/focus/start-focus-button.tsx`.
- `next.config.ts` defines a `webpack:` hook, but builds run under Turbopack — dead config.
- `sitemap.ts` advertises `/demo`, which does not exist. `robots.ts` disallows `/projects`,
  `/focus-sessions`, `/settings`, `/onboarding` (none exist) and omits `/offline`,
  `/update-password`, `/forgot-password`.
- No `Content-Security-Policy` header; the other five security headers are set.
- Stray build artefacts committed/left in the repo root: `.next-dev.log`, `dev-server.log`,
  `test-check.js`, `tsconfig.tsbuildinfo`, `working-memory.md`.

---

## Fix order

**Phase 1 — restore dead features (P0).** Env keys → `verify_jwt` flags → recurring-task
insert → `process-schedules` embed → scheduled-session workspace/RLS + backfill → sync
executor error handling. Each is small and independent; the sync-executor fix should land
with tests.

**Phase 2 — correctness & authz (P1).** Finances workspace resolver → `updateTask`
allowlist + `WITH CHECK` → focus-session user scoping → `getWorkspaceRole` resolver →
`search_path` migration → search scoping/escaping → cookie flags + redirect hardening.
Collapse the duplicate invite system last, since it needs a call-site audit.

**Phase 3 — hardening (P2/P3).** Delete `schema.sql`, make publication migrations
idempotent, extend realtime coverage, dead-letter UI, visibility policy decision, Gemini SDK
upgrade, dedupe components, tidy the repo root.

**Test debt to close alongside:** the current suite would have caught none of the P0s. Add
(a) a schema-contract test that every column an edge function writes exists in the migration
set, (b) sync-executor tests asserting a rejected action leaves the queue item pending,
(c) an RLS test that a user can read their own `workspace_id IS NULL` focus session,
(d) a config test asserting `verify_jwt = false` for every `CRON_SECRET`-authenticated
function.
