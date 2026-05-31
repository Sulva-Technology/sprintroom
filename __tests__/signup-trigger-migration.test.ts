import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('signup trigger hardening migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260531174500_harden_signup_triggers_for_invites.sql'),
    'utf8',
  )

  it('keeps auth user creation focused on profile creation only', () => {
    const handleNewUserBody = migration.match(
      /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?\$\$;/,
    )?.[0]

    expect(handleNewUserBody).toContain('INSERT INTO public.profiles')
    expect(handleNewUserBody).toContain('ON CONFLICT (id) DO UPDATE')
    expect(handleNewUserBody).not.toContain('INSERT INTO public.workspaces')
    expect(handleNewUserBody).not.toContain('INSERT INTO public.projects')
  })

  it('makes profile onboarding idempotent before creating a personal workspace', () => {
    const onboardingBody = migration.match(
      /CREATE OR REPLACE FUNCTION public\.handle_new_user_onboarding\(\)[\s\S]*?\$\$;/,
    )?.[0]

    expect(onboardingBody).toContain('IF personal_workspace_id IS NULL THEN')
    expect(onboardingBody).toContain('WHERE wm.user_id = NEW.id')
    expect(onboardingBody).toContain("w.type = 'personal'")
    expect(onboardingBody).toContain('ON CONFLICT DO NOTHING')
  })
})
