-- Restrict profile reads to authenticated users only.
-- Previously "Profiles are viewable by everyone" USING (true) let anonymous
-- clients SELECT every row in public.profiles and harvest all email addresses.
-- Authenticated users still need to read arbitrary profiles (member lookups,
-- task owners, focus-session users), so we gate on auth.uid() rather than
-- scoping to shared workspaces.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
