# Working Memory

## Problem Summary
- Add a complete workspace invitation flow: admins can send email-backed invites, users can see pending invites, accept or decline them, and sign-up honors email confirmation.

## Stack And Runtime
- Next.js 15 App Router with React 19, TypeScript, Supabase SSR, Tailwind CSS.
- Local dev server verified on `http://localhost:3001`.

## Confirmed Fixes
- Added `/dashboard/invites` for logged-in users to review pending and past workspace invitations.
- Added invite accept/decline server actions backed by SECURITY DEFINER Supabase RPCs that verify the invite email matches `auth.email()`.
- Updated team invite creation to upsert pending invites, require an admin/owner role, and send a Supabase email using service-role auth invites when available or magic-link email fallback otherwise.
- Enabled local Supabase email signups and confirmation settings in `supabase/config.toml`.
- Fixed sign-up so email-confirmation flows show the check-your-email state instead of always redirecting to the dashboard.
- Fixed lint failures from unescaped JSX text and React compiler hook rules.
- Added a real Supabase reset-password action and `/update-password` route.
- Replaced stale `Button asChild` usage with the local `render` API.
- Swapped local logo `<img>` tags to `next/image`.
- Fixed broken marketing and project navigation links.
- Aligned checklist reads/writes on `task_checklist_items`.
- Fixed project revalidation paths from old `/dashboard/tasks` paths to `/dashboard/projects`.
- Cleaned offline sync queue payloads so server-authenticated actions do not need fake user IDs.
- Hardened focus tube rendering when no active session exists.
- Replaced dashboard mock stats with workspace-scoped Supabase data.
- Patched Supabase migration setup so RLS-referenced tables/columns exist before policies are applied.

## Verification
- Targeted ESLint passes for touched invite/auth files.
- `npm run build` passes.
- Smoke checked `/`, `/login`, `/forgot-password`, `/update-password`, and `/offline` on the local dev server.
- For the invite work: browser smoke checks confirmed `/dashboard/invites` redirects unauthenticated users to login while `/signup` renders account creation.

## Remaining Risks
- Full authenticated workflows still need real Supabase data and credentials to exercise create project/task, focus session, and offline sync end to end.
- Repo-wide `npm run lint` is currently blocked by existing React compiler set-state-in-effect errors in finance/settings/team components unrelated to the invite changes.
- Production Supabase email settings still need to allow the deployed app's `/auth/callback` redirect URL, and `SUPABASE_SERVICE_ROLE_KEY` should be set server-side for official Auth invite emails.
