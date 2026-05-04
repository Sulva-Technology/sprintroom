# Working Memory

## Problem Summary
- Audit the SprintRoom Next.js app and fix confirmed errors plus visibly incomplete features.

## Stack And Runtime
- Next.js 15 App Router with React 19, TypeScript, Supabase SSR, Tailwind CSS.
- Local dev server verified on `http://localhost:3001`.

## Confirmed Fixes
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
- `npm run lint` passes.
- `npm run build` passes.
- Smoke checked `/`, `/login`, `/forgot-password`, `/update-password`, and `/offline` on the local dev server.

## Remaining Risks
- Full authenticated workflows still need real Supabase data and credentials to exercise create project/task, focus session, and offline sync end to end.
