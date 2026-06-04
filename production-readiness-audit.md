# SprintRoom Production Readiness Audit

Date: 2026-06-03

## Verdict

SprintRoom is not production-ready yet. The app builds and lints, and the recent PWA fixes cover the install/offline asset layer, but production launch is blocked by failing tests, dependency advisories, deployment script mismatch, weak operational controls, and several security/authorization hardening gaps.

## P0: Block Before Public Production

### P0-1: CI and test suite are red

Evidence:
- `npm test` fails.
- `__tests__/weekly-rhythms.test.ts` imports `@/app/actions/rhythms`, but the real action file is `app/actions/rhythm.ts`.
- `__tests__/ai-suggestions.test.ts` mocks `@google/genai`, while production imports `@google/generative-ai`.
- `__tests__/focus-sessions.test.ts` Supabase mock chain lacks `.lte()`.
- `lib/*.test.ts` files use Node TAP style and are discovered by Vitest as files with no Vitest suite.

Impact:
- CI cannot be trusted as a release gate.
- Regressions can ship unnoticed.

Fix:
- Align tests with Vitest or exclude Node TAP tests from Vitest.
- Fix stale imports and Supabase mock chains.
- Make `npm test`, `npm run lint`, and `npm run build` required before deploy.

### P0-2: Dependency audit reports production-relevant advisories

Evidence:
- `npm audit --audit-level=moderate` reports 20 vulnerabilities: 16 moderate, 3 high, 1 critical.
- `next` is reported in the affected range with multiple high-severity advisories.
- `firebase-tools` is installed in `devDependencies` and pulls several vulnerable transitive packages.

Impact:
- Public deployment could ship known vulnerable packages.

Fix:
- Run non-breaking `npm audit fix`.
- Upgrade Next to a currently patched release.
- Remove unused heavyweight dev dependencies such as `firebase-tools` if not part of deployment.
- Re-run audit and pin a clean lockfile.

### P0-3: Runtime start command is wrong for standalone output

Evidence:
- `next.config.ts` uses `output: 'standalone'`.
- `package.json` uses `"start": "next start"`.
- `next start -p 3001` emits: `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.`

Impact:
- Self-hosted production runtime can start with the wrong server path or fail depending on platform.

Fix:
- Either remove `output: 'standalone'` for Vercel/native Next hosting, or change runtime command and deployment docs to `node .next/standalone/server.js`.

### P0-4: Edge functions use service-role power without visible request authorization

Evidence:
- `supabase/functions/process-schedules/index.ts` accepts any POST and creates a service-role client.
- `supabase/functions/process-recurring-tasks/index.ts` accepts any POST and creates a service-role client.
- `supabase/config.toml` only defines `verify_jwt = true` for `process-recurring-tasks`; `process-schedules` is absent from config.
- Cron SQL examples use placeholder `[PROJECT-REF]` and `[SERVICE_ROLE_KEY]`.

Impact:
- If deployed with weak or disabled function JWT verification, a caller could trigger service-role background jobs.

Fix:
- Add explicit shared-secret or JWT claim validation inside both functions.
- Add `process-schedules` to `supabase/config.toml` with explicit `verify_jwt`.
- Replace placeholder cron SQL with environment-specific deployment scripts.

### P0-5: Public callback redirect is not sanitized

Evidence:
- `app/auth/callback/route.ts` reads `next` from the URL and redirects to `${origin}${next}` without validating that `next` is a local path.
- Server action auth redirects already use a safer helper, but the callback route does not.

Impact:
- Malformed `next` values can create broken redirects or path confusion after auth.

Fix:
- Reuse the safe local-path redirect helper in the callback route.
- Reject paths that do not start with `/` or that start with `//`.

## P1: Security and Data Integrity Hardening

### P1-1: Global revalidate Server Action has no auth guard

Evidence:
- `app/actions/revalidate.ts` exports `globalRevalidate()` and calls `revalidatePath('/dashboard', 'layout')` without checking auth.

Impact:
- Any reachable invocation of the Server Action can churn cache invalidation.

Fix:
- Remove it if unused, or require an authenticated admin/owner before revalidating.

### P1-2: Several mutation Server Actions rely on broad RLS instead of local authorization and input allowlists

Evidence:
- `app/actions/task-details.ts` exposes `updateTask(id, data: any, projectId)` and passes arbitrary `data` directly to `.update(data)`.
- `assignTaskOwner`, checklist mutations, task mutations, and profile update actions do not consistently check the current user before mutating.
- RLS permits any workspace member to update tasks/checklists/projects in several policies.

Impact:
- A workspace member may mutate fields the UI does not intend to expose.
- A compromised client can submit unexpected columns or cross-flow updates.

Fix:
- Add Zod schemas to every action.
- Use allowlisted update payloads only.
- Locally verify workspace membership and role where product permissions require it.
- Tighten RLS to match actual product roles, not just membership.

### P1-3: Profile update trusts caller-supplied user id

Evidence:
- `app/actions/profile.ts` accepts `userId` from the client and updates `profiles` where `id = userId`.

Impact:
- RLS likely blocks cross-user updates, but the action contract is weaker than it should be.

Fix:
- Ignore caller-supplied `userId`; derive the user id from `supabase.auth.getUser()`.

### P1-4: Account enumeration in reset password

Evidence:
- `app/actions/auth.ts` returns `No account found with this email address.`

Impact:
- Attackers can confirm which emails are registered.

Fix:
- Always return a generic success-style message for reset requests.

### P1-5: Missing app-level security headers

Evidence:
- No visible `headers()` config in `next.config.ts`.
- Search found no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` in app code.

Impact:
- XSS/clickjacking/content-sniffing protections may depend entirely on hosting defaults.

Fix:
- Add baseline security headers in `next.config.ts` or platform edge config.
- Start with `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and a measured CSP rollout.

### P1-6: PWA service worker caches authenticated pages

Evidence:
- `public/sw.js` stale-while-revalidates navigations and page data across same-origin requests.

Impact:
- On shared devices, cached authenticated pages can persist after logout unless cache cleanup is implemented.

Fix:
- Clear app caches on logout.
- Avoid caching auth-sensitive responses, or partition cache by user/session.
- Add logout tests for cache deletion.

## P1: Operational Readiness

### P1-7: Production cron setup is not automated

Evidence:
- Scheduling migrations include only commented cron examples with placeholders.
- `process-schedules` and `process-recurring-tasks` need real cron configuration to function.

Impact:
- Scheduled focus sessions and recurring tasks may not run in production.

Fix:
- Add a repeatable deployment script/migration for cron jobs.
- Store function auth secrets outside SQL and document rotation.

### P1-8: Observability is not visible

Evidence:
- No Sentry, structured logger, OpenTelemetry, Vercel analytics/speed insights, or app-level error reporting integration found.
- Many server actions use `console.error`.

Impact:
- Production failures will be hard to diagnose.

Fix:
- Add error tracking and request/job logging.
- Add health checks for Supabase, Resend, AI, and background functions.

### P1-9: CI does not build the app

Evidence:
- `.github/workflows/ci.yml` runs lint, `tsc --noEmit`, tests, and `supabase db lint`, but not `npm run build`.

Impact:
- App Router/server component/build-time failures can pass CI.

Fix:
- Add `npm run build` to CI after tests.
- Add `npm audit --audit-level=high` or equivalent dependency gate.

## P2: Product and UX Completion

### P2-1: Delete Account button is non-functional

Evidence:
- `app/dashboard/settings/page.tsx` renders a destructive Delete Account button with no handler.

Impact:
- Users see a dangerous action that does nothing.

Fix:
- Either remove it for launch or implement a confirmed deletion/export/deactivation flow.

### P2-2: Project metrics still contain mock/placeholder logic

Evidence:
- Project board comments say session counts are mocked.
- Project listing comments mention mocked completed sessions.

Impact:
- Users may see misleading operational metrics.

Fix:
- Replace mocked counts with real aggregate queries or remove the metric until reliable.

### P2-3: README and env docs lag production needs

Evidence:
- README says Node 18+, while current Next guidance and CI use Node 20.
- `.env.example` does not include VAPID variables used by push notifications.
- Supabase config only contains localhost auth URLs.

Impact:
- Production setup is easy to misconfigure.

Fix:
- Document Node 20+, production Supabase redirect URLs, VAPID keys, Resend DNS/SPF/DKIM, service-role usage, cron setup, and standalone/Vercel deployment path.

### P2-4: Type safety is weak in user-facing modules

Evidence:
- Many components and actions use `any`.
- Some actions accept `data: any` and rely on runtime behavior.

Impact:
- Data contract drift and UI runtime bugs are more likely.

Fix:
- Introduce typed Supabase row models or generated DB types.
- Replace `any` in server actions first.

## Verification Performed

- `npm run lint`: passed during the PWA work.
- `npm run build`: passed during the PWA work.
- `npm test`: failed with unrelated existing test failures.
- `npm audit --audit-level=moderate`: failed with 20 vulnerabilities.
- Browser smoke check for PWA/homepage: passed during the PWA work.

## Recommended Launch Plan

1. Fix tests and CI gates: `npm test`, `npm run build`, dependency audit.
2. Resolve dependency advisories and deploy command mismatch.
3. Harden auth redirects, background functions, global revalidation, and mutation actions.
4. Add security headers, cache cleanup on logout, and production cron scripts.
5. Add observability and production documentation.
6. Remove or complete placeholder product flows.
