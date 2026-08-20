# SprintRoom — agent contract

Next.js execution platform on Supabase. Read this before touching anything.

## Stack facts agents get wrong

- **Next 16 + Turbopack.** `next.config.ts` still has a `webpack()` block — it is
  **dead code**. Turbopack ignores it. Never add or "fix" webpack config; use
  `turbopack: {}` options instead.
- **React 19.** Server Components by default. `cookies()`, `headers()`, `params`,
  `searchParams` are all async — `await` them.
- **`proxy.ts`, not `middleware.ts`.** Root-level [proxy.ts](proxy.ts) exports
  `proxy()` + `config.matcher` and delegates to `lib/supabase/middleware.ts`.
  Do not create `middleware.ts`. PWA assets (`sw.js`, manifest, `sounds/`) are
  deliberately excluded from the matcher — re-including them breaks SW registration.
- **Supabase RLS is the real authz layer.** Server actions run with the user's
  anon-key session ([lib/supabase/server.ts](lib/supabase/server.ts)); the DB
  policies decide. App-level checks are UX, not security. `lib/supabase/admin.ts`
  (service role) bypasses RLS — justify every use.
- Optional integrations degrade silently. Gate on
  [lib/config/integrations.ts](lib/config/integrations.ts) rather than reading
  `process.env` inline.

## Schema truth

- **[supabase/schema.sql](supabase/schema.sql) is STALE. Never read it as truth.**
  It describes a long-dropped single-user schema (`tasks.user_id`, enum
  `task_status`, integer priority). All of that is wrong.
- The live schema is **`supabase/migrations/*` applied in filename order**. To
  answer "what columns does X have", grep the migrations — later ones win.
- `tasks`: `created_by` (authorship, defaulted via trigger) and `owner_id`
  (assignee, nullable). **There is no `user_id`.** `priority` is **text**
  (`'medium'` default), not an int. `status` is text. `project_id` is
  **NOT NULL**. `workspace_id` is backfilled from the project by the
  `set_task_workspace_id` BEFORE INSERT trigger — do not set it by hand.

## Workspace scoping

Every server component and server action reading workspace-scoped data MUST get
its workspace id from `resolveActiveWorkspaceId()`
([lib/workspace/active-workspace.ts](lib/workspace/active-workspace.ts)).

Never hand-roll `supabase.from('workspace_members')...limit(1)` to pick a
workspace. Each surface rolling its own unordered `[0]` is what made workspaces
inconsistent; the cookie-then-stable-order rule lives in one place now.

Known remaining violations — fix them when you touch the file, don't copy them:
- [app/dashboard/finances/page.tsx:21](app/dashboard/finances/page.tsx#L21)

Querying `workspace_members` for *members of an already-resolved workspace* is
fine. Selecting a workspace that way is not.

## Definition of done

All four must pass, in this order, before any completion claim:

```bash
rm -rf .next && npx tsc --noEmit && npx eslint . && npx vitest run && npx next build
```

The `rm -rf .next` is required, not hygiene: stale `.next/dev/types/*` makes
`tsc --noEmit` fail with a bogus TS1434 that has nothing to do with your change.

## Reporting rules

- **Never claim "fixed" / "works" / "verified" without pasting the command output
  that proves it.** No output, no claim. If you did not run it, say you did not.
- Report failures verbatim. Partial completion is reported as partial.

## Tests

- Vitest + jsdom + Testing Library ([vitest.config.ts](vitest.config.ts)).
  `@/*` path alias works in tests via `vite-tsconfig-paths`.
- Suites live in `__tests__/*.test.ts`; a few unit tests sit beside their source
  (`lib/weekly-rhythm.test.ts`). Either is acceptable — match the neighbours.
- **Every bugfix lands with a test that fails before the fix and passes after.**
  State explicitly which test that is and what it asserted before the fix.
- Prefer extracting a pure function to test (see `pickActiveWorkspaceId`,
  `pickUpdatableTaskFields`) over mocking Supabase.
- **A test that regex-matches source text proves the patch's spelling, not its
  behaviour.** `__tests__/edge-function-contracts.test.ts` is that kind of test
  and is fine for config invariants — do not mistake it for proof a defect is
  fixed. Never assert against a *copy* of the code under test.
- `__tests__/rls/` is the multi-tenant denial harness. It needs `supabase start`
  (Docker), is excluded from the default run, and fails loudly rather than
  skipping. Run it with `npm run test:rls` for anything touching RLS or tenancy.

## Migrations

- New migrations only. Never edit an applied migration file; never edit
  `schema.sql`. Timestamp-prefixed names (`YYYYMMDDHHMMSS_description.sql`).
- Edge functions in `supabase/functions/` authenticate via `CRON_SECRET`, not a
  JWT — each needs `verify_jwt = false` in `supabase/config.toml`.
