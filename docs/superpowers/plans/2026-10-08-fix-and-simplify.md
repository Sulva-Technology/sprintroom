# SprintRoom — Fix & Simplify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SprintRoom work reliably as a team + personal management app, and make it simpler to use: one obvious place for *my* work, one obvious place for *the team*. Then close the gaps that matter versus Linear (cycles, a command bar, an inbox, a fast board, labels) without cloning Linear.

**Architecture:** No big rewrites. Fix the broken gates and the known wrong-workspace and safety bugs first. Then simplify the UI around two spaces: **Home = "My Day"** (personal) and **Team** (members, roles, pulse). Fill the missing team and personal features (member management, task editing, quick add, project edit/delete, live updates).

Phase F then adds the execution layer:
- cycles, with database-native rollover
- ⌘K actions and single-key shortcuts
- an in-app inbox fed by database triggers
- drag-and-drop with optimistic moves and board filters
- labels

Every new rule lives in a small pure function in `lib/` with a Vitest test. Every new table gets RLS and a test in the RLS harness. Server actions stay thin, and RLS remains the real enforcement.

**Tech Stack:** Next 16 (Turbopack), React 19 server components (`useOptimistic`), Supabase (Postgres + RLS + Realtime + pg_cron + Edge Functions), Vitest + jsdom, Tailwind, base-ui/shadcn components, `cmdk`, `sonner` toasts, `zod`. One new dependency: `@dnd-kit/core@6.3.1` (Task 17).

**Spec:**
- Findings from the 2026-10-08 code review (in this session)
- `functionality-audit-2026-08-14.md`
- the "SprintRoom compared with Linear" analysis (pasted 2026-10-08, summarised in "Positioning" below)

Read `CLAUDE.md` before starting. It is the agent contract and overrides anything here.

## Global Constraints

- Read `CLAUDE.md` first. Key rules restated:
  - `supabase/schema.sql` is STALE. Never read it as truth and never edit it. The live schema is `supabase/migrations/*` in filename order.
  - `tasks` has **no `user_id`**. Authorship is `created_by`, the assignee is `owner_id`, `priority` is **text**, `project_id` is NOT NULL, and `workspace_id` is set by trigger (never set it by hand).
  - Workspace-scoped reads MUST use `resolveActiveWorkspaceId()` from `lib/workspace/active-workspace.ts`.
  - New migrations only, named `YYYYMMDDHHMMSS_description.sql`. Never edit an applied migration.
  - Never add or "fix" the `webpack()` block in `next.config.ts`.
  - Use `proxy.ts`, not `middleware.ts`.
- Every bugfix lands with a test that fails before the fix and passes after. Prefer testing pure functions over mocking Supabase.
- Definition of done, in this order:
  `rm -rf .next && npx tsc --noEmit && npx eslint . && npx vitest run && npx next build`
- Never claim "fixed" or "works" without pasting the command output.
- Server actions that can be blocked by RLS must detect a **zero-row** result (`.select(...)` after `update`/`delete`) and return a clear error. A silent RLS no-op is not success.
- Server action return shape for NEW actions: `{ success: true } | { success: false; error: string }`.

---

## The simplification (read this first)

The app is hard to use because every screen mixes "me" and "the team", and the navigation exposes 8 places. The plan applies five rules.

**Rule 1 — Two spaces, not eight.** Every screen belongs to **Me** or **Team**.

| Before | After |
|---|---|
| Dashboard: team score ring, team stats, "Your team completed…", my queue, blockers, active now | **Home = My Day**: overdue, today, up next (only *my* tasks), quick add, start focus, pending-invites banner |
| Team Pulse: stats only, no way to manage anyone | **Team**: members panel (roles, remove, leave) + the existing pulse/blockers/activity |
| Sidebar has 8 links; mobile has 5 different ones and **no way to reach Settings, Focus or Invites** | One shared nav list. Desktop: Home, Projects, Team, Rhythms, Focus, Finances, Settings. Mobile: Home, Projects, Team, Rhythms, **More** |
| Invites has its own nav item | Banner on Home when you have pending invites, plus a link in More and in the user menu |

**Rule 2 — One way to do each thing.**
- One invite flow: the token flow in `app/actions/team.ts`. Delete `app/actions/workspace-members.ts`.
- One assign action: `assignOwner`. Delete `assignTaskOwner`.
- One search path: a server action, scoped to the active workspace.
- One stat card: delete `components/common/stat-card.tsx`.

**Rule 3 — Adding a task never asks "which project?" first.** Quick add on Home puts the task in the workspace's `General` project (created if missing), assigned to me, status `today`. The project board is still there for structured work.

**Rule 4 — Everything you can see, you can edit.** In the task drawer you can edit title, priority, due date and assignee, including "Unassigned". A project can be renamed and deleted by the people RLS allows.

**Rule 5 — Changes show up without refresh.** Comments, activity and member changes join the realtime feed.

**Rule 6 — Track execution, don't clone Linear.** Linear tracks work; SprintRoom tracks *execution*: whether people are focused, unblocked and keeping rhythm. Keep and lean on what Linear doesn't have:
- focus sessions
- team pulse (blockers, silent work)
- weekly rhythms and nudges
- offline-first PWA
- an explicit blocked status with a reason

Close only the gaps that stop a team from running its week in the app.

| Linear gap | Where this plan closes it | Kept simple by |
|---|---|---|
| No sprints/cycles (the product is called *Sprint*Room) | Task 14 | One running cycle per workspace. Rollover is a pg_cron SQL function (same pattern as scheduled focus), not another edge function. Cycle gets a nav slot; Rhythms moves to More on mobile. |
| ⌘K only searches | Task 15 | Actions group in the existing palette. Three global keys (`⌘K`, `/`, `c`) and four drawer keys (`s` `a` `p` `d`). |
| No in-app inbox | Task 16 | DB triggers write `notifications` on assignment, comment and blocked. A bell in the top bar, not a nav item. |
| Board is slow: no drag-and-drop, no optimistic moves, no filters | Task 17 | `@dnd-kit/core` only. `useOptimistic`. Three filters (owner, priority, due) plus cycle. |
| No labels | Task 18 | Workspace labels, toggled in the drawer, one label filter on the board. |
| No cross-project "My work" | Task 9 (Home = My Day) | Already planned: assigned to me, or created by me and unassigned, across all projects in the workspace. |
| ⌘K search spans every workspace | Task 4 | Already planned. |

**Out of scope:**
- CSP header
- Gemini SDK migration
- Money stored as integer cents
- Dead-letter UI for the sync queue
- `financial_entries.visibility` policy
- Project archive (delete is enough for now)
- Push notification on assignment (the inbox and Home cover it)
- Project status updates ("on track / at risk")
- Initiatives grouping
- Git integration (only matters if dev teams become the target)
- **Turning the `today` status into a personal-plan flag.** The Linear analysis is right that `today` mixes planning with state. But changing it touches the board columns, Home grouping, the offline sync queue and every stored task at once. Ship cycles first (Task 14), watch how teams use "today" vs "this cycle", and then write a separate migration plan.

---

## File map

**Create**
- `docs/DEPLOY.md` — go-live checklist (Task 2)
- `lib/search/ilike.ts` — escape a search term for `ilike` (Task 4)
- `app/actions/search.ts` — workspace-scoped search server action (Task 4)
- `supabase/migrations/20261008090000_pin_definer_search_path.sql` (Task 6)
- `lib/navigation.ts` — the single nav config (Task 8)
- `app/dashboard/more/page.tsx` — mobile "More" page (Task 8)
- `lib/tasks/my-day.ts` — "my tasks" grouping + timezone date key (Task 9)
- `lib/tasks/default-project.ts` — pick the quick-add project (Task 9)
- `components/home/my-day-list.tsx`, `components/home/quick-add-task.tsx` (Task 9)
- `lib/tasks/deadline.ts` — date-input ⇄ deadline conversion (Task 10)
- `components/tasks/task-edit-fields.tsx` (Task 10)
- `lib/team/member-permissions.ts` — who can change or remove whom (Task 11)
- `app/actions/members.ts` — role change, remove, leave (Task 11)
- `components/team/members-panel.tsx` (Task 11)
- `lib/projects/permissions.ts` (Task 12)
- `app/dashboard/projects/[projectId]/project-settings-dialog.tsx` (Task 12)
- `supabase/migrations/20261008090100_realtime_team_tables.sql` (Task 13)
- `lib/dates.ts` — `addDaysToKey` for `YYYY-MM-DD` keys (Task 14)
- `supabase/migrations/20261008100000_cycles.sql`, `lib/cycles/cycle.ts`, `app/actions/cycles.ts`, `app/dashboard/cycle/page.tsx`, `components/cycles/start-cycle-form.tsx` (Task 14)
- `lib/command-actions.ts`, `lib/shortcuts.ts` (Task 15)
- `supabase/migrations/20261008110000_notifications.sql`, `lib/notifications.ts`, `app/actions/notifications.ts`, `app/dashboard/inbox/page.tsx`, `components/inbox/inbox-list.tsx`, `components/app-shell/inbox-bell.tsx` (Task 16)
- `lib/tasks/board.ts` — `planStatusMove`, `filterBoardTasks` (Task 17)
- `app/dashboard/projects/[projectId]/board-filters.tsx` (Task 17)
- `supabase/migrations/20261008120000_labels.sql`, `lib/labels.ts`, `app/actions/labels.ts`, `components/tasks/label-picker.tsx` (Task 18)
- `__tests__/rls/execution-layer.test.ts` — RLS + trigger proofs for cycles, notifications and labels (Tasks 14, 16, 18)
- Tests: one `__tests__/*.test.ts` per pure module (named in each task)

**Modify**
- `vitest.config.ts`, `tsconfig.json`, `package.json` (Task 1)
- `app/actions/roles.ts`, `app/dashboard/finances/page.tsx`, `CLAUDE.md` (Task 3)
- `components/app-shell/global-search.tsx` (Task 4)
- `lib/auth/redirect.ts`, `lib/workspace/active-workspace.ts`, `app/actions/set-workspace.ts`, `app/actions/invites.ts` (Task 5)
- `lib/rhythm-nudge.ts`, `components/dashboard/alarm-manager.tsx`, `app/dashboard/focus/page.tsx` (Task 7)
- `components/app-shell/sidebar.tsx`, `components/app-shell/mobile-nav.tsx`, `components/app-shell/user-menu.tsx` (Task 8)
- `app/dashboard/page.tsx` (rewritten), `app/actions/tasks.ts` (Tasks 9, 10)
- `components/tasks/task-detail-drawer.tsx`, `app/actions/task-details.ts`, `lib/tasks/updatable-fields.ts` (Task 10)
- `app/dashboard/team/page.tsx` (Task 11)
- `app/actions/projects.ts`, `app/dashboard/projects/[projectId]/page.tsx` (Task 12)
- `lib/realtime-subscriptions.ts`, `lib/realtime-subscriptions.test.ts` (Tasks 13, 16)
- `lib/navigation.ts` + `__tests__/navigation.test.ts` (Task 14 adds Cycle)
- `lib/tasks/updatable-fields.ts` (Task 14 adds `cycle_id`), `app/actions/task-fetcher.ts` (Tasks 14, 18)
- `components/tasks/task-edit-fields.tsx`, `components/tasks/task-detail-drawer.tsx` (Tasks 14, 15, 18)
- `components/app-shell/global-search.tsx` (Task 15), `components/app-shell/topbar.tsx`, `app/dashboard/layout.tsx`, `hooks/use-realtime.ts`, `components/app-shell/realtime-pulse.tsx` (Task 16)
- `app/dashboard/projects/[projectId]/board-client.tsx`, `board-column.tsx`, `task-card.tsx`, `status-menu.tsx`, `page.tsx` (Tasks 17, 18)
- `package.json` (Task 17: `@dnd-kit/core`)

**Delete**
- `app/actions/workspace-members.ts` (Task 11)
- `components/common/stat-card.tsx`, plus these components once unused (Task 9):
  - `components/dashboard/focus-score-ring.tsx`
  - `components/dashboard/blockers-panel.tsx`
  - `components/dashboard/active-now.tsx`
  - `components/dashboard/my-focus-queue.tsx`
- `getUpcomingSchedules` in `app/actions/scheduling.ts` (Task 19)

---

## Phase A — Get the gates green

### Task 1: Exclude the committed proof harness from the default gates

**Why:** Commit `c7a831a` added `__tests__/p0proof/`. It is a one-off proof harness: snapshot copies of old Deno code plus its own `vitest.p0.config.ts`. It currently breaks the gates:
- `tsc` reports 17 errors, e.g. `Cannot find name 'Deno'`.
- `vitest run` has 6 failures, e.g. `Only URLs with a scheme in: file and data are supported by the default ESM loader`.

**Files:**
- Modify: `vitest.config.ts`
- Modify: `tsconfig.json:27`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: none
- Produces: `npm run test:p0` runs the harness with its own config. The default gates ignore it.

- [ ] **Step 1: Confirm the failure (this is the "failing test")**

Run: `rm -rf .next && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `17`

Run: `npx vitest run 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  3 failed | 24 passed (27)` and `Tests  6 failed | 101 passed (107)`

- [ ] **Step 2: Exclude from Vitest**

In `vitest.config.ts`, change the `exclude` line to:

```ts
    exclude: ['**/node_modules/**', '**/dist/**', '__tests__/rls/**', '__tests__/p0proof/**'],
```

and replace the comment above it with:

```ts
    // The RLS harness needs a live local stack (`supabase start`, i.e. Docker) and
    // fails loudly rather than skipping, so it cannot sit in the default gate.
    // Run it with `npm run test:rls` once the stack is up.
    // `__tests__/p0proof/` is a one-off proof harness with its own config
    // (Deno stubs, snapshot copies of old code). Run it with `npm run test:p0`.
```

- [ ] **Step 3: Exclude from tsc**

In `tsconfig.json`, change:

```json
  "exclude": ["node_modules", "supabase"]
```

to:

```json
  "exclude": ["node_modules", "supabase", "__tests__/p0proof"]
```

- [ ] **Step 4: Add the opt-in script**

In `package.json` `"scripts"`, add after `"test:rls"`:

```json
    "test:p0": "vitest run --config __tests__/p0proof/vitest.p0.config.ts"
```

(Mind the comma on the preceding line.)

- [ ] **Step 5: Run the full gate**

Run: `rm -rf .next && npx tsc --noEmit && npx eslint . && npx vitest run && npx next build`
Expected: tsc no output, eslint no output, `Tests  101 passed`, build succeeds. Paste the output.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tsconfig.json package.json
git commit -m "chore: keep p0proof harness out of default tsc/vitest gates"
```

---

## Phase B — Go live (the user runs this; an agent writes the doc)

### Task 2: Write the deploy checklist

**Why:** Much of what "doesn't work" in production is code that was never deployed:
- migrations not pushed (role permissions, focus pause, scheduled auto-start)
- edge functions not deployed
- secrets unset

Also, migration `20260505072722_add_recurring_tasks.sql` schedules a cron job whose URL contains the literal placeholder `[PROJECT-REF]`, so recurring tasks can never fire until that job is re-scheduled.

**Files:**
- Create: `docs/DEPLOY.md`

**Interfaces:** none (documentation)

- [ ] **Step 1: Write `docs/DEPLOY.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add deploy checklist incl. fix for placeholder recurring-task cron job"
```

---

## Phase C — Fix wrong-workspace and safety bugs

### Task 3: Roles and Finances use the shared workspace resolver

**Why:**
- `getWorkspaceRole()` (`app/actions/roles.ts:22`) trusts the raw cookie. A stale cookie makes it return `null` ("Permission denied") while every page shows a valid workspace.
- `app/dashboard/finances/page.tsx:21` picks an arbitrary workspace with an unordered `limit(1)`. `CLAUDE.md` lists it as a known violation.

**Files:**
- Modify: `app/actions/roles.ts`
- Modify: `app/dashboard/finances/page.tsx:18-42`
- Modify: `CLAUDE.md` (remove the "Known remaining violations" entry)
- Test: `__tests__/workspace-role-resolver.test.ts`

**Interfaces:**
- Consumes: `resolveActiveWorkspaceId(): Promise<string | undefined>` from `lib/workspace/active-workspace.ts`
- Produces: `getWorkspaceRole(workspaceId?: string): Promise<WorkspaceRole | null>`. Same signature, but the no-arg path now goes through the resolver.

- [ ] **Step 1: Write the failing test**

Create `__tests__/workspace-role-resolver.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * P1-5 regression: getWorkspaceRole() read the raw `active_workspace_id`
 * cookie. A stale cookie (a workspace the user left) returned null —
 * "Permission denied" — while every page rendered a different, valid
 * workspace via resolveActiveWorkspaceId(). Before the fix this test got
 * `null`; after, it gets the role in the workspace the resolver falls back to.
 */

const A = '11111111-1111-1111-1111-111111111111'
const STALE = '99999999-9999-9999-9999-999999999999'

const memberships = [{ workspace_id: A, role: 'admin', created_at: '2026-01-01T00:00:00Z' }]
let cookieValue: string | undefined = STALE

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'active_workspace_id' && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => {
      const filters: Record<string, unknown> = {}
      const q: any = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filters[col] = val
          return q
        },
        limit: () => q,
        order: async () => ({
          data: memberships.map((m) => ({ workspace_id: m.workspace_id, created_at: m.created_at })),
        }),
        maybeSingle: async () => {
          const row = memberships.find((m) => m.workspace_id === filters.workspace_id)
          return { data: row ? { role: row.role } : null }
        },
      }
      return q
    },
  }),
}))

import { getWorkspaceRole } from '@/app/actions/roles'

describe('getWorkspaceRole without an explicit workspace', () => {
  beforeEach(() => {
    cookieValue = STALE
  })

  it('ignores a stale cookie and uses the resolved active workspace', async () => {
    expect(await getWorkspaceRole()).toBe('admin')
  })

  it('uses the resolved workspace when no cookie is set', async () => {
    cookieValue = undefined
    expect(await getWorkspaceRole()).toBe('admin')
  })

  it('still honours an explicit workspace id', async () => {
    expect(await getWorkspaceRole(STALE)).toBeNull()
    expect(await getWorkspaceRole(A)).toBe('admin')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/workspace-role-resolver.test.ts`
Expected: FAIL. The first test receives `null`, expected `'admin'`.

- [ ] **Step 3: Implement**

Replace the body of `app/actions/roles.ts` above `canEditWorkspace` with:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * The current user's role in the given workspace (or the active one, resolved
 * through the shared cookie-then-stable-order resolver). Returns null when not a
 * member. RLS is the real enforcement — these helpers exist so the UI can hide
 * controls the user can't use, and so server actions can fail with a clear
 * message instead of a silent RLS rejection.
 */
export async function getWorkspaceRole(workspaceId?: string): Promise<WorkspaceRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const wsId = workspaceId ?? (await resolveActiveWorkspaceId())
  if (!wsId) return null

  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', wsId)
    .maybeSingle()

  return (data?.role as WorkspaceRole) ?? null
}
```

(Keep `canEditWorkspace` and `isWorkspaceAdmin` unchanged below it. The `cookies` import is no longer used, so remove it.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/workspace-role-resolver.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Fix the Finances page**

In `app/dashboard/finances/page.tsx`:
- add imports:
  ```ts
  import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
  import { getWorkspaceRole } from '@/app/actions/roles'
  ```
- replace everything from `// 1. Get workspace membership` through `const isAdmin = ...` with:

```ts
  // 1. Resolve the ACTIVE workspace through the shared resolver (same one the
  // switcher, dashboard, projects and team pages use).
  const workspaceId = await resolveActiveWorkspaceId()

  if (!workspaceId) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>No Workspace</AlertTitle>
          <AlertDescription>
            You are not a member of any workspace. Please create or join a workspace to track finances.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const role = await getWorkspaceRole(workspaceId)
  const isAdmin = role === 'owner' || role === 'admin'
```

If `createClient` / `supabase` is now only used for `auth.getUser()`, keep it. If it becomes unused, remove it so eslint stays clean.

- [ ] **Step 6: Prove no hand-rolled workspace pickers remain**

Run: `grep -rn "from('workspace_members')" app components | grep "limit(1)"`
Expected: no output.

- [ ] **Step 7: Update `CLAUDE.md`**

In the "Workspace scoping" section, delete these lines:

```
Known remaining violations — fix them when you touch the file, don't copy them:
- [app/dashboard/finances/page.tsx:21](app/dashboard/finances/page.tsx#L21)
```

- [ ] **Step 8: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`
Expected: all clean/pass. Paste the output.

```bash
git add app/actions/roles.ts app/dashboard/finances/page.tsx CLAUDE.md __tests__/workspace-role-resolver.test.ts
git commit -m "fix: roles and finances resolve the active workspace through the shared resolver"
```

---

### Task 4: Global search becomes a scoped, escaped server action

**Why:** `components/app-shell/global-search.tsx:42` queries every workspace the user belongs to, and passes the raw term to `ilike`, where `%` and `_` act as wildcards. Moving the search to a server action lets it use `resolveActiveWorkspaceId()`, like every other surface.

Note: supabase-js `.ilike(col, value)` sends `col=ilike.<value>` as a URL parameter, so commas and parentheses are harmless there (they only matter inside `.or()` strings). Escaping `\`, `%` and `_` is sufficient.

**Files:**
- Create: `lib/search/ilike.ts`
- Create: `app/actions/search.ts`
- Modify: `components/app-shell/global-search.tsx:1-55`
- Test: `__tests__/search-ilike.test.ts`

**Interfaces:**
- Produces: `toIlikePattern(term: string): string`
- Produces: `searchWorkspace(term: string): Promise<{ tasks: { id: string; title: string; project_id: string }[]; projects: { id: string; name: string }[] }>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/search-ilike.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toIlikePattern } from '@/lib/search/ilike'

describe('toIlikePattern', () => {
  it('wraps a plain term for a contains match', () => {
    expect(toIlikePattern('launch')).toBe('%launch%')
  })

  it('escapes LIKE wildcards so they match literally', () => {
    expect(toIlikePattern('100%')).toBe('%100\\%%')
    expect(toIlikePattern('a_b')).toBe('%a\\_b%')
  })

  it('escapes the escape character itself', () => {
    expect(toIlikePattern('c:\\temp')).toBe('%c:\\\\temp%')
  })

  it('trims surrounding whitespace', () => {
    expect(toIlikePattern('  plan  ')).toBe('%plan%')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/search-ilike.test.ts`
Expected: FAIL. `Failed to resolve import "@/lib/search/ilike"`.

- [ ] **Step 3: Implement the helper**

Create `lib/search/ilike.ts`:

```ts
/**
 * Turn free text into a literal "contains" pattern for Postgres ILIKE.
 * `%` and `_` are LIKE wildcards and `\` is the default escape character, so
 * all three are escaped; without this, searching "100%" matched everything.
 */
export function toIlikePattern(term: string): string {
  const escaped = term.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
  return `%${escaped}%`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/search-ilike.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create the server action**

Create `app/actions/search.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { toIlikePattern } from '@/lib/search/ilike'

export type SearchResults = {
  tasks: { id: string; title: string; project_id: string }[]
  projects: { id: string; name: string }[]
}

const EMPTY: SearchResults = { tasks: [], projects: [] }

/** Search tasks and projects in the ACTIVE workspace only. */
export async function searchWorkspace(term: string): Promise<SearchResults> {
  const query = term.trim().slice(0, 100)
  if (query.length < 2) return EMPTY

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return EMPTY

  const supabase = await createClient()
  const pattern = toIlikePattern(query)

  const [tasks, projects] = await Promise.all([
    supabase.from('tasks').select('id, title, project_id').eq('workspace_id', workspaceId).ilike('title', pattern).limit(5),
    supabase.from('projects').select('id, name').eq('workspace_id', workspaceId).ilike('name', pattern).limit(5),
  ])

  return { tasks: tasks.data ?? [], projects: projects.data ?? [] }
}
```

- [ ] **Step 6: Wire the component to the action**

In `components/app-shell/global-search.tsx`:
- remove `import { createClient } from '@/lib/supabase/client'` and the `const supabase = createClient()` line
- add `import { searchWorkspace } from '@/app/actions/search'`
- replace the debounced effect with:

```tsx
  // Debounced search effect
  React.useEffect(() => {
    if (!search) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ tasks: [], projects: [] })
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await searchWorkspace(search))
      } catch {
        // Offline or server error: show no results rather than crash the palette.
        setResults({ tasks: [], projects: [] })
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [search])
```

- [ ] **Step 7: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`
Expected: clean/pass. Paste the output.

```bash
git add lib/search/ilike.ts app/actions/search.ts components/app-shell/global-search.tsx __tests__/search-ilike.test.ts
git commit -m "fix: global search scoped to active workspace and LIKE-escaped"
```

---

### Task 5: Redirect and cookie hardening

**Why:**
- `getSafeRedirectPath` accepts `/\evil.com`. Browsers normalise `\` to `/`, so that becomes an open redirect.
- The `active_workspace_id` cookie is set without `httpOnly`/`secure`. No client code reads `document.cookie` (verified by grep), so `httpOnly` is safe to add.

**Files:**
- Modify: `lib/auth/redirect.ts`
- Modify: `lib/workspace/active-workspace.ts` (add the options constant)
- Modify: `app/actions/set-workspace.ts:7-11`
- Modify: `app/actions/invites.ts:44`
- Test: `__tests__/safe-redirect.test.ts`

**Interfaces:**
- Produces: `ACTIVE_WORKSPACE_COOKIE_OPTIONS` exported from `lib/workspace/active-workspace.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/safe-redirect.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

import { getSafeRedirectPath } from '@/lib/auth/redirect'
import { ACTIVE_WORKSPACE_COOKIE_OPTIONS } from '@/lib/workspace/active-workspace'

describe('getSafeRedirectPath', () => {
  it('allows same-site paths', () => {
    expect(getSafeRedirectPath('/dashboard/team')).toBe('/dashboard/team')
    expect(getSafeRedirectPath('/invite/abc?x=1')).toBe('/invite/abc?x=1')
  })

  it('rejects protocol-relative and absolute URLs', () => {
    expect(getSafeRedirectPath('//evil.com')).toBe('/dashboard')
    expect(getSafeRedirectPath('https://evil.com')).toBe('/dashboard')
  })

  it('rejects backslash tricks that browsers normalise to //', () => {
    expect(getSafeRedirectPath('/\\evil.com')).toBe('/dashboard')
    expect(getSafeRedirectPath('/\\/evil.com')).toBe('/dashboard')
  })

  it('rejects control characters', () => {
    expect(getSafeRedirectPath('/\tevil')).toBe('/dashboard')
    expect(getSafeRedirectPath('/\nevil')).toBe('/dashboard')
  })
})

describe('active workspace cookie options', () => {
  it('is httpOnly, lax and site-wide', () => {
    expect(ACTIVE_WORKSPACE_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/safe-redirect.test.ts`
Expected: FAIL. The backslash case returns `'/\\evil.com'`, and `ACTIVE_WORKSPACE_COOKIE_OPTIONS` is undefined.

- [ ] **Step 3: Implement**

`lib/auth/redirect.ts`:

```ts
// Backslashes are normalised to "/" by browsers ("/\evil.com" → "//evil.com"),
// and control characters can smuggle the same trick, so both are rejected.
const UNSAFE_REDIRECT_CHARS = /[\\\u0000-\u001f\u007f]/

export function getSafeRedirectPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = '/dashboard'
) {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (UNSAFE_REDIRECT_CHARS.test(value)) return fallback
  return value
}
```

In `lib/workspace/active-workspace.ts`, under `ACTIVE_WORKSPACE_COOKIE`, add:

```ts
/** Options for every write of the active-workspace cookie. Nothing on the client
 *  reads it (the server resolves it), so it is httpOnly. */
export const ACTIVE_WORKSPACE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
}
```

In `app/actions/set-workspace.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { ACTIVE_WORKSPACE_COOKIE, ACTIVE_WORKSPACE_COOKIE_OPTIONS } from '@/lib/workspace/active-workspace'

export async function setActiveWorkspaceAction(workspaceId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, ACTIVE_WORKSPACE_COOKIE_OPTIONS)
  return { success: true }
}
```

In `app/actions/invites.ts` around line 44, replace the `cookieStore.set('active_workspace_id', workspaceId, { ... })` call with `cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, ACTIVE_WORKSPACE_COOKIE_OPTIONS)`, and add the same import.

Then run `grep -rn "set('active_workspace_id'\|set(\"active_workspace_id\"" app lib components`. Expected: no output. If anything remains, convert it the same way.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/safe-redirect.test.ts __tests__/auth-callback.test.ts`
Expected: PASS

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/auth/redirect.ts lib/workspace/active-workspace.ts app/actions/set-workspace.ts app/actions/invites.ts __tests__/safe-redirect.test.ts
git commit -m "fix: reject backslash/control-char redirects; httpOnly workspace cookie"
```

---

### Task 6: Pin `search_path` on SECURITY DEFINER helpers

**Why:** Eight definer functions resolve unqualified names through the caller's `search_path`. Supabase's linter flags this as `function_search_path_mutable`. `ALTER FUNCTION ... SET` fixes it without redefining any function body.

**Files:**
- Create: `supabase/migrations/20261008090000_pin_definer_search_path.sql`

**Interfaces:** none

- [ ] **Step 1: Write the migration**

```sql
-- Pin search_path on SECURITY DEFINER helpers (Supabase linter:
-- function_search_path_mutable). ALTER ... SET leaves each body untouched.
ALTER FUNCTION public.is_workspace_member(uuid)  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_admin(uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_owner(uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_editor(uuid)  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_workspace()     SET search_path = public, pg_temp;
ALTER FUNCTION public.set_task_workspace_id()    SET search_path = public, pg_temp;
ALTER FUNCTION public.safe_timezone(text)        SET search_path = public, pg_temp;
ALTER FUNCTION public.get_due_rhythm_nudges()    SET search_path = public, pg_temp;
```

- [ ] **Step 2: Verify against a local stack (needs Docker)**

Run: `npx supabase start && npx supabase db reset && npm run test:rls`
Expected:
- `db reset` applies all migrations with no error.
- The RLS harness passes.

If Docker is unavailable, say so explicitly in the report. Do NOT claim this was verified.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261008090000_pin_definer_search_path.sql
git commit -m "fix(db): pin search_path on SECURITY DEFINER helpers"
```

---

### Task 7: Reminders dedupe on the local date; focus history link

**Why:**
- `components/dashboard/alarm-manager.tsx:80` builds the "already fired" key from the UTC date while comparing local `HH:MM`. Users west of UTC get reminders twice a day. The fired keys are also never pruned.
- `app/dashboard/focus/page.tsx:166` links instant sessions to `/dashboard/projects/undefined`.

**Files:**
- Modify: `lib/rhythm-nudge.ts` (add two helpers)
- Modify: `components/dashboard/alarm-manager.tsx:77-90`
- Modify: `app/dashboard/focus/page.tsx:166-168`
- Test: `__tests__/rhythm-nudge.test.ts` (append)

**Interfaces:**
- Consumes: `localDateKey(now: Date): string` (already in `lib/rhythm-nudge.ts`)
- Produces:
  - `reminderFiredKey(reminderId: string, now: Date): string`
  - `staleReminderKeys(keys: string[], now: Date): string[]`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/rhythm-nudge.test.ts` (merge the import into the existing import from `@/lib/rhythm-nudge`, or the relative path the file already uses):

```ts
import { reminderFiredKey, staleReminderKeys } from '@/lib/rhythm-nudge'

describe('reminder dedupe keys', () => {
  it('uses the LOCAL calendar date, not the UTC one', () => {
    // 23:30 local on 7 Oct. For anyone west of UTC, toISOString() is already 8 Oct.
    const lateEvening = new Date(2026, 9, 7, 23, 30)
    expect(reminderFiredKey('r1', lateEvening)).toBe('sprintroom-reminder-fired-r1-2026-10-07')
  })

  it('lists only reminder keys from previous days for pruning', () => {
    const now = new Date(2026, 9, 8, 9, 0)
    const keys = [
      'sprintroom-reminder-fired-r1-2026-10-07',
      'sprintroom-reminder-fired-r2-2026-10-08',
      'sprintroom-notify-enabled',
    ]
    expect(staleReminderKeys(keys, now)).toEqual(['sprintroom-reminder-fired-r1-2026-10-07'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/rhythm-nudge.test.ts`
Expected: FAIL. `reminderFiredKey is not a function` (or an import error).

- [ ] **Step 3: Implement**

Append to `lib/rhythm-nudge.ts`:

```ts
const REMINDER_FIRED_PREFIX = 'sprintroom-reminder-fired-'

/** localStorage key marking a reminder as fired today (device-local date). */
export function reminderFiredKey(reminderId: string, now: Date): string {
  return `${REMINDER_FIRED_PREFIX}${reminderId}-${localDateKey(now)}`
}

/** Reminder-fired keys from earlier days, safe to delete. */
export function staleReminderKeys(keys: string[], now: Date): string[] {
  const today = localDateKey(now)
  return keys.filter((k) => k.startsWith(REMINDER_FIRED_PREFIX) && !k.endsWith(today))
}
```

In `components/dashboard/alarm-manager.tsx`:
- add `reminderFiredKey, staleReminderKeys` to the existing import from `@/lib/rhythm-nudge`
- in `check()`, delete the line `const dateKey = now.toISOString().slice(0, 10)`
- change `const firedKey = \`sprintroom-reminder-fired-${reminder.id}-${dateKey}\`` to `const firedKey = reminderFiredKey(reminder.id, now)`
- at the start of the same `useEffect` that defines `check`, before `refresh().then(...)`, add:

```ts
    try {
      const keys = Object.keys(localStorage)
      for (const key of staleReminderKeys(keys, new Date())) localStorage.removeItem(key)
    } catch {
      // Storage unavailable — nothing to prune.
    }
```

In `app/dashboard/focus/page.tsx` (~line 166), wrap the arrow button so it only renders when there is a project:

```tsx
                    {task?.project_id && (
                      <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5" render={<Link href={`/dashboard/projects/${task.project_id}`} />}>
                         <ArrowRight className="w-5 h-5" />
                      </Button>
                    )}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run __tests__/rhythm-nudge.test.ts`
Expected: PASS

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/rhythm-nudge.ts components/dashboard/alarm-manager.tsx app/dashboard/focus/page.tsx __tests__/rhythm-nudge.test.ts
git commit -m "fix: reminder dedupe uses local date and prunes old keys; no /projects/undefined link"
```

---

## Phase D — Simplify

### Task 8: One navigation config, a "More" page, no dead buttons

**Why:**
- The sidebar and mobile nav keep separate, different lists. Mobile users cannot reach Settings, Focus or Invites at all.
- The sidebar's "Recent Projects" `+` button does nothing.

**Files:**
- Create: `lib/navigation.ts`
- Create: `app/dashboard/more/page.tsx`
- Modify: `components/app-shell/sidebar.tsx:5-19,44-50` and the `+` button (~line 68)
- Modify: `components/app-shell/mobile-nav.tsx`
- Modify: `components/app-shell/user-menu.tsx` (add Invites item)
- Test: `__tests__/navigation.test.ts`

**Interfaces:**
- Produces:
  - `NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean }`
  - `NAV_ITEMS: NavItem[]`
  - `mobileNavItems(): NavItem[]`
  - `moreNavItems(): NavItem[]`
  - `isNavActive(pathname: string, href: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `__tests__/navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, mobileNavItems, moreNavItems, isNavActive } from '@/lib/navigation'

describe('navigation', () => {
  it('fits the mobile bar (max 5) and ends with More', () => {
    const items = mobileNavItems()
    expect(items.length).toBeLessThanOrEqual(5)
    expect(items.at(-1)?.href).toBe('/dashboard/more')
  })

  it('makes every destination reachable on mobile (bar or More page)', () => {
    const reachable = new Set([...mobileNavItems(), ...moreNavItems()].map((i) => i.href))
    for (const item of NAV_ITEMS) expect(reachable.has(item.href)).toBe(true)
    expect(reachable.has('/dashboard/invites')).toBe(true)
  })

  it('has no duplicate destinations', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('matches Home exactly and sections by prefix', () => {
    expect(isNavActive('/dashboard', '/dashboard')).toBe(true)
    expect(isNavActive('/dashboard/team', '/dashboard')).toBe(false)
    expect(isNavActive('/dashboard/projects/abc', '/dashboard/projects')).toBe(true)
    expect(isNavActive('/dashboard/projectsx', '/dashboard/projects')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/navigation.test.ts`
Expected: FAIL (import cannot be resolved)

- [ ] **Step 3: Implement `lib/navigation.ts`**

```ts
import {
  House,
  FolderKanban,
  Users,
  Repeat2,
  Timer,
  Wallet,
  Settings,
  MailPlus,
  Menu,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean }

/**
 * The single navigation list. Desktop shows all of it; mobile shows the
 * `mobile: true` items plus "More", and the More page lists the rest.
 * Two spaces: Home (me) and Team (us) — everything else supports one of them.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House, mobile: true },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban, mobile: true },
  { href: '/dashboard/team', label: 'Team', icon: Users, mobile: true },
  { href: '/dashboard/rhythms', label: 'Rhythms', icon: Repeat2, mobile: true },
  { href: '/dashboard/focus', label: 'Focus', icon: Timer, mobile: false },
  { href: '/dashboard/finances', label: 'Finances', icon: Wallet, mobile: false },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, mobile: false },
]

const MORE_ITEM: NavItem = { href: '/dashboard/more', label: 'More', icon: Menu, mobile: true }
const INVITES_ITEM: NavItem = { href: '/dashboard/invites', label: 'Invites', icon: MailPlus, mobile: false }

export function mobileNavItems(): NavItem[] {
  return [...NAV_ITEMS.filter((i) => i.mobile), MORE_ITEM]
}

export function moreNavItems(): NavItem[] {
  return [...NAV_ITEMS.filter((i) => !i.mobile), INVITES_ITEM]
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/navigation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Use it in the sidebar**

In `components/app-shell/sidebar.tsx`:
- replace the lucide import with `import { Plus } from 'lucide-react'`
- add `import { NAV_ITEMS, isNavActive } from '@/lib/navigation'`
- delete the local `navItems` array
- in the map, use `NAV_ITEMS.map(...)` and `const isActive = isNavActive(pathname, item.href)`
- replace the dead `+` `<button>` in "Recent Projects" with:

```tsx
              <Link href="/dashboard/projects?new=true" aria-label="New project" className="hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5"><Plus className="w-3.5 h-3.5"/></Link>
```

- [ ] **Step 6: Use it in the mobile nav**

In `components/app-shell/mobile-nav.tsx`:
- replace the lucide import and the local `navItems` with `import { mobileNavItems, isNavActive } from '@/lib/navigation'`
- inside the component, add `const navItems = mobileNavItems()`
- use `const isActive = isNavActive(pathname, item.href) || (item.href === '/dashboard/more' && pathname.startsWith('/dashboard/more'))`

- [ ] **Step 7: Create the More page**

Create `app/dashboard/more/page.tsx`:

```tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { moreNavItems } from '@/lib/navigation'

export default function MorePage() {
  return (
    <div className="space-y-4 pb-12">
      <h1 className="text-2xl font-bold tracking-tight">More</h1>
      <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
        {moreNavItems().map((item) => {
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 px-4 py-4 text-sm font-medium hover:bg-slate-50">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 8: Add Invites to the desktop user menu**

In `components/app-shell/user-menu.tsx`:
- add `MailPlus` to the lucide import
- after the "Account Settings" `DropdownMenuItem`, add:

```tsx
          <DropdownMenuItem
            className="rounded-lg h-9 px-3 cursor-pointer"
            render={<Link href="/dashboard/invites" />}
          >
            <MailPlus className="mr-2 h-4 w-4 text-muted-foreground" />
            Invites
          </DropdownMenuItem>
```

- [ ] **Step 9: Visual check**

Start the preview (`.claude/launch.json` exists), sign in with a test account and check:
- desktop sidebar shows 7 items
- at 375px width the bottom bar shows Home, Projects, Team, Rhythms, More
- More lists Focus, Finances, Settings, Invites

Take a screenshot as proof.

- [ ] **Step 10: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/navigation.ts app/dashboard/more/page.tsx components/app-shell/sidebar.tsx components/app-shell/mobile-nav.tsx components/app-shell/user-menu.tsx __tests__/navigation.test.ts
git commit -m "feat: single nav config, mobile More page, invites in user menu"
```

---

### Task 9: Home becomes "My Day" with quick add

**Why:** The current dashboard (`app/dashboard/page.tsx`) is a team scoreboard. It has no answer to "what should I do now?":
- it misses tasks I created but haven't assigned
- it ignores instant focus sessions
- adding a task requires opening a project first

**Files:**
- Create: `lib/tasks/my-day.ts`
- Create: `lib/tasks/default-project.ts`
- Create: `components/home/my-day-list.tsx`
- Create: `components/home/quick-add-task.tsx`
- Modify: `app/actions/tasks.ts` (add `quickAddTask`)
- Rewrite: `app/dashboard/page.tsx`
- Delete:
  - `components/dashboard/focus-score-ring.tsx`
  - `components/dashboard/blockers-panel.tsx`
  - `components/dashboard/active-now.tsx`
  - `components/dashboard/my-focus-queue.tsx`
  - `components/common/stat-card.tsx`
- Test: `__tests__/my-day.test.ts`, `__tests__/default-project.test.ts`

**Interfaces:**
- Produces from `lib/tasks/my-day.ts`:
  - `MyDayTask = { id: string; title: string; status: string; priority: string | null; deadline: string | null; project_id: string; project_name: string | null; owner_id: string | null; created_by: string | null }`
  - `MyDayGroups = { overdue: MyDayTask[]; today: MyDayTask[]; upNext: MyDayTask[] }`
  - `isMyTask(task: Pick<MyDayTask, 'owner_id' | 'created_by'>, userId: string): boolean`
  - `groupMyDay(tasks: MyDayTask[], userId: string, todayKey: string): MyDayGroups`
  - `dateKeyInTimeZone(now: Date, timeZone: string | null | undefined): string` (returns `YYYY-MM-DD`)
- Produces from `lib/tasks/default-project.ts`:
  - `pickDefaultProjectId(projects: { id: string; name: string; created_at: string }[]): string | undefined`
- Produces from `app/actions/tasks.ts`:
  - `quickAddTask(title: string): Promise<{ success: true; id?: string } | { success: false; error: { message: string } }>`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/my-day.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupMyDay, isMyTask, dateKeyInTimeZone, type MyDayTask } from '@/lib/tasks/my-day'

const ME = 'me'
const OTHER = 'other'

function task(over: Partial<MyDayTask>): MyDayTask {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    title: 't',
    status: 'backlog',
    priority: 'medium',
    deadline: null,
    project_id: 'p1',
    project_name: 'General',
    owner_id: ME,
    created_by: ME,
    ...over,
  }
}

describe('isMyTask', () => {
  it('is mine when assigned to me', () => {
    expect(isMyTask({ owner_id: ME, created_by: OTHER }, ME)).toBe(true)
  })
  it('is mine when I created it and nobody owns it', () => {
    expect(isMyTask({ owner_id: null, created_by: ME }, ME)).toBe(true)
  })
  it('is not mine when someone else owns it, even if I created it', () => {
    expect(isMyTask({ owner_id: OTHER, created_by: ME }, ME)).toBe(false)
  })
})

describe('groupMyDay', () => {
  const today = '2026-10-08'

  it('puts past-due open tasks in overdue, oldest first', () => {
    const a = task({ id: 'a', deadline: '2026-10-06T12:00:00+00:00' })
    const b = task({ id: 'b', deadline: '2026-10-01T12:00:00+00:00' })
    expect(groupMyDay([a, b], ME, today).overdue.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('puts active statuses and due-today tasks in today, doing first then by priority', () => {
    const due = task({ id: 'due', deadline: '2026-10-08T12:00:00+00:00', priority: 'low' })
    const doing = task({ id: 'doing', status: 'doing', priority: 'low' })
    const urgent = task({ id: 'urgent', status: 'today', priority: 'urgent' })
    const blocked = task({ id: 'blocked', status: 'blocked', priority: 'medium' })
    expect(groupMyDay([due, urgent, blocked, doing], ME, today).today.map((t) => t.id)).toEqual([
      'doing',
      'urgent',
      'blocked',
      'due',
    ])
  })

  it('puts the rest in up next, dated before undated', () => {
    const later = task({ id: 'later', deadline: '2026-10-20T12:00:00+00:00' })
    const soon = task({ id: 'soon', deadline: '2026-10-10T12:00:00+00:00' })
    const undated = task({ id: 'undated', priority: 'high' })
    expect(groupMyDay([undated, later, soon], ME, today).upNext.map((t) => t.id)).toEqual([
      'soon',
      'later',
      'undated',
    ])
  })

  it('drops done tasks and tasks that are not mine', () => {
    const done = task({ status: 'done' })
    const theirs = task({ owner_id: OTHER, created_by: OTHER })
    const g = groupMyDay([done, theirs], ME, today)
    expect(g.overdue.length + g.today.length + g.upNext.length).toBe(0)
  })
})

describe('dateKeyInTimeZone', () => {
  it('formats the calendar date in the given zone', () => {
    const instant = new Date('2026-10-08T02:30:00Z')
    expect(dateKeyInTimeZone(instant, 'UTC')).toBe('2026-10-08')
    expect(dateKeyInTimeZone(instant, 'America/New_York')).toBe('2026-10-07')
  })

  it('falls back to UTC for a missing or unknown zone', () => {
    const instant = new Date('2026-10-08T02:30:00Z')
    expect(dateKeyInTimeZone(instant, null)).toBe('2026-10-08')
    expect(dateKeyInTimeZone(instant, 'Not/AZone')).toBe('2026-10-08')
  })
})
```

Create `__tests__/default-project.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pickDefaultProjectId } from '@/lib/tasks/default-project'

describe('pickDefaultProjectId', () => {
  it('prefers the General project, case-insensitively', () => {
    expect(
      pickDefaultProjectId([
        { id: 'a', name: 'Website', created_at: '2026-01-01' },
        { id: 'g', name: ' general ', created_at: '2026-02-01' },
      ])
    ).toBe('g')
  })

  it('otherwise picks the oldest project', () => {
    expect(
      pickDefaultProjectId([
        { id: 'new', name: 'B', created_at: '2026-05-01' },
        { id: 'old', name: 'A', created_at: '2026-01-01' },
      ])
    ).toBe('old')
  })

  it('returns undefined when there are no projects', () => {
    expect(pickDefaultProjectId([])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/my-day.test.ts __tests__/default-project.test.ts`
Expected: FAIL (imports cannot be resolved)

- [ ] **Step 3: Implement `lib/tasks/my-day.ts`**

```ts
export type MyDayTask = {
  id: string
  title: string
  status: string
  priority: string | null
  deadline: string | null
  project_id: string
  project_name: string | null
  owner_id: string | null
  created_by: string | null
}

export type MyDayGroups = { overdue: MyDayTask[]; today: MyDayTask[]; upNext: MyDayTask[] }

const ACTIVE_STATUSES = new Set(['today', 'doing', 'blocked', 'review'])
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const rank = (t: MyDayTask) => PRIORITY_RANK[t.priority ?? 'medium'] ?? 2
const dueKey = (t: MyDayTask) => (t.deadline ? t.deadline.slice(0, 10) : null)

/** Mine = assigned to me, or created by me and still unassigned. */
export function isMyTask(task: Pick<MyDayTask, 'owner_id' | 'created_by'>, userId: string): boolean {
  return task.owner_id === userId || (task.owner_id === null && task.created_by === userId)
}

/**
 * Split my open tasks into three lists. Deadlines are compared as calendar
 * dates (`YYYY-MM-DD`) against `todayKey` in the user's own timezone, so a
 * server running in UTC never shifts a task to the wrong day.
 */
export function groupMyDay(tasks: MyDayTask[], userId: string, todayKey: string): MyDayGroups {
  const groups: MyDayGroups = { overdue: [], today: [], upNext: [] }

  for (const t of tasks) {
    if (t.status === 'done' || !isMyTask(t, userId)) continue
    const due = dueKey(t)
    if (due && due < todayKey) groups.overdue.push(t)
    else if (ACTIVE_STATUSES.has(t.status) || due === todayKey) groups.today.push(t)
    else groups.upNext.push(t)
  }

  groups.overdue.sort((a, b) => (dueKey(a) ?? '').localeCompare(dueKey(b) ?? ''))
  groups.today.sort((a, b) => {
    const doing = Number(b.status === 'doing') - Number(a.status === 'doing')
    return doing !== 0 ? doing : rank(a) - rank(b)
  })
  groups.upNext.sort((a, b) => {
    const da = dueKey(a)
    const db = dueKey(b)
    if (da && db && da !== db) return da.localeCompare(db)
    if (da && !db) return -1
    if (!da && db) return 1
    return rank(a) - rank(b)
  })

  return groups
}

/** Calendar date (`YYYY-MM-DD`) of `now` in `timeZone`; unknown zones fall back to UTC. */
export function dateKeyInTimeZone(now: Date, timeZone: string | null | undefined): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  try {
    return format(timeZone || 'UTC')
  } catch {
    return format('UTC')
  }
}
```

- [ ] **Step 4: Implement `lib/tasks/default-project.ts`**

```ts
/**
 * Where a quick-added task goes: the workspace's "General" project (every
 * workspace gets one from createWorkspace), else the oldest project.
 */
export function pickDefaultProjectId(
  projects: { id: string; name: string; created_at: string }[]
): string | undefined {
  const general = projects.find((p) => p.name.trim().toLowerCase() === 'general')
  if (general) return general.id
  return [...projects].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run __tests__/my-day.test.ts __tests__/default-project.test.ts`
Expected: PASS

- [ ] **Step 6: Add `quickAddTask` to `app/actions/tasks.ts`**

Add the imports at the top:

```ts
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { pickDefaultProjectId } from '@/lib/tasks/default-project'
```

Append:

```ts
const quickAddSchema = z.object({ title: z.string().trim().min(1, 'Title is required').max(200) })

/**
 * Add a task without choosing a project: it goes to the active workspace's
 * General project (created if the workspace has no projects), assigned to me,
 * status 'today' — so it shows up on Home immediately.
 */
export async function quickAddTask(title: string) {
  const validated = quickAddSchema.safeParse({ title })
  if (!validated.success) {
    return { success: false as const, error: { message: validated.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: { message: 'Not authenticated' } }

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return { success: false as const, error: { message: 'Create or join a workspace first' } }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .eq('workspace_id', workspaceId)

  let projectId = pickDefaultProjectId(projects ?? [])

  if (!projectId) {
    const { data: created, error } = await supabase
      .from('projects')
      .insert({ workspace_id: workspaceId, name: 'General', description: 'Default project for this workspace', created_by: user.id })
      .select('id')
      .single()
    if (error || !created) {
      return { success: false as const, error: { message: error?.message ?? 'Could not create a default project' } }
    }
    projectId = created.id as string
  }

  return createTask({ project_id: projectId, title: validated.data.title, status: 'today', owner_id: user.id })
}
```

- [ ] **Step 7: Create `components/home/my-day-list.tsx`**

```tsx
import Link from 'next/link'
import type { MyDayTask } from '@/lib/tasks/my-day'

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  medium: 'bg-slate-100 text-slate-700 border-slate-200',
  low: 'bg-slate-50 text-slate-500 border-slate-100',
}

export function MyDayList({
  title,
  tasks,
  empty,
  tone = 'default',
}: {
  title: string
  tasks: MyDayTask[]
  empty: string
  tone?: 'default' | 'warning'
}) {
  return (
    <section>
      <h2
        className={
          tone === 'warning'
            ? 'mb-3 text-sm font-semibold uppercase tracking-wider text-amber-700'
            : 'mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground'
        }
      >
        {title} <span className="font-normal">({tasks.length})</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/projects/${t.project_id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.project_name ?? 'Project'} · {t.status}
                    {t.deadline ? ` · due ${t.deadline.slice(0, 10)}` : ''}
                  </span>
                </span>
                {t.priority && (
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.medium}`}
                  >
                    {t.priority}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 8: Create `components/home/quick-add-task.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { quickAddTask } from '@/app/actions/tasks'

export function QuickAddTask() {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = title.trim()
    if (!value) return
    if (!navigator.onLine) {
      toast.error('You are offline. Open a project board to add tasks offline.')
      return
    }
    startTransition(async () => {
      const res = await quickAddTask(value)
      if (!res.success) {
        toast.error(res.error?.message ?? 'Could not add task')
        return
      }
      setTitle('')
      toast.success('Added to today')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task for today…"
        aria-label="New task title"
        disabled={pending}
        className="h-11 rounded-xl bg-white"
      />
      <Button type="submit" disabled={pending || !title.trim()} className="h-11 rounded-xl">
        <Plus className="mr-1 h-4 w-4" />
        Add
      </Button>
    </form>
  )
}
```

- [ ] **Step 9: Rewrite `app/dashboard/page.tsx`**

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { MailPlus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { canEditWorkspace } from '@/app/actions/roles'
import { groupMyDay, dateKeyInTimeZone, type MyDayTask } from '@/lib/tasks/my-day'
import { MyDayList } from '@/components/home/my-day-list'
import { QuickAddTask } from '@/components/home/quick-add-task'
import { StartFocusButton } from '@/components/dashboard/start-focus-button'
import { Button } from '@/components/ui/button'

/** Home = My Day. Only my work; team views live on /dashboard/team. */
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const workspaceId = await resolveActiveWorkspaceId()

  const { data: profile } = await supabase.from('profiles').select('full_name, timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(now, profile?.timezone)

  const [tasksRes, focusRes, invitesRes, canEdit] = await Promise.all([
    workspaceId
      ? supabase
          .from('tasks')
          .select('id, title, status, priority, deadline, project_id, owner_id, created_by, projects(name)')
          .eq('workspace_id', workspaceId)
          .neq('status', 'done')
          .or(`owner_id.eq.${user.id},and(owner_id.is.null,created_by.eq.${user.id})`)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('focus_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('started_at', `${todayKey}T00:00:00Z`),
    supabase.rpc('get_my_workspace_invites'),
    workspaceId ? canEditWorkspace(workspaceId) : Promise.resolve(false),
  ])

  const tasks: MyDayTask[] = (tasksRes.data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    project_id: t.project_id,
    project_name: (Array.isArray(t.projects) ? t.projects[0]?.name : t.projects?.name) ?? null,
    owner_id: t.owner_id,
    created_by: t.created_by,
  }))

  const { overdue, today, upNext } = groupMyDay(tasks, user.id, todayKey)
  const focusToday = focusRes.count ?? 0
  const pendingInvites = ((invitesRes.data as { status: string }[] | null) ?? []).filter((i) => i.status === 'pending').length
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{firstName ? `Hi ${firstName}` : 'My Day'}</h1>
          <p className="text-sm text-muted-foreground">
            {format(now, 'EEEE, MMMM do')} · {today.length} for today · {focusToday} focus session{focusToday === 1 ? '' : 's'} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/dashboard/team" />} className="h-9 rounded-full bg-white">
            <Users className="mr-2 h-4 w-4" />
            Team
          </Button>
          <StartFocusButton />
        </div>
      </header>

      {pendingInvites > 0 && (
        <Link
          href="/dashboard/invites"
          className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"
        >
          <MailPlus className="h-4 w-4" />
          You have {pendingInvites} pending workspace invite{pendingInvites === 1 ? '' : 's'}. Review
        </Link>
      )}

      {canEdit && <QuickAddTask />}

      {overdue.length > 0 && (
        <MyDayList title="Overdue" tasks={overdue} empty="" tone="warning" />
      )}
      <MyDayList title="Today" tasks={today} empty="Nothing planned for today. Add a task above or pull one from a project." />
      <MyDayList title="Up next" tasks={upNext.slice(0, 10)} empty="No other open tasks assigned to you." />
    </div>
  )
}
```

Note: if `tsc` rejects the mixed `Promise.all` tuple, give `tasksRes` an explicit type (`{ data: any[] | null }`) rather than casting the whole array.

- [ ] **Step 10: Delete the now-unused dashboard widgets**

Run: `grep -rn "focus-score-ring\|blockers-panel\|active-now\|my-focus-queue\|common/stat-card" app components`
Expected: no output. If anything still imports one of them, keep that file.

Then:

```bash
git rm components/dashboard/focus-score-ring.tsx components/dashboard/blockers-panel.tsx components/dashboard/active-now.tsx components/dashboard/my-focus-queue.tsx components/common/stat-card.tsx
```

- [ ] **Step 11: Visual check**

In the preview, sign in with a test account and check:
- the quick-add input shows
- adding "Test quick add" makes it appear under **Today**
- a viewer account sees no quick-add input

Take a screenshot.

- [ ] **Step 12: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/tasks/my-day.ts lib/tasks/default-project.ts components/home app/actions/tasks.ts app/dashboard/page.tsx __tests__/my-day.test.ts __tests__/default-project.test.ts
git commit -m "feat: Home becomes My Day (my tasks, quick add, invites banner)"
```

---

### Task 10: Edit everything in the task drawer; one assign action

**Why:**
- The drawer can only edit the description. The server already allows title/priority/deadline (`lib/tasks/updatable-fields.ts`), but there is no UI for them.
- You cannot unassign a task.
- `assignTaskOwner` duplicates `assignOwner`.
- `createTask` stores a date-input deadline as midnight UTC, so it shows a day early west of UTC.
- Assignment leaves no activity trail.

**Files:**
- Create: `lib/tasks/deadline.ts`
- Create: `components/tasks/task-edit-fields.tsx`
- Modify: `app/actions/tasks.ts` (`assignOwner` accepts `null` and logs activity; `createTask` uses `toDeadlineIso`)
- Modify: `app/actions/task-details.ts` (delete `assignTaskOwner`)
- Modify: `lib/tasks/updatable-fields.ts` (comment references `assignOwner`)
- Modify: `components/tasks/task-detail-drawer.tsx`
- Test: `__tests__/deadline.test.ts`, `__tests__/assign-owner.test.ts`

**Interfaces:**
- Produces:
  - `toDeadlineIso(value: string): string | null`. Throws `Error('Invalid date')` on unparseable input.
  - `dateInputFromDeadline(deadline: string | null): string`
  - `assignOwner(id: string, ownerId: string | null, projectId: string)`
  - `TaskEditFields` props: `{ taskId: string; projectId: string; workspaceId: string; title: string; priority: string; deadline: string | null; onSaved: () => void }`
- Consumes: `updateTask(id, data, projectId)` returning `{ error: string } | { success: true }`; `TASK_PRIORITIES`; `TaskUpdate`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/deadline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toDeadlineIso, dateInputFromDeadline } from '@/lib/tasks/deadline'

describe('toDeadlineIso', () => {
  it('stores a date-input value at noon UTC so it never shifts a day in any timezone', () => {
    expect(toDeadlineIso('2026-10-08')).toBe('2026-10-08T12:00:00.000Z')
  })
  it('clears the deadline for an empty value', () => {
    expect(toDeadlineIso('')).toBeNull()
  })
  it('passes through a full ISO timestamp', () => {
    expect(toDeadlineIso('2026-10-08T09:30:00.000Z')).toBe('2026-10-08T09:30:00.000Z')
  })
  it('rejects garbage', () => {
    expect(() => toDeadlineIso('next tuesday')).toThrow('Invalid date')
  })
})

describe('dateInputFromDeadline', () => {
  it('returns the calendar date part for an <input type=date>', () => {
    expect(dateInputFromDeadline('2026-10-08T12:00:00+00:00')).toBe('2026-10-08')
    expect(dateInputFromDeadline(null)).toBe('')
  })
})
```

Create `__tests__/assign-owner.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unassigning used to be impossible: assignOwner's schema required a uuid, so
 * `assignOwner(id, null, pid)` failed validation. It also wrote no activity.
 */

const TASK = '11111111-1111-1111-1111-111111111111'
const PROJECT = '22222222-2222-2222-2222-222222222222'
const WS = '33333333-3333-3333-3333-333333333333'

const writes: { table: string; op: string; payload: unknown }[] = []
let updatedRow: Record<string, unknown> | null = { id: TASK, project_id: PROJECT, workspace_id: WS }

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
// tasks.ts imports the workspace resolver (Task 9), which imports next/headers.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
    from: (table: string) => {
      const q: any = {
        update: (payload: unknown) => {
          writes.push({ table, op: 'update', payload })
          return q
        },
        insert: async (payload: unknown) => {
          writes.push({ table, op: 'insert', payload })
          return { error: null }
        },
        eq: () => q,
        select: () => q,
        maybeSingle: async () => ({ data: updatedRow, error: null }),
      }
      return q
    },
  }),
}))

import { assignOwner } from '@/app/actions/tasks'

describe('assignOwner', () => {
  beforeEach(() => {
    writes.length = 0
    updatedRow = { id: TASK, project_id: PROJECT, workspace_id: WS }
  })

  it('can unassign a task', async () => {
    const res = await assignOwner(TASK, null, PROJECT)
    expect(res.success).toBe(true)
    expect(writes[0]).toEqual({ table: 'tasks', op: 'update', payload: { owner_id: null } })
  })

  it('records an activity entry', async () => {
    await assignOwner(TASK, null, PROJECT)
    expect(writes[1]).toMatchObject({
      table: 'task_activity',
      op: 'insert',
      payload: { task_id: TASK, workspace_id: WS, user_id: 'actor', type: 'unassigned' },
    })
  })

  it('reports an RLS-blocked update instead of claiming success', async () => {
    updatedRow = null
    const res = await assignOwner(TASK, null, PROJECT)
    expect(res.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/deadline.test.ts __tests__/assign-owner.test.ts`
Expected:
- deadline test: FAIL (import cannot be resolved)
- assign-owner test: FAIL (`success` is false: "Invalid input")

- [ ] **Step 3: Implement `lib/tasks/deadline.ts`**

```ts
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Convert an <input type="date"> value (or an ISO timestamp from the offline
 * queue) into the value stored in `tasks.deadline`. Date-only values are pinned
 * to 12:00 UTC: midnight UTC rendered a day early for everyone west of UTC.
 */
export function toDeadlineIso(value: string): string | null {
  if (!value) return null
  if (DATE_ONLY.test(value)) return `${value}T12:00:00.000Z`
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date')
  return parsed.toISOString()
}

/** The calendar-date part of a stored deadline, for an <input type="date">. */
export function dateInputFromDeadline(deadline: string | null): string {
  return deadline ? deadline.slice(0, 10) : ''
}
```

- [ ] **Step 4: Update `assignOwner` and `createTask` in `app/actions/tasks.ts`**

Add `import { toDeadlineIso } from '@/lib/tasks/deadline'`.

Replace the `assignOwnerSchema` and the `assignOwner` function with:

```ts
const assignOwnerSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid().nullable(),
  projectId: z.string().uuid()
})

/** Assign (or, with `null`, unassign) a task, and log it to the activity feed. */
export async function assignOwner(id: string, ownerId: string | null, projectId: string) {
  const validated = assignOwnerSchema.safeParse({ id, ownerId, projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ owner_id: validated.data.ownerId })
    .eq('id', validated.data.id)
    .select('id, project_id, workspace_id')
    .maybeSingle()

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }
  // RLS turns a forbidden update into zero rows, not an error.
  if (!task) return { success: false, error: { message: 'You do not have permission to assign this task' } }

  // Best-effort: the assignment already succeeded; a feed failure must not undo it.
  await supabase.from('task_activity').insert({
    task_id: task.id,
    project_id: task.project_id,
    workspace_id: task.workspace_id,
    user_id: user.id,
    type: validated.data.ownerId ? 'assigned' : 'unassigned',
    body: validated.data.ownerId,
  })

  revalidatePath(`/dashboard/projects/${validated.data.projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}
```

In `createTask`, replace:

```ts
    deadline: validated.data.deadline ? new Date(validated.data.deadline).toISOString() : null,
```

with:

```ts
    deadline: validated.data.deadline ? toDeadlineIso(validated.data.deadline) : null,
```

Then wrap the parse so a bad date returns an error instead of throwing. At the top of `createTask`, right after the `validated.success` check, add:

```ts
  try {
    if (validated.data.deadline) toDeadlineIso(validated.data.deadline)
  } catch {
    return { success: false, error: { message: 'Invalid deadline' } }
  }
```

- [ ] **Step 5: Delete the duplicate action**

- Run `grep -rn "assignTaskOwner" app components lib`.
- Expected: only the definition in `app/actions/task-details.ts` and a comment in `lib/tasks/updatable-fields.ts`.
- Delete the `assignTaskOwner` function (lines ~78-85) from `app/actions/task-details.ts`.
- In `lib/tasks/updatable-fields.ts`, change `` `owner_id` (has its own action, `assignTaskOwner`) `` to `` `owner_id` (has its own action, `assignOwner`) ``.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run __tests__/deadline.test.ts __tests__/assign-owner.test.ts __tests__/task-update-allowlist.test.ts`
Expected: PASS

- [ ] **Step 7: Create `components/tasks/task-edit-fields.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { updateTask } from '@/app/actions/task-details'
import { TASK_PRIORITIES, type TaskUpdate } from '@/lib/tasks/updatable-fields'
import { toDeadlineIso, dateInputFromDeadline } from '@/lib/tasks/deadline'

export function TaskEditFields({
  taskId,
  projectId,
  workspaceId,
  title,
  priority,
  deadline,
  onSaved,
}: {
  taskId: string
  projectId: string
  workspaceId: string
  title: string
  priority: string
  deadline: string | null
  onSaved: () => void
}) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [saving, setSaving] = useState(false)

  async function save(fields: TaskUpdate) {
    setSaving(true)
    try {
      if (!navigator.onLine) {
        const { addToSyncQueue } = await import('@/lib/offline/sync-queue')
        await addToSyncQueue('update_task', 'task', taskId, fields, workspaceId, projectId)
        toast.success('Saved offline. It will sync when you reconnect.')
      } else {
        const res = await updateTask(taskId, fields, projectId)
        if ('error' in res && res.error) {
          toast.error(res.error)
          return
        }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'mt-1 block h-9 w-full rounded-lg border border-border bg-white px-2 text-sm'

  return (
    <div className="mb-6 grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
      <label className="text-xs font-semibold text-muted-foreground">
        Title
        <Input
          value={draftTitle}
          disabled={saving}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => {
            const value = draftTitle.trim()
            if (value && value !== title) save({ title: value })
            else setDraftTitle(title)
          }}
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold text-muted-foreground">
        Priority
        <select
          value={priority}
          disabled={saving}
          onChange={(e) => save({ priority: e.target.value as NonNullable<TaskUpdate['priority']> })}
          className={fieldClass}
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted-foreground">
        Due
        <input
          type="date"
          value={dateInputFromDeadline(deadline)}
          disabled={saving}
          onChange={(e) => save({ deadline: toDeadlineIso(e.target.value) })}
          className={fieldClass}
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 8: Wire it into the drawer**

In `components/tasks/task-detail-drawer.tsx`:
- add `import { TaskEditFields } from "@/components/tasks/task-edit-fields";`
- delete the priority badge `<span ...>{data.task.priority} Priority</span>`
- delete the `{data.task.deadline && ( ... Due: ... )}` block
- immediately before the `{/* Description */}` block, add:

```tsx
            <TaskEditFields
              key={`${data.task.id}-${data.task.updated_at}`}
              taskId={taskId}
              projectId={projectId}
              workspaceId={data.task.workspace_id}
              title={data.task.title}
              priority={data.task.priority ?? "medium"}
              deadline={data.task.deadline}
              onSaved={fetchData}
            />
```

- change `handleAssign`'s parameter type to `string | null` (it already passes the value to `assignOwner`)
- inside `DropdownMenuContent`, before the members list, add:

```tsx
                      {data.task.owner_id && (
                        <DropdownMenuItem onClick={() => handleAssign(null)} className="rounded-lg cursor-pointer gap-2 text-slate-500">
                          <User className="w-4 h-4" />
                          <span className="text-sm">Unassigned</span>
                        </DropdownMenuItem>
                      )}
```

- if `format` from date-fns is now unused, remove it from the import

- [ ] **Step 9: Visual check**

In the preview, open a task and check:
- renaming persists after closing and reopening
- changing priority updates the board card
- setting a due date shows the same calendar day
- choosing Unassigned works

Take a screenshot.

- [ ] **Step 10: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/tasks/deadline.ts components/tasks/task-edit-fields.tsx components/tasks/task-detail-drawer.tsx app/actions/tasks.ts app/actions/task-details.ts lib/tasks/updatable-fields.ts __tests__/deadline.test.ts __tests__/assign-owner.test.ts
git commit -m "feat: edit title/priority/due date in drawer, unassign, assignment activity"
```

---

## Phase E — Team management

### Task 11: Members panel — change role, remove, leave; drop the legacy invite path

**Why:** Nothing in the app can change a role, remove a member or leave a workspace. The database already allows it:
- UPDATE is allowed for admins.
- DELETE is allowed for admins or yourself.
- `enforce_workspace_role_rules` protects the last owner.

Also:
- `app/actions/workspace-members.ts::inviteTeamMember` is an unused second invite system that skips consent.
- The Team page's activity avatars always show `?` (`getInitials(log.user?.full_name)`, but those objects have `name`).

**Files:**
- Create: `lib/team/member-permissions.ts`
- Create: `app/actions/members.ts`
- Create: `components/team/members-panel.tsx`
- Modify: `app/dashboard/team/page.tsx`
- Delete: `app/actions/workspace-members.ts`
- Test: `__tests__/member-permissions.test.ts`

**Interfaces:**
- Consumes: `WorkspaceRole` type from `app/actions/roles.ts`
- Produces:
  - `ASSIGNABLE_ROLES: readonly ['owner','admin','member','viewer']`
  - `canChangeRole(actor: WorkspaceRole | null, target: WorkspaceRole, next: WorkspaceRole, isSelf: boolean): boolean`
  - `canRemoveMember(actor: WorkspaceRole | null, target: WorkspaceRole, isSelf: boolean): boolean`
  - `canLeaveWorkspace(role: WorkspaceRole, ownerCount: number): boolean`
  - Actions, each returning `{ success: true } | { success: false; error: string }`:
    - `updateMemberRole(workspaceId: string, userId: string, role: string)`
    - `removeMember(workspaceId: string, userId: string)`
    - `leaveWorkspace(workspaceId: string)`
  - `MembersPanel` props: `{ workspaceId: string; members: PanelMember[]; currentUserId: string; actorRole: WorkspaceRole | null }`, with `PanelMember = { id: string; name: string; email: string; role: WorkspaceRole }`

- [ ] **Step 1: Write the failing test**

Create `__tests__/member-permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canChangeRole, canRemoveMember, canLeaveWorkspace } from '@/lib/team/member-permissions'

describe('canChangeRole', () => {
  it('lets owners change anyone else, including granting owner', () => {
    expect(canChangeRole('owner', 'member', 'owner', false)).toBe(true)
    expect(canChangeRole('owner', 'owner', 'admin', false)).toBe(true)
  })
  it('lets admins manage non-owners but never grant or touch owner', () => {
    expect(canChangeRole('admin', 'member', 'viewer', false)).toBe(true)
    expect(canChangeRole('admin', 'member', 'owner', false)).toBe(false)
    expect(canChangeRole('admin', 'owner', 'member', false)).toBe(false)
  })
  it('never lets members, viewers or non-members change roles', () => {
    expect(canChangeRole('member', 'viewer', 'member', false)).toBe(false)
    expect(canChangeRole('viewer', 'viewer', 'member', false)).toBe(false)
    expect(canChangeRole(null, 'viewer', 'member', false)).toBe(false)
  })
  it('never lets you change your own role (prevents self-lockout)', () => {
    expect(canChangeRole('owner', 'owner', 'member', true)).toBe(false)
  })
})

describe('canRemoveMember', () => {
  it('owners remove anyone else; admins remove non-owners', () => {
    expect(canRemoveMember('owner', 'admin', false)).toBe(true)
    expect(canRemoveMember('admin', 'member', false)).toBe(true)
    expect(canRemoveMember('admin', 'owner', false)).toBe(false)
  })
  it('members cannot remove anyone, and nobody "removes" themselves (use leave)', () => {
    expect(canRemoveMember('member', 'viewer', false)).toBe(false)
    expect(canRemoveMember('owner', 'owner', true)).toBe(false)
  })
})

describe('canLeaveWorkspace', () => {
  it('anyone but the last owner can leave', () => {
    expect(canLeaveWorkspace('member', 1)).toBe(true)
    expect(canLeaveWorkspace('owner', 2)).toBe(true)
    expect(canLeaveWorkspace('owner', 1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/member-permissions.test.ts`
Expected: FAIL (import cannot be resolved)

- [ ] **Step 3: Implement `lib/team/member-permissions.ts`**

```ts
import type { WorkspaceRole } from '@/app/actions/roles'

/**
 * UI/UX mirror of the DB rules (workspace_members RLS + the
 * enforce_workspace_role_rules trigger). RLS stays the real enforcement; these
 * decide which controls to show and give clear errors before a round-trip.
 */
export const ASSIGNABLE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const

export function canChangeRole(
  actor: WorkspaceRole | null,
  target: WorkspaceRole,
  next: WorkspaceRole,
  isSelf: boolean
): boolean {
  if (isSelf) return false
  if (actor === 'owner') return true
  if (actor === 'admin') return target !== 'owner' && next !== 'owner'
  return false
}

export function canRemoveMember(actor: WorkspaceRole | null, target: WorkspaceRole, isSelf: boolean): boolean {
  if (isSelf) return false
  if (actor === 'owner') return true
  if (actor === 'admin') return target !== 'owner'
  return false
}

export function canLeaveWorkspace(role: WorkspaceRole, ownerCount: number): boolean {
  return role !== 'owner' || ownerCount > 1
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/member-permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Implement `app/actions/members.ts`**

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { WorkspaceRole } from '@/app/actions/roles'
import {
  ASSIGNABLE_ROLES,
  canChangeRole,
  canLeaveWorkspace,
  canRemoveMember,
} from '@/lib/team/member-permissions'

type Result = { success: true } | { success: false; error: string }

const memberRef = z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid() })

async function loadMembership(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
  const roles = new Map((data ?? []).map((r) => [r.user_id as string, r.role as WorkspaceRole]))
  return { supabase, userId: user.id, roles }
}

export async function updateMemberRole(workspaceId: string, userId: string, role: string): Promise<Result> {
  const parsed = memberRef.extend({ role: z.enum(ASSIGNABLE_ROLES) }).safeParse({ workspaceId, userId, role })
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const ctx = await loadMembership(workspaceId)
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const target = ctx.roles.get(userId)
  if (!target) return { success: false, error: 'That person is not a member of this workspace' }
  if (!canChangeRole(ctx.roles.get(ctx.userId) ?? null, target, parsed.data.role, userId === ctx.userId)) {
    return { success: false, error: 'You do not have permission to change this role' }
  }

  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .update({ role: parsed.data.role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('user_id')
  // The trigger raises e.g. "A workspace must keep at least one owner".
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'You do not have permission to change this role' }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function removeMember(workspaceId: string, userId: string): Promise<Result> {
  const parsed = memberRef.safeParse({ workspaceId, userId })
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const ctx = await loadMembership(workspaceId)
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const target = ctx.roles.get(userId)
  if (!target) return { success: false, error: 'That person is not a member of this workspace' }
  if (!canRemoveMember(ctx.roles.get(ctx.userId) ?? null, target, userId === ctx.userId)) {
    return { success: false, error: 'You do not have permission to remove this member' }
  }

  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('user_id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'You do not have permission to remove this member' }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function leaveWorkspace(workspaceId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(workspaceId).success) return { success: false, error: 'Invalid input' }

  const ctx = await loadMembership(workspaceId)
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const myRole = ctx.roles.get(ctx.userId)
  if (!myRole) return { success: false, error: 'You are not a member of this workspace' }
  const ownerCount = [...ctx.roles.values()].filter((r) => r === 'owner').length
  if (!canLeaveWorkspace(myRole, ownerCount)) {
    return { success: false, error: 'You are the last owner. Make someone else an owner before leaving.' }
  }

  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', ctx.userId)
    .select('user_id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Could not leave this workspace' }

  // The stale active-workspace cookie is ignored by resolveActiveWorkspaceId(),
  // so every page falls back to the next membership automatically.
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
```

- [ ] **Step 6: Create `components/team/members-panel.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { leaveWorkspace, removeMember, updateMemberRole } from '@/app/actions/members'
import type { WorkspaceRole } from '@/app/actions/roles'
import {
  ASSIGNABLE_ROLES,
  canChangeRole,
  canLeaveWorkspace,
  canRemoveMember,
} from '@/lib/team/member-permissions'

export type PanelMember = { id: string; name: string; email: string; role: WorkspaceRole }

type Result = { success: true } | { success: false; error: string }

export function MembersPanel({
  workspaceId,
  members,
  currentUserId,
  actorRole,
}: {
  workspaceId: string
  members: PanelMember[]
  currentUserId: string
  actorRole: WorkspaceRole | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const ownerCount = members.filter((m) => m.role === 'owner').length

  function run(action: () => Promise<Result>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(ok)
      if (after) after()
      else router.refresh()
    })
  }

  return (
    <section>
      <h3 className="mb-4 text-xl font-bold text-foreground">Members ({members.length})</h3>
      <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
        {members.map((m) => {
          const isSelf = m.id === currentUserId
          const roleOptions = ASSIGNABLE_ROLES.filter(
            (r) => r === m.role || canChangeRole(actorRole, m.role, r, isSelf)
          )
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.name}
                  {isSelf && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              {roleOptions.length > 1 ? (
                <select
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => run(() => updateMemberRole(workspaceId, m.id, e.target.value), 'Role updated')}
                  className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-semibold uppercase text-muted-foreground">{m.role}</span>
              )}

              {canRemoveMember(actorRole, m.role, isSelf) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${m.name} from this workspace?`)) {
                      run(() => removeMember(workspaceId, m.id), 'Member removed')
                    }
                  }}
                >
                  Remove
                </Button>
              )}

              {isSelf && canLeaveWorkspace(m.role, ownerCount) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm('Leave this workspace? You will lose access until someone invites you again.')) {
                      run(() => leaveWorkspace(workspaceId), 'You left the workspace', () => {
                        router.push('/dashboard')
                        router.refresh()
                      })
                    }
                  }}
                >
                  Leave
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 7: Wire the Team page**

In `app/dashboard/team/page.tsx`:
- add imports:
  ```ts
  import { MembersPanel } from '@/components/team/members-panel'
  import type { WorkspaceRole } from '@/app/actions/roles'
  ```
- change the members query to `.select('user_id, role')`
- inside the `memberMap.set(wm.user_id, { ... })` object, add `role: wm.role as WorkspaceRole,`
- replace the tasks query (step "4. Fetch Tasks") with a workspace-scoped one. This removes the unbounded `.in('project_id', projectIds)` id list:

```ts
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
```

- fix the avatar bug in the activity list: `getInitials(log.user?.full_name)` becomes `getInitials(log.user?.name)`
- render the panel right after `<TeamPulseHeader ... />`:

```tsx
      <MembersPanel
        workspaceId={activeWorkspaceId}
        currentUserId={user.id}
        actorRole={userRole as WorkspaceRole}
        members={teamMembers.map((m: any) => ({ id: m.id, name: m.name, email: m.email, role: m.role }))}
      />
```

If `projectIds` becomes unused after the tasks change, remove it, but keep `projectsMap`, which is still used.

- [ ] **Step 8: Delete the legacy invite path**

Run: `grep -rn "workspace-members'\|inviteTeamMember" app components lib __tests__`
Expected: only `app/actions/workspace-members.ts` itself.

```bash
git rm app/actions/workspace-members.ts
```

- [ ] **Step 9: Manual check with two accounts (local stack or staging)**

Check each of these:
- as owner, change B to viewer: B loses the quick-add input on Home
- as admin, no "owner" option is shown
- the last owner sees no Leave button
- B can leave, and lands on Home with the workspace gone from the switcher

Record what was and wasn't checked.

- [ ] **Step 10: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/team/member-permissions.ts app/actions/members.ts components/team/members-panel.tsx app/dashboard/team/page.tsx __tests__/member-permissions.test.ts
git commit -m "feat: team members panel (change role, remove, leave); drop legacy invite path"
```

---

### Task 12: Edit and delete projects

**Why:** No code updates or deletes a project. RLS already allows:
- UPDATE for workspace admins or the project creator
- DELETE for admins

Tasks cascade on project delete (`project_id ... on delete cascade`, migration 0002).

**Files:**
- Create: `lib/projects/permissions.ts`
- Create: `app/dashboard/projects/[projectId]/project-settings-dialog.tsx`
- Modify: `app/actions/projects.ts` (add `updateProject`, `deleteProject`)
- Modify: `app/dashboard/projects/[projectId]/page.tsx` (~lines 87-140)
- Test: `__tests__/project-permissions.test.ts`

**Interfaces:**
- Produces:
  - `canEditProject(role: WorkspaceRole | null, createdBy: string | null, userId: string): boolean`
  - `canDeleteProject(role: WorkspaceRole | null): boolean`
  - `updateProject(id: string, data: { name: string; description?: string }): Promise<{ success: true } | { success: false; error: string }>`
  - `deleteProject(id: string): Promise<{ success: true } | { success: false; error: string }>`
  - `ProjectSettingsDialog` props: `{ project: { id: string; name: string; description: string | null }; canDelete: boolean }`

- [ ] **Step 1: Write the failing test**

Create `__tests__/project-permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canEditProject, canDeleteProject } from '@/lib/projects/permissions'

describe('project permissions (mirror of projects RLS)', () => {
  it('admins and owners can edit any project', () => {
    expect(canEditProject('admin', 'someone-else', 'me')).toBe(true)
    expect(canEditProject('owner', null, 'me')).toBe(true)
  })
  it('the creator can edit their own project', () => {
    expect(canEditProject('member', 'me', 'me')).toBe(true)
  })
  it('other members and viewers cannot edit', () => {
    expect(canEditProject('member', 'someone-else', 'me')).toBe(false)
    expect(canEditProject('viewer', 'someone-else', 'me')).toBe(false)
  })
  it('only admins and owners can delete', () => {
    expect(canDeleteProject('owner')).toBe(true)
    expect(canDeleteProject('admin')).toBe(true)
    expect(canDeleteProject('member')).toBe(false)
    expect(canDeleteProject(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/project-permissions.test.ts`
Expected: FAIL (import cannot be resolved)

- [ ] **Step 3: Implement `lib/projects/permissions.ts`**

```ts
import type { WorkspaceRole } from '@/app/actions/roles'

const isAdmin = (role: WorkspaceRole | null) => role === 'owner' || role === 'admin'

/** Mirrors "Projects updatable by admins or creator". */
export function canEditProject(role: WorkspaceRole | null, createdBy: string | null, userId: string): boolean {
  return isAdmin(role) || (createdBy !== null && createdBy === userId)
}

/** Mirrors "Projects deletable by admins/owners". */
export function canDeleteProject(role: WorkspaceRole | null): boolean {
  return isAdmin(role)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/project-permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Add the actions to `app/actions/projects.ts`**

Append (reuse the file's existing `z`, `createClient` and `revalidatePath` imports, adding any that are missing):

```ts
type ProjectResult = { success: true } | { success: false; error: string }

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(2000).optional(),
})

export async function updateProject(id: string, data: { name: string; description?: string }): Promise<ProjectResult> {
  const parsed = updateProjectSchema.safeParse({ id, ...data })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('projects')
    .update({
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!rows?.length) return { success: false, error: 'Only workspace admins or the project creator can edit this project' }

  revalidatePath(`/dashboard/projects/${parsed.data.id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function deleteProject(id: string): Promise<ProjectResult> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: 'Invalid input' }

  const supabase = await createClient()
  const { data: rows, error } = await supabase.from('projects').delete().eq('id', id).select('id')
  if (error) return { success: false, error: error.message }
  if (!rows?.length) return { success: false, error: 'Only workspace admins can delete projects' }

  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
```

- [ ] **Step 6: Create the dialog**

Create `app/dashboard/projects/[projectId]/project-settings-dialog.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteProject, updateProject } from '@/app/actions/projects'

export function ProjectSettingsDialog({
  project,
  canDelete,
}: {
  project: { id: string; name: string; description: string | null }
  canDelete: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function save() {
    startTransition(async () => {
      const res = await updateProject(project.id, { name, description })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Project updated')
      setOpen(false)
      router.refresh()
    })
  }

  function remove() {
    if (!window.confirm(`Delete "${project.name}" and all of its tasks? This cannot be undone.`)) return
    startTransition(async () => {
      const res = await deleteProject(project.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Project deleted')
      router.push('/dashboard/projects')
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <Settings2 className="mr-1.5 h-4 w-4" />
        Edit project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" disabled={pending} />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Project description"
              placeholder="What is this project for?"
              disabled={pending}
            />
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            {canDelete ? (
              <Button variant="destructive" onClick={remove} disabled={pending}>
                Delete project
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={pending || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

If `Button` has no `destructive` variant (tsc will say so), use `variant="outline"` with `className="text-red-600"`.

- [ ] **Step 7: Show it on the project board**

In `app/dashboard/projects/[projectId]/page.tsx`:
- add imports:
  ```ts
  import { getWorkspaceRole } from '@/app/actions/roles'
  import { canEditProject, canDeleteProject } from '@/lib/projects/permissions'
  import { ProjectSettingsDialog } from './project-settings-dialog'
  ```
- next to `const canEdit = await canEditWorkspace(project.workspace_id)`, add:

```ts
  const role = await getWorkspaceRole(project.workspace_id)
  const canManageProject = canEditProject(role, project.created_by ?? null, user.id)
```

(Use the page's existing user variable name. If the page has no `user` in scope, add `const { data: { user } } = await supabase.auth.getUser()` and guard for null.)

- next to `{canEdit && <RecurringTaskDialog projectId={project.id} />}`, add:

```tsx
             {canManageProject && (
               <ProjectSettingsDialog
                 project={{ id: project.id, name: project.name, description: project.description ?? null }}
                 canDelete={canDeleteProject(role)}
               />
             )}
```

Make sure the page's project query selects `created_by` (`select('*')` already does).

- [ ] **Step 8: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/projects/permissions.ts app/actions/projects.ts "app/dashboard/projects/[projectId]/project-settings-dialog.tsx" "app/dashboard/projects/[projectId]/page.tsx" __tests__/project-permissions.test.ts
git commit -m "feat: edit and delete projects (RLS-mirrored permissions)"
```

---

### Task 13: Live updates for comments, activity and members

**Why:** Realtime only publishes `tasks`, `projects`, `focus_sessions`, `weekly_rhythm_logs`, `financial_entries` and `task_recurrence_rules`. Comments, the activity feed and the member list never update without a reload. The old publication migrations also weren't idempotent; this one is.

**Files:**
- Create: `supabase/migrations/20261008090100_realtime_team_tables.sql`
- Modify: `lib/realtime-subscriptions.ts`
- Modify: `lib/realtime-subscriptions.test.ts`

**Interfaces:**
- Produces: `getWorkspaceRealtimeSubscriptions(workspaceId)` now returns 6 configs: the existing 3, plus `task_comments`, `task_activity` and `workspace_members`, each with `filter: workspace_id=eq.<id>`.

- [ ] **Step 1: Update the test first**

In `lib/realtime-subscriptions.test.ts`, append these three objects to the expected array in the first test, after the `focus_sessions` entry:

```ts
      {
        event: '*',
        schema: 'public',
        table: 'task_comments',
        filter: 'workspace_id=eq.workspace-123',
      },
      {
        event: '*',
        schema: 'public',
        table: 'task_activity',
        filter: 'workspace_id=eq.workspace-123',
      },
      {
        event: '*',
        schema: 'public',
        table: 'workspace_members',
        filter: 'workspace_id=eq.workspace-123',
      },
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/realtime-subscriptions.test.ts`
Expected: FAIL (array length 3 vs 6)

- [ ] **Step 3: Implement**

In `lib/realtime-subscriptions.ts`, replace the returned array with a loop over a table list:

```ts
const WORKSPACE_REALTIME_TABLES = [
  'tasks',
  'projects',
  'focus_sessions',
  'task_comments',
  'task_activity',
  'workspace_members',
] as const

export function getWorkspaceRealtimeSubscriptions(workspaceId?: string): RealtimeSubscriptionConfig[] {
  if (!workspaceId) {
    return []
  }

  return WORKSPACE_REALTIME_TABLES.map((table) => ({
    event: '*' as const,
    schema: 'public' as const,
    table,
    filter: `workspace_id=eq.${workspaceId}`,
  }))
}
```

Create `supabase/migrations/20261008090100_realtime_team_tables.sql`:

```sql
-- Publish the team tables to Realtime so comments, the activity feed and the
-- member list update live. Idempotent: skips tables already in the publication
-- (plain ALTER PUBLICATION ... ADD TABLE errors on re-run).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['task_comments', 'task_activity', 'workspace_members'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/realtime-subscriptions.test.ts`
Expected: PASS

- [ ] **Step 5: Verify the migration locally (Docker)**

Run: `npx supabase db reset` (twice, to prove the migration is idempotent)
Expected: both runs apply cleanly. If Docker is unavailable, say so. Do not claim it was verified.

- [ ] **Step 6: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/realtime-subscriptions.ts lib/realtime-subscriptions.test.ts supabase/migrations/20261008090100_realtime_team_tables.sql
git commit -m "feat: realtime for comments, activity and members"
```

---

## Phase F — The execution layer (closing the Linear gaps)

All four tasks below add tables or triggers, so each one also adds denial and behaviour tests to a shared RLS harness file, `__tests__/rls/execution-layer.test.ts`. Task 14 creates it, and Tasks 16 and 18 append to it.

Run it with `npm run test:rls` (needs `npx supabase start` / Docker). If Docker is unavailable, the report must say **"RLS harness NOT run"**. Never claim those behaviours are verified without it.

### Task 14: Cycles with automatic rollover

**Why:** The product is called SprintRoom, but no migration has a cycle, sprint or iteration table. Teams can't answer "what are we committing to this week, and what slipped?"

**Simple by design:**
- One running cycle per workspace.
- 1- or 2-week length.
- Tasks join a cycle from the task drawer, or automatically when quick-added on Home.
- Rollover is a SQL function on pg_cron, the same pattern as `process_due_focus_schedules`, so there's no new edge function.
- At rollover, unfinished tasks move to the next cycle, which is created if missing and starts today if the workspace was idle. The old cycle keeps a frozen score: done vs carried over.

**Files:**
- Create: `supabase/migrations/20261008100000_cycles.sql`
- Create: `lib/dates.ts`
- Create: `lib/cycles/cycle.ts`
- Create: `app/actions/cycles.ts`
- Create: `app/dashboard/cycle/page.tsx`
- Create: `components/cycles/start-cycle-form.tsx`
- Create: `__tests__/rls/execution-layer.test.ts`
- Modify: `lib/navigation.ts`, `__tests__/navigation.test.ts`
- Modify: `lib/tasks/updatable-fields.ts` (+ `cycle_id`)
- Modify: `app/actions/tasks.ts` (`createTask` accepts `cycle_id`; `quickAddTask` uses the running cycle)
- Modify: `app/actions/task-fetcher.ts` (return open cycles)
- Modify: `components/tasks/task-edit-fields.tsx`, `components/tasks/task-detail-drawer.tsx`
- Modify: `docs/DEPLOY.md` (expected cron jobs)
- Test: `__tests__/cycle.test.ts`, `__tests__/task-update-allowlist.test.ts` (one new case)

**Interfaces:**
- Produces from `lib/dates.ts`:
  - `addDaysToKey(key: string, days: number): string`
  - `daysBetweenKeys(from: string, to: string): number`
- Produces from `lib/cycles/cycle.ts`:
  - `CycleRow = { id: string; name: string; starts_on: string; ends_on: string; completed_at: string | null; completed_count: number | null; carried_over_count: number | null }`
  - `currentCycle<T extends { starts_on: string; ends_on: string; completed_at: string | null }>(cycles: T[], todayKey: string): T | undefined`
  - `newCycleDates(todayKey: string, weeks: 1 | 2): { starts_on: string; ends_on: string }`
  - `cycleDaysLeft(cycle: { ends_on: string }, todayKey: string): number`
  - `cycleProgress(tasks: { status: string; carry_over_count: number }[]): { total; done; inProgress; notStarted; carriedOver; percent }` (all numbers)
  - `cycleName(startsOn: string): string`, e.g. `"Cycle · Oct 8"`
- Produces from `app/actions/cycles.ts`:
  - `startCycle(weeks: number): Promise<{ success: true } | { success: false; error: string }>`
- Produces in the database:
  - `public.cycles`
  - `tasks.cycle_id uuid NULL`, `tasks.carry_over_count int NOT NULL DEFAULT 0`
  - `public.rollover_ended_cycles(): integer` (service role / cron only)
- Changes: `getTaskDetails()` adds `cycles: { id: string; name: string; starts_on: string }[]` (open cycles in the task's workspace). `TaskEditFields` gains props `cycleId: string | null; cycleOptions: { id: string; name: string }[]`.
- Consumes: `dateKeyInTimeZone` (Task 9), `canEditWorkspace`, `resolveActiveWorkspaceId`, `NAV_ITEMS` (Task 8)

- [ ] **Step 1: Write the failing unit tests**

Create `__tests__/cycle.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDaysToKey, daysBetweenKeys } from '@/lib/dates'
import { currentCycle, newCycleDates, cycleDaysLeft, cycleProgress, cycleName } from '@/lib/cycles/cycle'

describe('date keys', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDaysToKey('2026-10-08', 6)).toBe('2026-10-14')
    expect(addDaysToKey('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-10-08', -8)).toBe('2026-09-30')
  })
  it('counts whole days between keys', () => {
    expect(daysBetweenKeys('2026-10-08', '2026-10-14')).toBe(6)
    expect(daysBetweenKeys('2026-10-14', '2026-10-08')).toBe(-6)
  })
})

describe('cycles', () => {
  const running = { id: 'run', starts_on: '2026-10-05', ends_on: '2026-10-11', completed_at: null }
  const future = { id: 'next', starts_on: '2026-10-12', ends_on: '2026-10-18', completed_at: null }
  const finished = { id: 'old', starts_on: '2026-09-28', ends_on: '2026-10-04', completed_at: '2026-10-05T00:05:00Z' }

  it('finds the running cycle and ignores finished or future ones', () => {
    expect(currentCycle([finished, future, running], '2026-10-08')?.id).toBe('run')
    expect(currentCycle([finished, future], '2026-10-08')).toBeUndefined()
  })

  it('plans 1- and 2-week cycles starting today, inclusive of the last day', () => {
    expect(newCycleDates('2026-10-08', 1)).toEqual({ starts_on: '2026-10-08', ends_on: '2026-10-14' })
    expect(newCycleDates('2026-10-08', 2)).toEqual({ starts_on: '2026-10-08', ends_on: '2026-10-21' })
  })

  it('counts days left including today, never negative', () => {
    expect(cycleDaysLeft({ ends_on: '2026-10-14' }, '2026-10-08')).toBe(7)
    expect(cycleDaysLeft({ ends_on: '2026-10-08' }, '2026-10-08')).toBe(1)
    expect(cycleDaysLeft({ ends_on: '2026-10-01' }, '2026-10-08')).toBe(0)
  })

  it('scores a cycle', () => {
    expect(
      cycleProgress([
        { status: 'done', carry_over_count: 0 },
        { status: 'doing', carry_over_count: 1 },
        { status: 'blocked', carry_over_count: 0 },
        { status: 'backlog', carry_over_count: 2 },
      ])
    ).toEqual({ total: 4, done: 1, inProgress: 2, notStarted: 1, carriedOver: 2, percent: 25 })
    expect(cycleProgress([]).percent).toBe(0)
  })

  it('names a cycle after its start date', () => {
    expect(cycleName('2026-10-08')).toBe('Cycle · Oct 8')
  })
})
```

Append to `__tests__/task-update-allowlist.test.ts`. It already imports `pickUpdatableTaskFields`; add the import if not.

```ts
describe('cycle_id is updatable', () => {
  it('accepts a uuid or null and rejects garbage', () => {
    const id = '44444444-4444-4444-4444-444444444444'
    expect(pickUpdatableTaskFields({ cycle_id: id })).toEqual({ ok: true, data: { cycle_id: id } })
    expect(pickUpdatableTaskFields({ cycle_id: null })).toEqual({ ok: true, data: { cycle_id: null } })
    expect(pickUpdatableTaskFields({ cycle_id: 'nope' }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/cycle.test.ts __tests__/task-update-allowlist.test.ts`
Expected:
- `cycle.test.ts`: FAIL (imports cannot be resolved)
- allowlist test: FAIL with `No updatable fields supplied` (cycle_id is stripped)

- [ ] **Step 3: Implement `lib/dates.ts` and `lib/cycles/cycle.ts`**

`lib/dates.ts`:

```ts
/** Calendar-date keys (`YYYY-MM-DD`) use UTC arithmetic so DST never shifts them. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}
```

`lib/cycles/cycle.ts`:

```ts
import { addDaysToKey, daysBetweenKeys } from '@/lib/dates'

export type CycleRow = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  completed_at: string | null
  completed_count: number | null
  carried_over_count: number | null
}

const IN_PROGRESS = new Set(['doing', 'review', 'blocked'])

export function currentCycle<T extends { starts_on: string; ends_on: string; completed_at: string | null }>(
  cycles: T[],
  todayKey: string
): T | undefined {
  return cycles.find((c) => !c.completed_at && c.starts_on <= todayKey && todayKey <= c.ends_on)
}

export function newCycleDates(todayKey: string, weeks: 1 | 2) {
  return { starts_on: todayKey, ends_on: addDaysToKey(todayKey, weeks * 7 - 1) }
}

/** Days left including today; 0 once the cycle has ended. */
export function cycleDaysLeft(cycle: { ends_on: string }, todayKey: string): number {
  return Math.max(0, daysBetweenKeys(todayKey, cycle.ends_on) + 1)
}

export function cycleProgress(tasks: { status: string; carry_over_count: number }[]) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => IN_PROGRESS.has(t.status)).length
  const carriedOver = tasks.filter((t) => t.carry_over_count > 0).length
  return {
    total,
    done,
    inProgress,
    notStarted: total - done - inProgress,
    carriedOver,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

/** Matches the name the SQL rollover gives auto-created cycles. */
export function cycleName(startsOn: string): string {
  const label = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${startsOn}T00:00:00Z`)
  )
  return `Cycle · ${label}`
}
```

In `lib/tasks/updatable-fields.ts`:
- add `'cycle_id',` to `TASK_UPDATABLE_FIELDS`
- add `cycle_id: z.string().uuid().nullable(),` to `taskUpdateSchema`
- add a line to the header comment: "`cycle_id` is writable; the `enforce_task_cycle_workspace` trigger rejects a cycle from another workspace."

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npx vitest run __tests__/cycle.test.ts __tests__/task-update-allowlist.test.ts`
Expected: PASS

- [ ] **Step 5: Write the migration**

Create `supabase/migrations/20261008100000_cycles.sql`:

```sql
-- Cycles: timeboxed commitments per workspace, with automatic rollover.

CREATE TABLE IF NOT EXISTS public.cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  completed_at timestamptz,
  completed_count integer,
  carried_over_count integer,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cycles_dates_check CHECK (ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS cycles_workspace_start_idx ON public.cycles (workspace_id, starts_on);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.cycles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS carry_over_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS tasks_cycle_id_idx ON public.tasks (cycle_id);

ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cycles viewable by members" ON public.cycles;
CREATE POLICY "Cycles viewable by members" ON public.cycles
  FOR SELECT USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Cycles creatable by editors" ON public.cycles;
CREATE POLICY "Cycles creatable by editors" ON public.cycles
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Cycles updatable by editors" ON public.cycles;
CREATE POLICY "Cycles updatable by editors" ON public.cycles
  FOR UPDATE USING (is_workspace_editor(workspace_id)) WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Cycles deletable by admins" ON public.cycles;
CREATE POLICY "Cycles deletable by admins" ON public.cycles
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- A task may only join a cycle of its own workspace; the FK alone can't say that.
-- workspace_id may still be NULL on INSERT if this fires before
-- set_task_workspace_id, so fall back to the project's workspace.
CREATE OR REPLACE FUNCTION public.enforce_task_cycle_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  task_ws uuid := COALESCE(NEW.workspace_id, (SELECT p.workspace_id FROM public.projects p WHERE p.id = NEW.project_id));
BEGIN
  IF NEW.cycle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cycles c WHERE c.id = NEW.cycle_id AND c.workspace_id = task_ws
  ) THEN
    RAISE EXCEPTION 'Cycle belongs to a different workspace';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_enforce_task_cycle_workspace ON public.tasks;
CREATE TRIGGER trigger_enforce_task_cycle_workspace
  BEFORE INSERT OR UPDATE OF cycle_id, workspace_id, project_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_cycle_workspace();

-- Close every ended cycle: freeze its score, move unfinished tasks to the next
-- cycle (created if missing; starts today if the workspace was idle).
CREATE OR REPLACE FUNCTION public.rollover_ended_cycles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c record;
  next_id uuid;
  next_start date;
  done_count integer;
  moved_count integer;
  closed integer := 0;
BEGIN
  FOR c IN
    SELECT * FROM public.cycles
    WHERE completed_at IS NULL AND ends_on < current_date
    ORDER BY ends_on
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT id INTO next_id FROM public.cycles
    WHERE workspace_id = c.workspace_id AND starts_on > c.ends_on AND completed_at IS NULL
    ORDER BY starts_on LIMIT 1;

    IF next_id IS NULL THEN
      next_start := GREATEST(c.ends_on + 1, current_date);
      INSERT INTO public.cycles (workspace_id, name, starts_on, ends_on, created_by)
      VALUES (
        c.workspace_id,
        'Cycle · ' || to_char(next_start, 'Mon FMDD'),
        next_start,
        next_start + (c.ends_on - c.starts_on),
        c.created_by
      )
      RETURNING id INTO next_id;
    END IF;

    SELECT count(*) INTO done_count FROM public.tasks WHERE cycle_id = c.id AND status = 'done';

    UPDATE public.tasks
    SET cycle_id = next_id, carry_over_count = carry_over_count + 1
    WHERE cycle_id = c.id AND status <> 'done';
    GET DIAGNOSTICS moved_count = ROW_COUNT;

    UPDATE public.cycles
    SET completed_at = now(), completed_count = done_count, carried_over_count = moved_count
    WHERE id = c.id;

    closed := closed + 1;
  END LOOP;
  RETURN closed;
END;
$$;
REVOKE ALL ON FUNCTION public.rollover_ended_cycles() FROM public, anon, authenticated;

-- Best-effort hourly schedule (same pattern as 20260722110000).
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('rollover-ended-cycles');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  PERFORM cron.schedule('rollover-ended-cycles', '5 * * * *', $cron$SELECT public.rollover_ended_cycles();$cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (%). rollover_ended_cycles() was installed; schedule it with your own cron.', SQLERRM;
END;
$$;
```

Note: `current_date` is the database's date (UTC on Supabase), so cycles roll over at UTC midnight. That's acceptable for v1, and noted in the cycle page copy.

- [ ] **Step 6: Create the RLS harness file with cycle proofs**

Create `__tests__/rls/execution-layer.test.ts`:

```ts
/**
 * Execution-layer harness: cycles, notifications, labels.
 * Same contract as multi-tenant-boundary.test.ts: needs `supabase start`,
 * FAILS LOUDLY when the stack is unreachable. `outsider` owns workspace X and
 * has no membership in W.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const PASSWORD = 'Passw0rd!test'

let reachable = false
let unreachableReason = 'SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_KEY not set'
let admin: SupabaseClient

const ids: Record<string, string> = {}
const cli: Record<string, SupabaseClient> = {}
const row: Record<string, string> = {}

const USERS: Array<[string, string, 'W' | 'X']> = [
  ['owner', 'owner', 'W'],
  ['member', 'member', 'W'],
  ['viewer', 'viewer', 'W'],
  ['outsider', 'owner', 'X'],
]

const todayKey = () => new Date().toISOString().slice(0, 10)
const daysFromToday = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return c
}

function gate() {
  if (!reachable) throw new Error('local Supabase unreachable, so this proof is UNPROVEN: ' + unreachableReason)
}

beforeAll(async () => {
  if (!SERVICE || !ANON) return
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
  const probe = await admin.from('workspaces').select('id').limit(1)
  if (probe.error) {
    unreachableReason = probe.error.message
    return
  }
  reachable = true

  for (const [name] of USERS) {
    const created = await admin.auth.admin.createUser({ email: `${name}@exec.test`, password: PASSWORD, email_confirm: true })
    if (created.data.user) ids[name] = created.data.user.id
  }

  for (const w of ['W', 'X'] as const) {
    const owner = w === 'W' ? ids.owner : ids.outsider
    const { data } = await admin.from('workspaces').insert({ name: 'exec-' + w, owner_id: owner }).select('id').single()
    row['ws' + w] = data!.id
    const { data: p } = await admin.from('projects').insert({ workspace_id: data!.id, name: 'proj-' + w, created_by: owner }).select('id').single()
    row['project' + w] = p!.id
  }

  for (const [name, role, w] of USERS) {
    await admin.from('workspace_members').upsert(
      { workspace_id: row['ws' + w], user_id: ids[name], role },
      { onConflict: 'workspace_id,user_id' },
    )
  }

  const { data: t } = await admin
    .from('tasks')
    .insert({ project_id: row.projectW, workspace_id: row.wsW, title: 'exec-task', created_by: ids.owner })
    .select('id')
    .single()
  row.taskW = t!.id

  for (const [name] of USERS) cli[name] = await signIn(`${name}@exec.test`)
}, 180_000)

afterAll(async () => {
  if (!reachable) return
  await admin.from('workspaces').delete().in('id', [row.wsW, row.wsX])
  for (const name of Object.keys(ids)) await admin.auth.admin.deleteUser(ids[name])
})

describe('cycles', () => {
  it('rollover moves unfinished tasks forward and freezes the score', async () => {
    gate()
    const { data: old } = await admin
      .from('cycles')
      .insert({ workspace_id: row.wsW, name: 'old', starts_on: daysFromToday(-14), ends_on: daysFromToday(-8) })
      .select('id')
      .single()
    const { data: open } = await admin
      .from('tasks')
      .insert({ project_id: row.projectW, workspace_id: row.wsW, title: 'open', created_by: ids.owner, status: 'today', cycle_id: old!.id })
      .select('id')
      .single()
    const { data: done } = await admin
      .from('tasks')
      .insert({ project_id: row.projectW, workspace_id: row.wsW, title: 'done', created_by: ids.owner, status: 'done', cycle_id: old!.id })
      .select('id')
      .single()

    const { error } = await admin.rpc('rollover_ended_cycles')
    expect(error).toBeNull()

    const { data: closed } = await admin.from('cycles').select('*').eq('id', old!.id).single()
    expect(closed!.completed_at).not.toBeNull()
    expect(closed!.completed_count).toBe(1)
    expect(closed!.carried_over_count).toBe(1)

    const { data: next } = await admin
      .from('cycles')
      .select('id, starts_on, ends_on')
      .eq('workspace_id', row.wsW)
      .is('completed_at', null)
      .single()
    // Idle workspace: the next cycle starts today and keeps the 7-day length.
    expect(next!.starts_on).toBe(todayKey())
    expect(next!.ends_on).toBe(daysFromToday(6))

    const { data: moved } = await admin.from('tasks').select('cycle_id, carry_over_count').eq('id', open!.id).single()
    expect(moved).toEqual({ cycle_id: next!.id, carry_over_count: 1 })
    const { data: stayed } = await admin.from('tasks').select('cycle_id').eq('id', done!.id).single()
    expect(stayed!.cycle_id).toBe(old!.id)
    row.cycleW = next!.id
  })

  it('outsiders cannot see a workspace’s cycles', async () => {
    gate()
    const { data } = await cli.outsider.from('cycles').select('id').eq('workspace_id', row.wsW)
    expect(data ?? []).toHaveLength(0)
  })

  it('viewers cannot create cycles', async () => {
    gate()
    const { error } = await cli.viewer
      .from('cycles')
      .insert({ workspace_id: row.wsW, name: 'nope', starts_on: daysFromToday(30), ends_on: daysFromToday(36) })
    expect(error).not.toBeNull()
  })

  it('a task cannot join a cycle from another workspace', async () => {
    gate()
    const { data: foreign } = await admin
      .from('cycles')
      .insert({ workspace_id: row.wsX, name: 'x', starts_on: todayKey(), ends_on: daysFromToday(6) })
      .select('id')
      .single()
    const { error } = await cli.member.from('tasks').update({ cycle_id: foreign!.id }).eq('id', row.taskW)
    expect(error?.message ?? '').toContain('Cycle belongs to a different workspace')
  })

  it('clients cannot run the rollover', async () => {
    gate()
    const { error } = await cli.member.rpc('rollover_ended_cycles')
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 7: Run the harness (Docker)**

Run: `npx supabase start && npx supabase db reset && npm run test:rls`
Expected: the five cycle tests PASS, as do the existing boundary tests. If Docker is unavailable, report "RLS harness NOT run".

- [ ] **Step 8: Server action**

Create `app/actions/cycles.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { canEditWorkspace } from '@/app/actions/roles'
import { dateKeyInTimeZone } from '@/lib/tasks/my-day'
import { currentCycle, cycleName, newCycleDates } from '@/lib/cycles/cycle'

type Result = { success: true } | { success: false; error: string }

export async function startCycle(weeks: number): Promise<Result> {
  if (weeks !== 1 && weeks !== 2) return { success: false, error: 'A cycle is 1 or 2 weeks' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return { success: false, error: 'Create or join a workspace first' }
  if (!(await canEditWorkspace(workspaceId))) return { success: false, error: 'Viewers cannot start cycles' }

  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(new Date(), profile?.timezone)

  const { data: open } = await supabase
    .from('cycles')
    .select('id, starts_on, ends_on, completed_at')
    .eq('workspace_id', workspaceId)
    .is('completed_at', null)
  if (currentCycle(open ?? [], todayKey)) return { success: false, error: 'A cycle is already running' }

  const dates = newCycleDates(todayKey, weeks)
  const { error } = await supabase
    .from('cycles')
    .insert({ workspace_id: workspaceId, name: cycleName(dates.starts_on), ...dates, created_by: user.id })
  if (error) {
    return { success: false, error: error.code === '23505' ? 'A cycle already starts today' : error.message }
  }

  revalidatePath('/dashboard/cycle')
  return { success: true }
}
```

- [ ] **Step 9: Tasks join cycles**

In `app/actions/tasks.ts`:
- `createTaskSchema`: add `cycle_id: z.string().uuid().nullable().optional(),`
- the `createTask` insert object: add `cycle_id: validated.data.cycle_id ?? null,`
- add imports:
  ```ts
  import { currentCycle } from '@/lib/cycles/cycle'
  import { dateKeyInTimeZone } from '@/lib/tasks/my-day'
  ```
- in `quickAddTask`, before the final `return createTask(...)`, add:

```ts
  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const { data: openCycles } = await supabase
    .from('cycles')
    .select('id, starts_on, ends_on, completed_at')
    .eq('workspace_id', workspaceId)
    .is('completed_at', null)
  const running = currentCycle(openCycles ?? [], dateKeyInTimeZone(new Date(), profile?.timezone))
```

and change the return to:

```ts
  return createTask({ project_id: projectId, title: validated.data.title, status: 'today', owner_id: user.id, cycle_id: running?.id ?? null })
```

In `app/actions/task-fetcher.ts`, after the `memberRows` query, add:

```ts
  const { data: cycleRows } = await supabase
    .from('cycles')
    .select('id, name, starts_on')
    .eq('workspace_id', (task.projects as any)?.workspace_id)
    .is('completed_at', null)
    .order('starts_on', { ascending: true })
```

and add `cycles: cycleRows || [],` to the returned object.

- [ ] **Step 10: Cycle field in the drawer**

Replace `components/tasks/task-edit-fields.tsx` with this version, which adds the Cycle select:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { updateTask } from '@/app/actions/task-details'
import { TASK_PRIORITIES, type TaskUpdate } from '@/lib/tasks/updatable-fields'
import { toDeadlineIso, dateInputFromDeadline } from '@/lib/tasks/deadline'

export function TaskEditFields({
  taskId,
  projectId,
  workspaceId,
  title,
  priority,
  deadline,
  cycleId,
  cycleOptions,
  onSaved,
}: {
  taskId: string
  projectId: string
  workspaceId: string
  title: string
  priority: string
  deadline: string | null
  cycleId: string | null
  cycleOptions: { id: string; name: string }[]
  onSaved: () => void
}) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [saving, setSaving] = useState(false)

  async function save(fields: TaskUpdate) {
    setSaving(true)
    try {
      if (!navigator.onLine) {
        const { addToSyncQueue } = await import('@/lib/offline/sync-queue')
        await addToSyncQueue('update_task', 'task', taskId, fields, workspaceId, projectId)
        toast.success('Saved offline. It will sync when you reconnect.')
      } else {
        const res = await updateTask(taskId, fields, projectId)
        if ('error' in res && res.error) {
          toast.error(res.error)
          return
        }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'mt-1 block h-9 w-full rounded-lg border border-border bg-white px-2 text-sm'

  return (
    <div className="mb-6 space-y-3">
      <label className="block text-xs font-semibold text-muted-foreground">
        Title
        <Input
          value={draftTitle}
          disabled={saving}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => {
            const value = draftTitle.trim()
            if (value && value !== title) save({ title: value })
            else setDraftTitle(title)
          }}
          className="mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-muted-foreground">
          Priority
          <select
            value={priority}
            disabled={saving}
            onChange={(e) => save({ priority: e.target.value as NonNullable<TaskUpdate['priority']> })}
            className={fieldClass}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Due
          <input
            type="date"
            value={dateInputFromDeadline(deadline)}
            disabled={saving}
            onChange={(e) => save({ deadline: toDeadlineIso(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Cycle
          <select
            value={cycleId ?? ''}
            disabled={saving}
            onChange={(e) => save({ cycle_id: e.target.value || null })}
            className={fieldClass}
          >
            <option value="">No cycle</option>
            {cycleOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
```

In `components/tasks/task-detail-drawer.tsx`, add these two props to the `<TaskEditFields ... />` element:

```tsx
              cycleId={data.task.cycle_id ?? null}
              cycleOptions={data.cycles ?? []}
```

- [ ] **Step 11: Start-cycle form and the Cycle page**

Create `components/cycles/start-cycle-form.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { startCycle } from '@/app/actions/cycles'

export function StartCycleForm() {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function start(weeks: 1 | 2) {
    startTransition(async () => {
      const res = await startCycle(weeks)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(`${weeks}-week cycle started`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => start(1)} className="rounded-xl">Start a 1-week cycle</Button>
      <Button disabled={pending} variant="outline" onClick={() => start(2)} className="rounded-xl">Start a 2-week cycle</Button>
    </div>
  )
}
```

Create `app/dashboard/cycle/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { canEditWorkspace } from '@/app/actions/roles'
import { dateKeyInTimeZone } from '@/lib/tasks/my-day'
import { currentCycle, cycleDaysLeft, cycleProgress, type CycleRow } from '@/lib/cycles/cycle'
import { StartCycleForm } from '@/components/cycles/start-cycle-form'

type CycleTask = { id: string; title: string; status: string; project_id: string; carry_over_count: number }

const GROUPS: { title: string; match: (s: string) => boolean }[] = [
  { title: 'Not started', match: (s) => s === 'backlog' || s === 'today' },
  { title: 'In progress', match: (s) => s === 'doing' || s === 'review' || s === 'blocked' },
  { title: 'Done', match: (s) => s === 'done' },
]

export default async function CyclePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return <p className="text-muted-foreground">Create or join a workspace first.</p>

  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(new Date(), profile?.timezone)

  const [{ data: cyclesRaw }, canEdit] = await Promise.all([
    supabase
      .from('cycles')
      .select('id, name, starts_on, ends_on, completed_at, completed_count, carried_over_count')
      .eq('workspace_id', workspaceId)
      .order('starts_on', { ascending: false })
      .limit(12),
    canEditWorkspace(workspaceId),
  ])
  const cycles = (cyclesRaw ?? []) as CycleRow[]
  const current = currentCycle(cycles, todayKey)
  const past = cycles.filter((c) => c.completed_at)

  const { data: tasksRaw } = current
    ? await supabase.from('tasks').select('id, title, status, project_id, carry_over_count').eq('cycle_id', current.id)
    : { data: [] }
  const tasks = (tasksRaw ?? []) as CycleTask[]
  const progress = cycleProgress(tasks)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <h1 className="text-3xl font-bold tracking-tight">Cycle</h1>

      {!current ? (
        <section className="space-y-4 rounded-2xl border border-border/60 bg-white p-6">
          <p className="font-medium">No cycle is running.</p>
          <p className="text-sm text-muted-foreground">
            A cycle is what the team commits to for the next week or two. Unfinished work rolls into the next cycle automatically.
          </p>
          {canEdit && <StartCycleForm />}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">{current.name}</h2>
              <p className="text-sm text-muted-foreground">
                {current.starts_on} → {current.ends_on} · {cycleDaysLeft(current, todayKey)} days left
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${progress.percent}% done`}>
              <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {progress.done}/{progress.total} done · {progress.inProgress} in progress · {progress.carriedOver} carried over
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add tasks from the task drawer (Cycle field). Quick add on Home joins this cycle. Rollover runs hourly after the end date (UTC).
            </p>
          </div>

          {GROUPS.map((group) => {
            const items = tasks.filter((t) => group.match(t.status))
            return (
              <div key={group.title}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title} ({items.length})
                </h3>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/dashboard/projects/${t.project_id}`}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 hover:bg-slate-50"
                      >
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.carry_over_count > 0 && (
                          <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            carried ×{t.carry_over_count}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Past cycles</h3>
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
            {past.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.completed_count ?? 0} done · {c.carried_over_count ?? 0} carried over
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 12: Give Cycle a nav slot**

Update `__tests__/navigation.test.ts` first. Add:

```ts
  it('puts Cycle in the mobile bar and moves Rhythms to More', () => {
    expect(mobileNavItems().map((i) => i.href)).toEqual([
      '/dashboard',
      '/dashboard/projects',
      '/dashboard/cycle',
      '/dashboard/team',
      '/dashboard/more',
    ])
    expect(moreNavItems().map((i) => i.href)).toContain('/dashboard/rhythms')
  })
```

Run `npx vitest run __tests__/navigation.test.ts`. Expected: FAIL.

Then in `lib/navigation.ts`:
- add `Target` to the lucide import
- insert `{ href: '/dashboard/cycle', label: 'Cycle', icon: Target, mobile: true },` after the Projects entry
- change Rhythms to `mobile: false`

Re-run. Expected: PASS.

- [ ] **Step 13: Deploy doc**

In `docs/DEPLOY.md` §4, change the "Expected:" line to:

```
Expected: the three jobs above plus the DB-native jobs from migrations (`process-due-focus-schedules`, `rollover-ended-cycles`), all `active = true`.
```

- [ ] **Step 14: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add supabase/migrations/20261008100000_cycles.sql lib/dates.ts lib/cycles app/actions/cycles.ts app/dashboard/cycle components/cycles lib/navigation.ts lib/tasks/updatable-fields.ts app/actions/tasks.ts app/actions/task-fetcher.ts components/tasks/task-edit-fields.tsx components/tasks/task-detail-drawer.tsx docs/DEPLOY.md __tests__/cycle.test.ts __tests__/navigation.test.ts __tests__/task-update-allowlist.test.ts __tests__/rls/execution-layer.test.ts
git commit -m "feat: cycles with automatic rollover, cycle page, cycle field on tasks"
```

---

### Task 15: ⌘K actions and keyboard shortcuts

**Why:** ⌘K only searches. Linear's ⌘K is a command bar. Make the existing palette run the commands people use most, and add single keys for the task drawer.

**Simple by design:**
- Global keys:
  - `⌘K`/`Ctrl+K` toggles the palette
  - `/` opens it
  - `c` opens it in create mode, where you type a title and press Enter
- Drawer keys: `s` status, `a` assignee, `p` priority, `d` due date. Each one focuses or opens that control. No new menus.
- Keys never fire while typing in an input.

**Files:**
- Create: `lib/command-actions.ts`
- Create: `lib/shortcuts.ts`
- Modify: `components/app-shell/global-search.tsx`, `components/app-shell/topbar.tsx`, `app/dashboard/layout.tsx` (pass `canEdit`)
- Modify: `components/tasks/task-edit-fields.tsx` (status select + `data-shortcut` attributes)
- Modify: `components/tasks/task-detail-drawer.tsx` (key handler + hint)
- Test: `__tests__/command-actions.test.ts`, `__tests__/shortcuts.test.ts`

**Interfaces:**
- Produces from `lib/command-actions.ts`:
  - `CommandAction` (union: `navigate` with `href`, `create-task` with `title`, `start-focus`)
  - `EXTRA_DESTINATIONS: { href: string; label: string }[]`
  - `buildCommandActions(query: string, opts: { canEdit: boolean; createOnly?: boolean }): CommandAction[]`
- Produces from `lib/shortcuts.ts`:
  - `isTypingTarget(target: EventTarget | null): boolean`
  - `globalShortcutFor(e: KeyLike): 'toggle-palette' | 'open-palette' | 'create-task' | null`
  - `taskShortcutFor(e: KeyLike): 'status' | 'assignee' | 'priority' | 'due' | null`
- Consumes: `NAV_ITEMS` (Tasks 8/14), `quickAddTask` (Task 9), `createInstantFocusSession(durationMinutes?)` (returns `{ success: boolean; error?: { message: string } }`)

- [ ] **Step 1: Write the failing tests**

Create `__tests__/command-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildCommandActions } from '@/lib/command-actions'

describe('buildCommandActions', () => {
  it('lists navigation and focus when the query is empty', () => {
    const actions = buildCommandActions('', { canEdit: true })
    expect(actions.some((a) => a.kind === 'start-focus')).toBe(true)
    expect(actions.some((a) => a.kind === 'navigate' && a.href === '/dashboard/team')).toBe(true)
    expect(actions.some((a) => a.kind === 'create-task')).toBe(false)
  })

  it('offers "create task" first for any typed text', () => {
    const [first] = buildCommandActions('Write launch email', { canEdit: true })
    expect(first).toMatchObject({ kind: 'create-task', title: 'Write launch email' })
  })

  it('filters other actions by the query', () => {
    const actions = buildCommandActions('team', { canEdit: true })
    expect(actions.filter((a) => a.kind === 'navigate').map((a) => a.kind === 'navigate' && a.href)).toEqual(['/dashboard/team'])
  })

  it('hides write actions from viewers', () => {
    const actions = buildCommandActions('anything', { canEdit: false })
    expect(actions.some((a) => a.kind === 'create-task' || a.kind === 'start-focus')).toBe(false)
  })

  it('create mode shows only the create action', () => {
    expect(buildCommandActions('Fix login', { canEdit: true, createOnly: true }).map((a) => a.kind)).toEqual(['create-task'])
    expect(buildCommandActions('', { canEdit: true, createOnly: true })).toEqual([])
  })
})
```

Create `__tests__/shortcuts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isTypingTarget, globalShortcutFor, taskShortcutFor } from '@/lib/shortcuts'

describe('isTypingTarget', () => {
  it('is true for text fields and contenteditable', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    expect(isTypingTarget(div)).toBe(true)
  })
  it('is false for buttons, plain elements and null', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('globalShortcutFor', () => {
  it('maps the global keys', () => {
    expect(globalShortcutFor({ key: 'k', metaKey: true })).toBe('toggle-palette')
    expect(globalShortcutFor({ key: 'K', ctrlKey: true })).toBe('toggle-palette')
    expect(globalShortcutFor({ key: '/' })).toBe('open-palette')
    expect(globalShortcutFor({ key: 'c' })).toBe('create-task')
  })
  it('ignores modified single keys and unknown keys', () => {
    expect(globalShortcutFor({ key: 'c', metaKey: true })).toBeNull()
    expect(globalShortcutFor({ key: 'x' })).toBeNull()
  })
})

describe('taskShortcutFor', () => {
  it('maps s/a/p/d', () => {
    expect(taskShortcutFor({ key: 's' })).toBe('status')
    expect(taskShortcutFor({ key: 'a' })).toBe('assignee')
    expect(taskShortcutFor({ key: 'p' })).toBe('priority')
    expect(taskShortcutFor({ key: 'd' })).toBe('due')
  })
  it('ignores modifiers so browser shortcuts keep working', () => {
    expect(taskShortcutFor({ key: 's', ctrlKey: true })).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/command-actions.test.ts __tests__/shortcuts.test.ts`
Expected: FAIL (imports cannot be resolved)

- [ ] **Step 3: Implement**

`lib/command-actions.ts`:

```ts
import { NAV_ITEMS } from '@/lib/navigation'

export type CommandAction =
  | { id: string; kind: 'navigate'; label: string; href: string; keywords: string }
  | { id: string; kind: 'create-task'; label: string; title: string; keywords: string }
  | { id: string; kind: 'start-focus'; label: string; keywords: string }

/** Destinations reachable from ⌘K that are not in the main nav. */
export const EXTRA_DESTINATIONS: { href: string; label: string }[] = [{ href: '/dashboard/invites', label: 'Invites' }]

function staticActions(): CommandAction[] {
  const destinations = [...NAV_ITEMS.map(({ href, label }) => ({ href, label })), ...EXTRA_DESTINATIONS]
  return [
    { id: 'start-focus', kind: 'start-focus', label: 'Start a focus session', keywords: 'focus pomodoro timer start' },
    ...destinations.map(
      (d): CommandAction => ({
        id: `go-${d.href}`,
        kind: 'navigate',
        label: `Go to ${d.label}`,
        href: d.href,
        keywords: `go open ${d.label.toLowerCase()}`,
      })
    ),
  ]
}

export function buildCommandActions(query: string, opts: { canEdit: boolean; createOnly?: boolean }): CommandAction[] {
  const q = query.trim()
  const create: CommandAction[] =
    q && opts.canEdit ? [{ id: 'create-task', kind: 'create-task', label: `Create task "${q}"`, title: q, keywords: '' }] : []
  if (opts.createOnly) return create

  const lower = q.toLowerCase()
  const matches = staticActions()
    .filter((a) => a.kind !== 'start-focus' || opts.canEdit)
    .filter((a) => !lower || a.label.toLowerCase().includes(lower) || a.keywords.includes(lower))
  return [...create, ...matches]
}
```

`lib/shortcuts.ts`:

```ts
export type KeyLike = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }

/** True when a keypress belongs to a text field, not to a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

export function globalShortcutFor(e: KeyLike): 'toggle-palette' | 'open-palette' | 'create-task' | null {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return 'toggle-palette'
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.key === '/') return 'open-palette'
  if (e.key === 'c') return 'create-task'
  return null
}

const TASK_KEYS: Record<string, 'status' | 'assignee' | 'priority' | 'due'> = {
  s: 'status',
  a: 'assignee',
  p: 'priority',
  d: 'due',
}

export function taskShortcutFor(e: KeyLike): 'status' | 'assignee' | 'priority' | 'due' | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return TASK_KEYS[e.key] ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/command-actions.test.ts __tests__/shortcuts.test.ts`
Expected: PASS

- [ ] **Step 5: Pass `canEdit` down to the palette**

In `app/dashboard/layout.tsx`:
- add `import { canEditWorkspace } from '@/app/actions/roles'`
- after `activeWorkspaceId` is resolved, add `const canEdit = activeWorkspaceId ? await canEditWorkspace(activeWorkspaceId) : false`
- pass `canEdit={canEdit}` to `<Topbar ... />`

In `components/app-shell/topbar.tsx`, add `canEdit?: boolean` to the props type and destructuring, and render `<GlobalSearch canEdit={!!canEdit} />`.

- [ ] **Step 6: Wire actions and global keys into the palette**

In `components/app-shell/global-search.tsx`:
- signature: `export function GlobalSearch({ canEdit = false }: { canEdit?: boolean })`
- add imports:

```ts
import { toast } from 'sonner'
import { Zap, Timer, ArrowRight } from 'lucide-react'
import { buildCommandActions, type CommandAction } from '@/lib/command-actions'
import { globalShortcutFor, isTypingTarget } from '@/lib/shortcuts'
import { quickAddTask } from '@/app/actions/tasks'
import { createInstantFocusSession } from '@/app/actions/focus'
```

- add state: `const [createOnly, setCreateOnly] = React.useState(false)`
- replace the ⌘K `useEffect` with:

```tsx
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const shortcut = globalShortcutFor(e)
      if (!shortcut) return
      if (shortcut === 'toggle-palette') {
        e.preventDefault()
        setCreateOnly(false)
        setOpen((o) => !o)
        return
      }
      if (isTypingTarget(e.target)) return
      if (shortcut === 'create-task' && !canEdit) return
      e.preventDefault()
      setCreateOnly(shortcut === 'create-task')
      setOpen(true)
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [canEdit])
```

- in the debounced search effect, add `if (createOnly) return` right after the `if (!search) {...}` block, and add `createOnly` to its dependency array
- add the action runner and the computed list above `return`:

```tsx
  const actions = buildCommandActions(search, { canEdit, createOnly })

  const closePalette = () => {
    setOpen(false)
    setSearch('')
    setCreateOnly(false)
  }

  const runAction = async (action: CommandAction) => {
    if (action.kind === 'navigate') {
      handleSelect(action.href)
      setCreateOnly(false)
      return
    }
    closePalette()
    if (action.kind === 'create-task') {
      const res = await quickAddTask(action.title)
      if (!res.success) toast.error(res.error?.message ?? 'Could not add task')
      else {
        toast.success('Task added to today')
        router.refresh()
      }
      return
    }
    const res = await createInstantFocusSession()
    if (!res?.success) toast.error(res?.error?.message ?? 'Could not start a focus session')
    else router.refresh()
  }
```

- change the `Command.Input` placeholder to `{createOnly ? 'Task title, then Enter…' : 'Search or type a command…'}`
- change the empty-state condition to `!loading && search && !createOnly && actions.length === 0 && results.tasks.length === 0 && results.projects.length === 0`
- as the first child of `Command.List`, render:

```tsx
              {actions.length > 0 && (
                <Command.Group heading={createOnly ? 'Create' : 'Actions'} className="text-xs font-medium text-slate-500 p-2">
                  {actions.map((action) => (
                    <Command.Item
                      key={action.id}
                      onSelect={() => runAction(action)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer aria-selected:bg-slate-100 aria-selected:text-primary"
                    >
                      {action.kind === 'create-task' ? <Zap className="w-4 h-4 text-slate-400" /> : action.kind === 'start-focus' ? <Timer className="w-4 h-4 text-slate-400" /> : <ArrowRight className="w-4 h-4 text-slate-400" />}
                      {action.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {createOnly && !search && (
                <div className="p-4 text-center text-sm text-slate-500">Type a task title and press Enter. It goes to today.</div>
              )}
```

- wrap the Projects and Tasks groups in `{!createOnly && ( <>...</> )}`
- make the X button call `closePalette()`

- [ ] **Step 7: Status select and shortcut targets in the drawer fields**

In `components/tasks/task-edit-fields.tsx` (the Task 14 version):
- add `TASK_STATUSES` to the import from `@/lib/tasks/updatable-fields`
- add `status: string` to the props type and destructuring
- add `data-shortcut="priority"` to the priority `<select>`, and `data-shortcut="due"` to the date `<input>`
- change the grid to `grid grid-cols-2 gap-3 sm:grid-cols-4`
- add this as the **first** cell of the grid:

```tsx
        <label className="text-xs font-semibold text-muted-foreground">
          Status
          <select
            data-shortcut="status"
            value={status}
            disabled={saving}
            onChange={(e) => save({ status: e.target.value as NonNullable<TaskUpdate['status']> })}
            className={fieldClass}
          >
            {TASK_STATUSES.filter((s) => s !== 'blocked' || status === 'blocked').map((s) => (
              <option key={s} value={s} disabled={s === 'blocked'}>
                {s}
              </option>
            ))}
          </select>
        </label>
```

(`blocked` needs a reason, so it stays on the board's "Mark Blocked" flow and is only shown here when it is the current value.)

In `components/tasks/task-detail-drawer.tsx`:
- pass `status={data.task.status}` to `<TaskEditFields />`
- add `data-shortcut="assignee"` to the `<button>` inside the assignee `DropdownMenuTrigger`'s `render`
- add imports:
  ```ts
  import { useRef } from "react"; // merge with the existing react import
  import { isTypingTarget, taskShortcutFor } from "@/lib/shortcuts";
  ```
- add `const contentRef = useRef<HTMLDivElement>(null);` and put `ref={contentRef}` on the scrolling `<div className="flex-1 overflow-y-auto ...">`
- add the effect:

```tsx
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const shortcut = taskShortcutFor(e);
      if (!shortcut) return;
      const el = contentRef.current?.querySelector<HTMLElement>(`[data-shortcut="${shortcut}"]`);
      if (!el) return;
      e.preventDefault();
      if (shortcut === "assignee") el.click();
      else el.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
```

- under the header row, add the hint: `<p className="text-xs text-muted-foreground mb-4">Shortcuts: <kbd>S</kbd> status · <kbd>A</kbd> assignee · <kbd>P</kbd> priority · <kbd>D</kbd> due</p>`

- [ ] **Step 8: Visual check**

In the preview:
- `/` opens the palette
- `c`, then type "Ship it" and press Enter: the task appears on Home
- `⌘K`, then type "team" and press Enter: you land on the Team page
- open a task drawer and press `p`: the priority select is focused
- press `a`: the assignee menu opens
- typing in the title field does **not** trigger shortcuts

Take a screenshot of the palette's Actions group.

- [ ] **Step 9: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add lib/command-actions.ts lib/shortcuts.ts components/app-shell/global-search.tsx components/app-shell/topbar.tsx app/dashboard/layout.tsx components/tasks/task-edit-fields.tsx components/tasks/task-detail-drawer.tsx __tests__/command-actions.test.ts __tests__/shortcuts.test.ts
git commit -m "feat: command palette actions and keyboard shortcuts"
```

---

### Task 16: In-app inbox

**Why:** Notifications are push-only. A missed push is gone, and there's nowhere to see "assigned to me", "comment on my task" or "my task got blocked". This closes the loop on the blockers that Team Pulse already detects.

**Simple by design:**
- Database triggers write the rows, so no server action can forget to notify, and offline-synced edits notify too.
- Three event types: `assigned`, `comment`, `blocked`.
- The actor is never notified about their own action.
- Removed members get nothing.
- A bell with a count in the top bar, not a nav item. One page lists the last 50.

**Files:**
- Create: `supabase/migrations/20261008110000_notifications.sql`
- Create: `lib/notifications.ts`
- Create: `app/actions/notifications.ts`
- Create: `app/dashboard/inbox/page.tsx`
- Create: `components/inbox/inbox-list.tsx`
- Create: `components/app-shell/inbox-bell.tsx`
- Modify: `lib/realtime-subscriptions.ts` + `lib/realtime-subscriptions.test.ts`
- Modify: `hooks/use-realtime.ts`, `components/app-shell/realtime-pulse.tsx`
- Modify: `app/dashboard/layout.tsx`, `components/app-shell/topbar.tsx`
- Modify: `lib/command-actions.ts` (Inbox destination)
- Modify: `__tests__/rls/execution-layer.test.ts` (append)
- Test: `__tests__/notifications.test.ts`

**Interfaces:**
- Produces:
  - `describeNotification(n: { type: string; actorName: string | null; taskTitle: string | null; body: string | null }): string`
  - `markNotificationRead(id: string)` and `markAllNotificationsRead()`, both returning `{ success: true } | { success: false; error: string }`
  - `getUserNotificationSubscription(userId: string): RealtimeSubscriptionConfig`
  - `useRealtimeSync(workspaceId?: string, userId?: string)`
  - `InboxBell` props: `{ count: number }`
- Produces in the database: `public.notifications` with columns `id`, `user_id`, `workspace_id`, `task_id`, `actor_id`, `type`, `body`, `read_at`, `created_at`. No client INSERT.

- [ ] **Step 1: Write the failing unit tests**

Create `__tests__/notifications.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { describeNotification } from '@/lib/notifications'
import { getUserNotificationSubscription } from '@/lib/realtime-subscriptions'

describe('describeNotification', () => {
  it('describes each event type', () => {
    expect(describeNotification({ type: 'assigned', actorName: 'Ada', taskTitle: 'Ship v2', body: null })).toBe('Ada assigned you "Ship v2"')
    expect(describeNotification({ type: 'comment', actorName: 'Ada', taskTitle: 'Ship v2', body: 'looks good' })).toBe(
      'Ada commented on "Ship v2": looks good'
    )
    expect(describeNotification({ type: 'blocked', actorName: 'Ada', taskTitle: 'Ship v2', body: 'waiting on API' })).toBe(
      'Ada marked "Ship v2" blocked: waiting on API'
    )
  })
  it('falls back gracefully when names are missing', () => {
    expect(describeNotification({ type: 'assigned', actorName: null, taskTitle: null, body: null })).toBe('Someone assigned you a task')
  })
})

describe('notification realtime subscription', () => {
  it('listens for new rows addressed to the user', () => {
    expect(getUserNotificationSubscription('user-1')).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: 'user_id=eq.user-1',
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/notifications.test.ts`
Expected: FAIL (imports cannot be resolved / not a function)

- [ ] **Step 3: Implement the pure parts**

`lib/notifications.ts`:

```ts
export function describeNotification(n: {
  type: string
  actorName: string | null
  taskTitle: string | null
  body: string | null
}): string {
  const who = n.actorName ?? 'Someone'
  const task = n.taskTitle ? `"${n.taskTitle}"` : 'a task'
  switch (n.type) {
    case 'assigned':
      return `${who} assigned you ${task}`
    case 'comment':
      return `${who} commented on ${task}${n.body ? `: ${n.body}` : ''}`
    case 'blocked':
      return `${who} marked ${task} blocked${n.body ? `: ${n.body}` : ''}`
    default:
      return `${who} updated ${task}`
  }
}
```

Append to `lib/realtime-subscriptions.ts`:

```ts
export function getUserNotificationSubscription(userId: string): RealtimeSubscriptionConfig {
  return {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }
}
```

Run: `npx vitest run __tests__/notifications.test.ts lib/realtime-subscriptions.test.ts`
Expected: PASS

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20261008110000_notifications.sql`:

```sql
-- In-app inbox. Rows are written ONLY by the triggers below (SECURITY DEFINER);
-- clients can read, mark read and delete their own, never insert.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('assigned', 'comment', 'blocked')),
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications readable by recipient" ON public.notifications;
CREATE POLICY "Notifications readable by recipient" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Notifications updatable by recipient" ON public.notifications;
CREATE POLICY "Notifications updatable by recipient" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Notifications deletable by recipient" ON public.notifications;
CREATE POLICY "Notifications deletable by recipient" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Insert one notification per distinct recipient, skipping the actor and anyone
-- who is no longer a member of the workspace.
CREATE OR REPLACE FUNCTION public.notify_recipients(
  recipients uuid[], ws uuid, task uuid, actor uuid, kind text, detail text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.notifications (user_id, workspace_id, task_id, actor_id, type, body)
  SELECT DISTINCT r, ws, task, actor, kind, left(detail, 200)
  FROM unnest(recipients) AS r
  WHERE r IS NOT NULL
    AND r IS DISTINCT FROM actor
    AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = ws AND m.user_id = r);
$$;
REVOKE ALL ON FUNCTION public.notify_recipients(uuid[], uuid, uuid, uuid, text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF NEW.owner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    PERFORM public.notify_recipients(ARRAY[NEW.owner_id], NEW.workspace_id, NEW.id, actor, 'assigned', NEW.title);
  END IF;

  IF NEW.status = 'blocked'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'blocked') THEN
    PERFORM public.notify_recipients(ARRAY[NEW.owner_id, NEW.created_by], NEW.workspace_id, NEW.id, actor, 'blocked', NEW.blocked_reason);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_task_changes ON public.tasks;
CREATE TRIGGER trigger_notify_task_changes
  AFTER INSERT OR UPDATE OF owner_id, status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_changes();

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t record;
BEGIN
  SELECT id, owner_id, created_by, workspace_id INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF FOUND THEN
    PERFORM public.notify_recipients(ARRAY[t.owner_id, t.created_by], t.workspace_id, t.id, NEW.user_id, 'comment', NEW.content);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_task_comment ON public.task_comments;
CREATE TRIGGER trigger_notify_task_comment
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

-- Live inbox: publish to Realtime (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
```

- [ ] **Step 5: Append the trigger and RLS proofs to the harness**

Append to `__tests__/rls/execution-layer.test.ts`:

```ts
describe('notifications', () => {
  async function inbox(user: string, type: string) {
    const { data } = await admin
      .from('notifications')
      .select('id, actor_id')
      .eq('user_id', ids[user])
      .eq('task_id', row.taskW)
      .eq('type', type)
    return data ?? []
  }

  it('assigning a task notifies the assignee, not the actor', async () => {
    gate()
    await cli.owner.from('tasks').update({ owner_id: ids.member }).eq('id', row.taskW)
    expect(await inbox('member', 'assigned')).toHaveLength(1)
    expect(await inbox('owner', 'assigned')).toHaveLength(0)
  })

  it('a comment notifies the owner and creator, never the commenter', async () => {
    gate()
    await cli.member
      .from('task_comments')
      .insert({ task_id: row.taskW, user_id: ids.member, content: 'on it', workspace_id: row.wsW, project_id: row.projectW })
    expect(await inbox('owner', 'comment')).toHaveLength(1)
    expect(await inbox('member', 'comment')).toHaveLength(0)
  })

  it('marking blocked notifies the owner and creator except the actor', async () => {
    gate()
    await cli.owner.from('tasks').update({ status: 'blocked', blocked_reason: 'waiting on API' }).eq('id', row.taskW)
    expect(await inbox('member', 'blocked')).toHaveLength(1)
    expect(await inbox('owner', 'blocked')).toHaveLength(0)
  })

  it('users only see their own notifications', async () => {
    gate()
    const { data } = await cli.owner.from('notifications').select('id').eq('user_id', ids.member)
    expect(data ?? []).toHaveLength(0)
  })

  it('clients cannot forge notifications', async () => {
    gate()
    const { error } = await cli.member
      .from('notifications')
      .insert({ user_id: ids.owner, workspace_id: row.wsW, type: 'assigned', body: 'fake' })
    expect(error).not.toBeNull()
  })
})
```

Run: `npx supabase db reset && npm run test:rls`
Expected: PASS. Without Docker, report "RLS harness NOT run".

- [ ] **Step 6: Actions, page and bell**

`app/actions/notifications.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Result = { success: true } | { success: false; error: string }

export async function markNotificationRead(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: 'Invalid input' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function markAllNotificationsRead(): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
```

`components/app-shell/inbox-bell.tsx`:

```tsx
import Link from 'next/link'
import { Bell } from 'lucide-react'

export function InboxBell({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/inbox"
      aria-label={count > 0 ? `Inbox, ${count} unread` : 'Inbox'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white hover:bg-slate-50"
    >
      <Bell className="h-4 w-4 text-slate-600" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
```

`components/inbox/inbox-list.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications'

export type InboxItem = { id: string; text: string; href: string; unread: boolean; createdAt: string }

export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const unread = items.filter((i) => i.unread).length

  function open(item: InboxItem) {
    startTransition(async () => {
      if (item.unread) await markNotificationRead(item.id)
      router.push(item.href)
    })
  }

  function readAll() {
    startTransition(async () => {
      const res = await markAllNotificationsRead()
      if (!res.success) toast.error(res.error)
      else router.refresh()
    })
  }

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing here yet. Assignments, comments and blockers on your tasks will show up here.</p>

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <Button variant="outline" size="sm" disabled={pending} onClick={readAll}>
          Mark all {unread} as read
        </Button>
      )}
      <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => open(item)}
              disabled={pending}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className={item.unread ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary' : 'mt-1.5 h-2 w-2 shrink-0'} />
              <span className="flex-1">
                <span className={item.unread ? 'block text-sm font-semibold' : 'block text-sm'}>{item.text}</span>
                <span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

`app/dashboard/inbox/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { describeNotification } from '@/lib/notifications'
import { InboxList, type InboxItem } from '@/components/inbox/inbox-list'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rows } = await supabase
    .from('notifications')
    .select('id, type, body, read_at, created_at, actor_id, tasks(title, project_id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)))
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] }
  const nameById = new Map((actors ?? []).map((a: any) => [a.id, a.full_name as string | null]))

  const items: InboxItem[] = (rows ?? []).map((r: any) => {
    const task = Array.isArray(r.tasks) ? r.tasks[0] : r.tasks
    return {
      id: r.id,
      text: describeNotification({
        type: r.type,
        actorName: nameById.get(r.actor_id) ?? null,
        taskTitle: task?.title ?? null,
        body: r.body,
      }),
      href: task?.project_id ? `/dashboard/projects/${task.project_id}` : '/dashboard',
      unread: !r.read_at,
      createdAt: r.created_at,
    }
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">
      <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
      <InboxList items={items} />
    </div>
  )
}
```

- [ ] **Step 7: Bell in the top bar, live updates**

In `app/dashboard/layout.tsx`:
- add:

```ts
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
```

- pass `unreadCount={unreadCount ?? 0}` to `<Topbar />`
- change `<RealtimePulse workspaceId={activeWorkspaceId} />` to `<RealtimePulse workspaceId={activeWorkspaceId} userId={user.id} />`

In `components/app-shell/topbar.tsx`:
- add `unreadCount?: number` to the props
- add `import { InboxBell } from './inbox-bell'`
- render `<InboxBell count={unreadCount ?? 0} />` just before `<SyncStatusPill ... />`

`components/app-shell/realtime-pulse.tsx`:

```tsx
'use client'

import { useRealtimeSync } from '@/hooks/use-realtime'

export function RealtimePulse({ workspaceId, userId }: { workspaceId?: string; userId?: string }) {
  useRealtimeSync(workspaceId, userId)
  return null
}
```

In `hooks/use-realtime.ts`:
- signature: `export function useRealtimeSync(workspaceId?: string, userId?: string)`
- import `getUserNotificationSubscription` alongside the existing import
- change the early-return guard to `if (workspaceSubscriptions.length === 0 && !shouldWatchRhythmLogs && !userId) {`
- after the workspace loop, add:

```ts
    if (userId) {
      channel = channel.on('postgres_changes', getUserNotificationSubscription(userId), () => {
        router.refresh()
      })
    }
```

- add `userId` to the effect's dependency array

In `lib/command-actions.ts`, make `EXTRA_DESTINATIONS`:

```ts
export const EXTRA_DESTINATIONS: { href: string; label: string }[] = [
  { href: '/dashboard/inbox', label: 'Inbox' },
  { href: '/dashboard/invites', label: 'Invites' },
]
```

- [ ] **Step 8: Manual check (two accounts)**

- A assigns a task to B: B's bell shows 1 without a reload.
- B opens Inbox, clicks the item: it lands on the project and the count drops.
- B comments: A gets a "commented" item.

Record what was and wasn't checked.

- [ ] **Step 9: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add supabase/migrations/20261008110000_notifications.sql lib/notifications.ts app/actions/notifications.ts app/dashboard/inbox components/inbox components/app-shell/inbox-bell.tsx components/app-shell/topbar.tsx components/app-shell/realtime-pulse.tsx hooks/use-realtime.ts app/dashboard/layout.tsx lib/realtime-subscriptions.ts lib/command-actions.ts __tests__/notifications.test.ts __tests__/rls/execution-layer.test.ts
git commit -m "feat: in-app inbox fed by DB triggers (assigned, comment, blocked)"
```

---

### Task 17: Fast board — drag-and-drop, optimistic moves, filters

**Why:**
- Status only changes through a menu.
- `status-menu.tsx` awaits the server round trip before anything moves.
- There are no filters.

Also, the board query never selects `workspace_id`, so offline status changes queue with `workspace_id: undefined`.

**Simple by design:**
- `@dnd-kit/core` only. Columns are drop zones, cards are draggable, and a `DragOverlay` stops columns from clipping the card.
- A 6px drag threshold keeps a click opening the drawer.
- One `moveTask` path shared by drag and the status menu, made optimistic with React 19's `useOptimistic`.
- Dropping on Blocked opens the existing "Mark Blocked" reason dialog.
- Filters: owner, priority, due date, plus cycle. A label filter appears once Task 18 lands, since the filter function already supports it.

**Files:**
- Modify: `package.json` (`@dnd-kit/core@6.3.1`)
- Create: `lib/tasks/board.ts`
- Create: `app/dashboard/projects/[projectId]/board-filters.tsx`
- Rewrite: `app/dashboard/projects/[projectId]/board-client.tsx`
- Modify: `board-column.tsx`, `task-card.tsx`, `status-menu.tsx`, `page.tsx` (same folder)
- Test: `__tests__/board.test.ts`

**Interfaces:**
- Produces:
  - `planStatusMove(current: string, target: string): { kind: 'noop' } | { kind: 'needs-reason' } | { kind: 'move'; status: TaskStatus }`
  - `BoardFilters = { owner: string; priority: string; due: 'all' | 'overdue' | 'this-week' | 'none'; cycle: string; label: string }`
  - `DEFAULT_BOARD_FILTERS`
  - `filterBoardTasks<T>(tasks: T[], filters: BoardFilters, ctx: { userId: string; todayKey: string }): T[]`
  - `activeFilterCount(filters: BoardFilters): number`
  - `BoardClient` props: `{ project; initialTasks; canEdit?; currentUserId: string; todayKey: string; cycles?: { id: string; name: string }[]; labels?: { id: string; name: string; color: string }[] }`
  - `TaskCard` adds `onMove?: (status: string) => void`
  - `StatusMenu` adds `onMove?: (status: string) => void`
- Consumes: `TASK_STATUSES`, `addDaysToKey` (Task 14), `dateKeyInTimeZone` (Task 9), `MarkBlockedDialog` (`{ taskId, projectId, open, onOpenChange }`)

- [ ] **Step 1: Write the failing test**

Create `__tests__/board.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { planStatusMove, filterBoardTasks, DEFAULT_BOARD_FILTERS, activeFilterCount } from '@/lib/tasks/board'

describe('planStatusMove', () => {
  it('moves between normal statuses', () => {
    expect(planStatusMove('backlog', 'doing')).toEqual({ kind: 'move', status: 'doing' })
  })
  it('asks for a reason before blocking', () => {
    expect(planStatusMove('doing', 'blocked')).toEqual({ kind: 'needs-reason' })
  })
  it('ignores same-column drops and unknown targets', () => {
    expect(planStatusMove('doing', 'doing')).toEqual({ kind: 'noop' })
    expect(planStatusMove('doing', 'archive')).toEqual({ kind: 'noop' })
  })
})

describe('filterBoardTasks', () => {
  const ctx = { userId: 'me', todayKey: '2026-10-08' }
  const t = (over: Record<string, unknown>) => ({
    id: Math.random().toString(36),
    owner_id: null as string | null,
    priority: 'medium',
    deadline: null as string | null,
    status: 'backlog',
    cycle_id: null as string | null,
    label_ids: [] as string[],
    ...over,
  })

  it('returns everything with default filters', () => {
    const tasks = [t({}), t({ owner_id: 'x' })]
    expect(filterBoardTasks(tasks, DEFAULT_BOARD_FILTERS, ctx)).toHaveLength(2)
  })

  it('filters by owner: me, unassigned, a specific person', () => {
    const mine = t({ owner_id: 'me' })
    const none = t({})
    const theirs = t({ owner_id: 'x' })
    const all = [mine, none, theirs]
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, owner: 'me' }, ctx)).toEqual([mine])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, owner: 'unassigned' }, ctx)).toEqual([none])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, owner: 'x' }, ctx)).toEqual([theirs])
  })

  it('filters by due window', () => {
    const late = t({ deadline: '2026-10-01T12:00:00Z' })
    const lateDone = t({ deadline: '2026-10-01T12:00:00Z', status: 'done' })
    const thisWeek = t({ deadline: '2026-10-14T12:00:00Z' })
    const nextWeek = t({ deadline: '2026-10-15T12:00:00Z' })
    const undated = t({})
    const all = [late, lateDone, thisWeek, nextWeek, undated]
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, due: 'overdue' }, ctx)).toEqual([late])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, due: 'this-week' }, ctx)).toEqual([thisWeek])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, due: 'none' }, ctx)).toEqual([undated])
  })

  it('filters by priority, cycle and label', () => {
    const urgentInCycle = t({ priority: 'urgent', cycle_id: 'c1', label_ids: ['bug'] })
    const plain = t({})
    const all = [urgentInCycle, plain]
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, priority: 'urgent' }, ctx)).toEqual([urgentInCycle])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, cycle: 'c1' }, ctx)).toEqual([urgentInCycle])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, cycle: 'none' }, ctx)).toEqual([plain])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, label: 'bug' }, ctx)).toEqual([urgentInCycle])
  })

  it('counts active filters', () => {
    expect(activeFilterCount(DEFAULT_BOARD_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_BOARD_FILTERS, owner: 'me', due: 'overdue' })).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/board.test.ts`
Expected: FAIL (import cannot be resolved)

- [ ] **Step 3: Implement `lib/tasks/board.ts`**

```ts
import { TASK_STATUSES } from '@/lib/tasks/updatable-fields'
import { addDaysToKey } from '@/lib/dates'

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type MovePlan = { kind: 'noop' } | { kind: 'needs-reason' } | { kind: 'move'; status: TaskStatus }

/** What dropping a card (or picking a status) should do. Blocked needs a reason. */
export function planStatusMove(current: string, target: string): MovePlan {
  if (!(TASK_STATUSES as readonly string[]).includes(target) || current === target) return { kind: 'noop' }
  if (target === 'blocked') return { kind: 'needs-reason' }
  return { kind: 'move', status: target as TaskStatus }
}

export type BoardFilters = {
  owner: string // 'all' | 'me' | 'unassigned' | <user id>
  priority: string // 'all' | priority
  due: 'all' | 'overdue' | 'this-week' | 'none'
  cycle: string // 'all' | 'none' | <cycle id>
  label: string // 'all' | <label id>
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = { owner: 'all', priority: 'all', due: 'all', cycle: 'all', label: 'all' }

type FilterableTask = {
  owner_id: string | null
  priority: string | null
  deadline: string | null
  status: string
  cycle_id?: string | null
  label_ids?: string[]
}

export function filterBoardTasks<T extends FilterableTask>(
  tasks: T[],
  f: BoardFilters,
  ctx: { userId: string; todayKey: string }
): T[] {
  const weekEnd = addDaysToKey(ctx.todayKey, 6)
  return tasks.filter((t) => {
    if (f.owner === 'me' && t.owner_id !== ctx.userId) return false
    if (f.owner === 'unassigned' && t.owner_id !== null) return false
    if (!['all', 'me', 'unassigned'].includes(f.owner) && t.owner_id !== f.owner) return false

    if (f.priority !== 'all' && (t.priority ?? 'medium') !== f.priority) return false

    const due = t.deadline ? t.deadline.slice(0, 10) : null
    if (f.due === 'overdue' && !(due && due < ctx.todayKey && t.status !== 'done')) return false
    if (f.due === 'this-week' && !(due && due >= ctx.todayKey && due <= weekEnd)) return false
    if (f.due === 'none' && due !== null) return false

    if (f.cycle === 'none' && t.cycle_id) return false
    if (!['all', 'none'].includes(f.cycle) && t.cycle_id !== f.cycle) return false

    if (f.label !== 'all' && !(t.label_ids ?? []).includes(f.label)) return false
    return true
  })
}

export function activeFilterCount(f: BoardFilters): number {
  return (Object.keys(DEFAULT_BOARD_FILTERS) as (keyof BoardFilters)[]).filter((k) => f[k] !== DEFAULT_BOARD_FILTERS[k]).length
}
```

Run: `npx vitest run __tests__/board.test.ts`
Expected: PASS

- [ ] **Step 4: Add the dependency**

Run: `npm view @dnd-kit/core@6.3.1 version`
Expected: `6.3.1`. If it is not found, pick the newest 6.x that is at least two weeks old and use that exact version.

Run: `npm install --save-exact @dnd-kit/core@6.3.1`

- [ ] **Step 5: Filter bar**

Create `app/dashboard/projects/[projectId]/board-filters.tsx`:

```tsx
'use client'

import { TASK_PRIORITIES } from '@/lib/tasks/updatable-fields'
import { DEFAULT_BOARD_FILTERS, activeFilterCount, type BoardFilters } from '@/lib/tasks/board'

const SELECT = 'h-9 rounded-lg border border-border bg-white px-2 text-sm'

export function BoardFilterBar({
  filters,
  onChange,
  owners,
  cycles,
  labels,
  shown,
  total,
}: {
  filters: BoardFilters
  onChange: (f: BoardFilters) => void
  owners: { id: string; name: string }[]
  cycles: { id: string; name: string }[]
  labels: { id: string; name: string }[]
  shown: number
  total: number
}) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch })
  const active = activeFilterCount(filters)

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <select aria-label="Filter by owner" value={filters.owner} onChange={(e) => set({ owner: e.target.value })} className={SELECT}>
        <option value="all">Anyone</option>
        <option value="me">Me</option>
        <option value="unassigned">Unassigned</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => set({ priority: e.target.value })} className={SELECT}>
        <option value="all">Any priority</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select aria-label="Filter by due date" value={filters.due} onChange={(e) => set({ due: e.target.value as BoardFilters['due'] })} className={SELECT}>
        <option value="all">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="this-week">Due in 7 days</option>
        <option value="none">No due date</option>
      </select>
      {cycles.length > 0 && (
        <select aria-label="Filter by cycle" value={filters.cycle} onChange={(e) => set({ cycle: e.target.value })} className={SELECT}>
          <option value="all">Any cycle</option>
          <option value="none">No cycle</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      {labels.length > 0 && (
        <select aria-label="Filter by label" value={filters.label} onChange={(e) => set({ label: e.target.value })} className={SELECT}>
          <option value="all">Any label</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}
      {active > 0 && (
        <button onClick={() => onChange(DEFAULT_BOARD_FILTERS)} className="text-sm font-medium text-primary">
          Clear {active} filter{active === 1 ? '' : 's'} · showing {shown}/{total}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Rewrite `board-client.tsx`**

```tsx
'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CreateTaskDialog } from './create-task-dialog'
import { BoardColumn } from './board-column'
import { TaskCard } from './task-card'
import { MarkBlockedDialog } from './mark-blocked-dialog'
import { BoardFilterBar } from './board-filters'
import { useOfflineBoardTasks } from '@/lib/offline/offline-tasks'
import { updateTaskStatus } from '@/app/actions/tasks'
import { DEFAULT_BOARD_FILTERS, filterBoardTasks, planStatusMove, type BoardFilters } from '@/lib/tasks/board'

const STATUSES = ['backlog', 'today', 'doing', 'blocked', 'review', 'done']

const STATUS_CONFIG: Record<string, { label: string, color: string, emptyMsg: string }> = {
  backlog: { label: 'Backlog', color: 'bg-slate-200 text-slate-700', emptyMsg: 'No pending tasks.' },
  today: { label: 'Today', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200', emptyMsg: 'Nothing scheduled for today.' },
  doing: { label: 'Doing', color: 'bg-amber-100 text-amber-700 border border-amber-200', emptyMsg: 'No active focus.' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700 border border-red-200', emptyMsg: 'Clear runway.' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700 border border-purple-200', emptyMsg: 'Nothing strictly pending review.' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', emptyMsg: 'No completed tasks yet.' },
}

type Label = { id: string; name: string; color: string }

export function BoardClient({
  project,
  initialTasks,
  canEdit = true,
  currentUserId,
  todayKey,
  cycles = [],
  labels = [],
}: {
  project: any
  initialTasks: any[]
  canEdit?: boolean
  currentUserId: string
  todayKey: string
  cycles?: { id: string; name: string }[]
  labels?: Label[]
}) {
  const tasks = useOfflineBoardTasks(project.id, initialTasks)
  const [optimisticTasks, applyMove] = useOptimistic(tasks, (state: any[], move: { id: string; status: string }) =>
    state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t))
  )
  const [, startTransition] = useTransition()
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_BOARD_FILTERS)
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const owners = useMemo(() => {
    const byId = new Map<string, string>()
    for (const t of tasks) if (t.owner_id && t.owner?.full_name) byId.set(t.owner_id, t.owner.full_name)
    return Array.from(byId, ([id, name]) => ({ id, name }))
  }, [tasks])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])
  const visible = filterBoardTasks(optimisticTasks, filters, { userId: currentUserId, todayKey })
  const dragging = draggingId ? optimisticTasks.find((t) => t.id === draggingId) : null

  /** The one status-change path for drag and the card menu: optimistic, offline-aware. */
  function moveTask(task: any, target: string) {
    const plan = planStatusMove(task.status, target)
    if (plan.kind === 'noop') return
    if (plan.kind === 'needs-reason') {
      setBlockingTaskId(task.id)
      return
    }
    startTransition(async () => {
      applyMove({ id: task.id, status: plan.status })
      if (!navigator.onLine) {
        const { addToSyncQueue } = await import('@/lib/offline/sync-queue')
        await addToSyncQueue('update_task_status', 'task', task.id, { status: plan.status }, task.workspace_id, project.id)
        return
      }
      const res = await updateTaskStatus(task.id, plan.status, { projectId: project.id })
      if (!res.success) toast.error(res.error?.message ?? 'Could not move the task')
    })
  }

  function onDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    if (!e.over) return
    const task = optimisticTasks.find((t) => t.id === e.active.id)
    if (task) moveTask(task, String(e.over.id))
  }

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white border border-border/50 rounded-3xl shadow-sm">
        <h2 className="text-xl font-bold tracking-tight mb-2">No tasks yet.</h2>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
          {canEdit
            ? 'Break this project down into manageable chunks. Create the first task and start moving.'
            : 'This project has no tasks yet.'}
        </p>
        {canEdit && (
          <CreateTaskDialog projectId={project.id} trigger={<Button className="rounded-xl shadow-sm px-6 h-11"><Plus className="w-4 h-4 mr-2"/> Create first task</Button>} />
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <BoardFilterBar
        filters={filters}
        onChange={setFilters}
        owners={owners}
        cycles={cycles}
        labels={labels}
        shown={visible.length}
        total={optimisticTasks.length}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
        <div className="flex-1 flex gap-4 md:gap-6 px-1">
          {canEdit && (
            <div className="hidden absolute right-4 top-24 z-10 md:block">
              <CreateTaskDialog projectId={project.id} trigger={<Button size="sm" className="rounded-full h-9 px-4 shadow-sm bg-primary text-primary-foreground focus-visible:ring-offset-2"><Plus className="w-4 h-4 mr-1.5" />New Task</Button>} />
            </div>
          )}

          {STATUSES.map((status) => {
            const colTasks = visible.filter((t) => t.status === status)
            const config = STATUS_CONFIG[status]
            return (
              <BoardColumn key={status} status={status} config={config} count={colTasks.length}>
                {colTasks.length === 0 ? (
                  <div className="text-xs font-medium text-slate-400 text-center py-6 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    {config.emptyMsg}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        projectId={project.id}
                        canEdit={canEdit}
                        labels={(task.label_ids ?? []).map((id: string) => labelsById.get(id)).filter(Boolean) as Label[]}
                        onMove={(s) => moveTask(task, s)}
                      />
                    ))}
                  </div>
                )}
              </BoardColumn>
            )
          })}
        </div>

        <DragOverlay>
          {dragging ? (
            <div className="w-[280px] rounded-2xl border border-border bg-white p-4 text-sm font-medium shadow-lg">{dragging.title}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {blockingTaskId && (
        <MarkBlockedDialog
          taskId={blockingTaskId}
          projectId={project.id}
          open
          onOpenChange={(open) => {
            if (!open) setBlockingTaskId(null)
          }}
        />
      )}
    </div>
  )
}
```

(`labels` on `TaskCard` is wired in Task 18. Until then the prop is optional and empty.)

- [ ] **Step 7: Drop zones, draggable cards, a shared move path**

`board-column.tsx`:
- add `import { useDroppable } from '@dnd-kit/core'`
- inside the component, add `const { setNodeRef, isOver } = useDroppable({ id: status })`
- change the root `<div>` to:

```tsx
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[280px] shrink-0 snap-start h-full rounded-2xl transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/20"
      )}
    >
```

`task-card.tsx`:
- add `import { useDraggable } from '@dnd-kit/core'`
- change the signature to:

```tsx
export function TaskCard({
  task,
  projectId,
  canEdit = true,
  labels = [],
  onMove,
}: {
  task: any
  projectId: string
  canEdit?: boolean
  labels?: { id: string; name: string; color: string }[]
  onMove?: (status: string) => void
}) {
```

- inside, add `const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !canEdit })`
- on the root card `<div>`, add `ref={setNodeRef} {...listeners} {...attributes}`, and append `isDragging && "opacity-40"` to its `cn(...)`
- in the "Top Labels" flex, after the Overdue badge, add:

```tsx
            {task.carry_over_count > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">Carried ×{task.carry_over_count}</span>}
```

- pass `onMove={onMove}` to `<StatusMenu ... />`

`status-menu.tsx`:
- signature: `export function StatusMenu({ task, projectId, onMove }: { task: any, projectId: string, onMove?: (status: string) => void })`
- make the first line of `handleStatusUpdate`:

```ts
    if (onMove) {
      onMove(status)
      return
    }
```

(The board passes `onMove`, so the menu shares the optimistic path, and "Mark Blocked" opens the board's reason dialog. Without `onMove`, the old behaviour is kept.)

- [ ] **Step 8: Feed the board what it needs**

In `app/dashboard/projects/[projectId]/page.tsx`:
- extend the embedded tasks select to:

```ts
      .select('*, tasks(id, title, description, status, owner_id, priority, deadline, blocked_reason, workspace_id, cycle_id, carry_over_count)')
```

- after `canEdit`, add:

```ts
  const { data: viewerProfile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(new Date(), viewerProfile?.timezone)
  const { data: openCycles } = await supabase
    .from('cycles')
    .select('id, name')
    .eq('workspace_id', project.workspace_id)
    .is('completed_at', null)
    .order('starts_on', { ascending: true })
```

(Add `import { dateKeyInTimeZone } from '@/lib/tasks/my-day'`. Use the page's existing `user`; Task 12 ensured it is in scope.)

- change the board render to:

```tsx
            <BoardClient project={project} initialTasks={tasks} canEdit={canEdit} currentUserId={user.id} todayKey={todayKey} cycles={openCycles ?? []} />
```

- [ ] **Step 9: Visual check**

In the preview:
- drag a card from Backlog to Doing: it moves instantly and survives a reload
- drag a card to Blocked: the reason dialog opens
- a single click still opens the drawer
- "Me" + "Overdue" narrows the board, and Clear restores it
- in DevTools offline mode, drag a card: it moves, the pending-changes pill increments, and it syncs when back online

Take a screenshot mid-drag.

- [ ] **Step 10: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add package.json package-lock.json lib/tasks/board.ts "app/dashboard/projects/[projectId]" __tests__/board.test.ts
git commit -m "feat: drag-and-drop board with optimistic moves and filters"
```

---

### Task 18: Labels

**Why:** There's no way to tag work across projects (bug, client, design…). This is the last gap worth closing now.

**Simple by design:**
- Labels belong to the workspace.
- In the drawer, every workspace label is a toggle chip, plus a "new label" box. Colours are picked automatically from the name, so there's no colour picker.
- Chips show on board cards, and the board gains one label filter (already supported by `filterBoardTasks`).

**Files:**
- Create: `supabase/migrations/20261008120000_labels.sql`
- Create: `lib/labels.ts`
- Create: `app/actions/labels.ts`
- Create: `components/tasks/label-picker.tsx`
- Modify: `app/actions/task-fetcher.ts`, `components/tasks/task-detail-drawer.tsx`
- Modify: `app/dashboard/projects/[projectId]/page.tsx`, `task-card.tsx`
- Modify: `__tests__/rls/execution-layer.test.ts` (append)
- Test: `__tests__/labels.test.ts`

**Interfaces:**
- Produces:
  - `LABEL_COLORS`
  - `normalizeLabelName(name: string): string`
  - `pickLabelColor(name: string): LabelColor`
  - `labelStyle(color: string): string`
  - `createLabel(workspaceId: string, name: string): Promise<{ success: true; label: { id: string; name: string; color: string } } | { success: false; error: string }>`
  - `setTaskLabel(taskId: string, labelId: string, on: boolean, projectId: string): Promise<{ success: true } | { success: false; error: string }>`
  - `getTaskDetails()` adds `labels: Label[]` (all workspace labels) and `labelIds: string[]` (this task's labels)
  - `LabelPicker` props: `{ taskId; projectId; workspaceId; labels: Label[]; labelIds: string[]; onChanged: () => void }`
- Consumes: `TaskCard` `labels` prop and `BoardClient` `labels` prop (Task 17)

- [ ] **Step 1: Write the failing test**

Create `__tests__/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LABEL_COLORS, normalizeLabelName, pickLabelColor, labelStyle } from '@/lib/labels'

describe('labels', () => {
  it('normalises names: trims, collapses spaces, caps at 40 chars', () => {
    expect(normalizeLabelName('  Bug   fix ')).toBe('Bug fix')
    expect(normalizeLabelName('x'.repeat(60))).toHaveLength(40)
    expect(normalizeLabelName('   ')).toBe('')
  })

  it('picks a stable palette colour from the name, case-insensitively', () => {
    expect(pickLabelColor('Bug')).toBe(pickLabelColor('bug'))
    expect(LABEL_COLORS).toContain(pickLabelColor('client'))
  })

  it('falls back to slate for unknown colours', () => {
    expect(labelStyle('neon')).toBe(labelStyle('slate'))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/labels.test.ts`
Expected: FAIL (import cannot be resolved)

- [ ] **Step 3: Implement `lib/labels.ts`**

```ts
export const LABEL_COLORS = ['slate', 'red', 'amber', 'emerald', 'sky', 'violet', 'pink'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

const LABEL_STYLE: Record<LabelColor, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
}

export function normalizeLabelName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40)
}

/** Deterministic colour so nobody has to pick one. */
export function pickLabelColor(name: string): LabelColor {
  let hash = 0
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

export function labelStyle(color: string): string {
  return LABEL_STYLE[(LABEL_COLORS as readonly string[]).includes(color) ? (color as LabelColor) : 'slate']
}
```

Run: `npx vitest run __tests__/labels.test.ts`
Expected: PASS

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20261008120000_labels.sql`:

```sql
-- Workspace labels and their task assignments.

CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  color text NOT NULL DEFAULT 'slate',
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS labels_workspace_name_idx ON public.labels (workspace_id, lower(name));

CREATE TABLE IF NOT EXISTS public.task_labels (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);
CREATE INDEX IF NOT EXISTS task_labels_label_idx ON public.task_labels (label_id);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Labels viewable by members" ON public.labels;
CREATE POLICY "Labels viewable by members" ON public.labels
  FOR SELECT USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Labels creatable by editors" ON public.labels;
CREATE POLICY "Labels creatable by editors" ON public.labels
  FOR INSERT WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Labels updatable by editors" ON public.labels;
CREATE POLICY "Labels updatable by editors" ON public.labels
  FOR UPDATE USING (is_workspace_editor(workspace_id)) WITH CHECK (is_workspace_editor(workspace_id));
DROP POLICY IF EXISTS "Labels deletable by admins" ON public.labels;
CREATE POLICY "Labels deletable by admins" ON public.labels
  FOR DELETE USING (is_workspace_admin(workspace_id));

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Task labels viewable by members" ON public.task_labels;
CREATE POLICY "Task labels viewable by members" ON public.task_labels
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
  ));
-- The label must belong to the task's own workspace.
DROP POLICY IF EXISTS "Task labels addable by editors" ON public.task_labels;
CREATE POLICY "Task labels addable by editors" ON public.task_labels
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.labels l ON l.id = label_id
    WHERE t.id = task_id AND l.workspace_id = t.workspace_id AND is_workspace_editor(t.workspace_id)
  ));
DROP POLICY IF EXISTS "Task labels removable by editors" ON public.task_labels;
CREATE POLICY "Task labels removable by editors" ON public.task_labels
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND is_workspace_editor(t.workspace_id)
  ));
```

- [ ] **Step 5: Append the RLS proofs**

Append to `__tests__/rls/execution-layer.test.ts`:

```ts
describe('labels', () => {
  it('editors can create a label; viewers cannot', async () => {
    gate()
    const { data, error } = await cli.member.from('labels').insert({ workspace_id: row.wsW, name: 'bug', color: 'red' }).select('id').single()
    expect(error).toBeNull()
    row.labelW = data!.id
    const denied = await cli.viewer.from('labels').insert({ workspace_id: row.wsW, name: 'nope' })
    expect(denied.error).not.toBeNull()
  })

  it('a label from another workspace cannot be attached', async () => {
    gate()
    const { data: foreign } = await admin.from('labels').insert({ workspace_id: row.wsX, name: 'foreign' }).select('id').single()
    const { error } = await cli.member.from('task_labels').insert({ task_id: row.taskW, label_id: foreign!.id })
    expect(error).not.toBeNull()
  })

  it('members can attach their own workspace label; outsiders cannot see it', async () => {
    gate()
    const { error } = await cli.member.from('task_labels').insert({ task_id: row.taskW, label_id: row.labelW })
    expect(error).toBeNull()
    const { data } = await cli.outsider.from('task_labels').select('task_id').eq('task_id', row.taskW)
    expect(data ?? []).toHaveLength(0)
    const { data: labels } = await cli.outsider.from('labels').select('id').eq('workspace_id', row.wsW)
    expect(labels ?? []).toHaveLength(0)
  })
})
```

Run: `npx supabase db reset && npm run test:rls`
Expected: PASS. Without Docker, report "RLS harness NOT run".

- [ ] **Step 6: Actions**

Create `app/actions/labels.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeLabelName, pickLabelColor } from '@/lib/labels'

type Label = { id: string; name: string; color: string }

export async function createLabel(
  workspaceId: string,
  name: string
): Promise<{ success: true; label: Label } | { success: false; error: string }> {
  if (!z.string().uuid().safeParse(workspaceId).success) return { success: false, error: 'Invalid input' }
  const clean = normalizeLabelName(name)
  if (!clean) return { success: false, error: 'Label name is required' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('labels')
    .insert({ workspace_id: workspaceId, name: clean, color: pickLabelColor(clean) })
    .select('id, name, color')
    .single()
  if (error) return { success: false, error: error.code === '23505' ? 'That label already exists' : error.message }
  return { success: true, label: data as Label }
}

export async function setTaskLabel(
  taskId: string,
  labelId: string,
  on: boolean,
  projectId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ids = z.object({ taskId: z.string().uuid(), labelId: z.string().uuid() }).safeParse({ taskId, labelId })
  if (!ids.success) return { success: false, error: 'Invalid input' }

  const supabase = await createClient()
  if (on) {
    const { error } = await supabase.from('task_labels').insert({ task_id: taskId, label_id: labelId })
    if (error && error.code !== '23505') return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
```

- [ ] **Step 7: Label picker in the drawer**

Create `components/tasks/label-picker.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createLabel, setTaskLabel } from '@/app/actions/labels'
import { labelStyle, normalizeLabelName } from '@/lib/labels'

type Label = { id: string; name: string; color: string }

export function LabelPicker({
  taskId,
  projectId,
  workspaceId,
  labels,
  labelIds,
  onChanged,
}: {
  taskId: string
  projectId: string
  workspaceId: string
  labels: Label[]
  labelIds: string[]
  onChanged: () => void
}) {
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const selected = new Set(labelIds)

  function toggle(label: Label) {
    startTransition(async () => {
      const res = await setTaskLabel(taskId, label.id, !selected.has(label.id), projectId)
      if (!res.success) toast.error(res.error)
      else onChanged()
    })
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const name = normalizeLabelName(draft)
    if (!name) return
    startTransition(async () => {
      const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
      let label = existing
      if (!label) {
        const res = await createLabel(workspaceId, name)
        if (!res.success) {
          toast.error(res.error)
          return
        }
        label = res.label
      }
      const res = await setTaskLabel(taskId, label.id, true, projectId)
      if (!res.success) toast.error(res.error)
      else {
        setDraft('')
        onChanged()
      }
    })
  }

  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Labels</p>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            disabled={pending}
            onClick={() => toggle(label)}
            aria-pressed={selected.has(label.id)}
            className={
              selected.has(label.id)
                ? `rounded-md border px-2 py-0.5 text-xs font-semibold ${labelStyle(label.color)}`
                : 'rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500'
            }
          >
            {label.name}
          </button>
        ))}
      </div>
      <form onSubmit={add} className="flex max-w-xs gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New label" aria-label="New label" disabled={pending} className="h-8" />
        <Button type="submit" size="sm" disabled={pending || !draft.trim()}>Add</Button>
      </form>
    </div>
  )
}
```

In `app/actions/task-fetcher.ts`, after the cycles query, add:

```ts
  const [{ data: labelRows }, { data: taskLabelRows }] = await Promise.all([
    supabase.from('labels').select('id, name, color').eq('workspace_id', (task.projects as any)?.workspace_id).order('name'),
    supabase.from('task_labels').select('label_id').eq('task_id', taskId),
  ])
```

and add to the returned object:

```ts
    labels: labelRows || [],
    labelIds: (taskLabelRows || []).map((r: any) => r.label_id),
```

In `components/tasks/task-detail-drawer.tsx`:
- add `import { LabelPicker } from "@/components/tasks/label-picker";`
- right after `<TaskEditFields ... />`, add:

```tsx
            <LabelPicker
              taskId={taskId}
              projectId={projectId}
              workspaceId={data.task.workspace_id}
              labels={data.labels ?? []}
              labelIds={data.labelIds ?? []}
              onChanged={fetchData}
            />
```

- [ ] **Step 8: Labels on the board**

In `app/dashboard/projects/[projectId]/page.tsx`:
- add `task_labels(label_id)` to the embedded tasks select (inside `tasks(...)`)
- in the `tasks = rawTasks.map(...)` mapping, add `label_ids: (t.task_labels ?? []).map((x: any) => x.label_id),`
- add the query:

```ts
  const { data: workspaceLabels } = await supabase
    .from('labels')
    .select('id, name, color')
    .eq('workspace_id', project.workspace_id)
    .order('name')
```

- pass `labels={workspaceLabels ?? []}` to `<BoardClient />`

In `task-card.tsx`:
- add `import { labelStyle } from '@/lib/labels'`
- inside the "Top Labels" flex, after the badges, add:

```tsx
            {labels.map((l) => (
              <span key={l.id} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md border', labelStyle(l.color))}>{l.name}</span>
            ))}
```

- [ ] **Step 9: Visual check**

In the preview:
- in the drawer, type "bug" and Add: the chip shows on the card
- toggle it off: the chip disappears
- the board label filter shows only tasks with that label

Take a screenshot.

- [ ] **Step 10: Gate + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`

```bash
git add supabase/migrations/20261008120000_labels.sql lib/labels.ts app/actions/labels.ts components/tasks/label-picker.tsx components/tasks/task-detail-drawer.tsx app/actions/task-fetcher.ts "app/dashboard/projects/[projectId]" __tests__/labels.test.ts __tests__/rls/execution-layer.test.ts
git commit -m "feat: workspace labels with drawer picker, card chips and board filter"
```

---

## Phase G — Clean up and prove it

### Task 19: Remove dead code, full verification

**Files:**
- Modify: `app/actions/scheduling.ts` (delete `getUpcomingSchedules`, ~line 163)

- [ ] **Step 1: Remove `getUpcomingSchedules`**

Run: `grep -rn "getUpcomingSchedules" app components lib hooks`
Expected: only the definition. (The copy under `__tests__/p0proof/head/` is a frozen snapshot and is excluded from the gates.) Delete the function.

- [ ] **Step 2: Dead-code sweep for things this plan replaced**

Run: `grep -rn "assignTaskOwner\|inviteTeamMember\|common/stat-card\|MyFocusQueue\|FocusScoreRing\|BlockersPanel" app components lib hooks`
Expected: no output.

- [ ] **Step 3: Full definition-of-done gate**

Run: `rm -rf .next && npx tsc --noEmit && npx eslint . && npx vitest run && npx next build`
Expected: all four pass. Paste the full output in the report.

- [ ] **Step 4: RLS harness (needs Docker)**

Run: `npx supabase start && npx supabase db reset && npm run test:rls`
Expected: pass. If Docker is unavailable, report "RLS harness NOT run".

- [ ] **Step 5: End-to-end smoke in the preview**

Run the 7-step smoke test from `docs/DEPLOY.md` §6 against the local stack, then the execution-layer flow:

1. Start a 1-week cycle.
2. Quick-add a task: it shows on the Cycle page.
3. Drag it to Doing.
4. Assign it to B: B's bell shows 1.
5. Label it "bug" and filter the board by that label.
6. In the SQL editor, set the cycle's `ends_on` to yesterday and run `select public.rollover_ended_cycles();`. The task is now "carried ×1" in a new cycle.

Screenshot:
- Home
- Cycle
- Team (members panel)
- Inbox
- the board mid-drag
- the task drawer
- the mobile nav at 375px

- [ ] **Step 6: Commit**

```bash
git add app/actions/scheduling.ts
git commit -m "chore: remove dead getUpcomingSchedules"
```

- [ ] **Step 7: Update memory and docs**

- Update the project memory file with what landed and what is still open (the Out-of-scope list above).
- Remind the user that `docs/DEPLOY.md` steps 1–5 are still theirs to run. These new migrations need `supabase db push`:
  - `20261008090000` (search_path)
  - `20261008090100` (realtime)
  - `20261008100000` (cycles + rollover cron)
  - `20261008110000` (notifications)
  - `20261008120000` (labels)
- After pushing, `select jobname from cron.job` must include `rollover-ended-cycles`.
