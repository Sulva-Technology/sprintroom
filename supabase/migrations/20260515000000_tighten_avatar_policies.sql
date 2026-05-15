-- ======================================================================================
-- 20260515000000_tighten_avatar_policies.sql
--
-- Strategy: Drop the overly permissive avatar policies and replace them with policies
-- that strictly enforce user ownership.
-- ======================================================================================

-- 1. Drop old permissive policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete their own avatar." ON storage.objects;

-- 2. Create new, tightened policies

-- Read access is still public since avatars are meant to be seen by everyone.
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Insert: The user must be authenticated and the owner ID must match their UID.
CREATE POLICY "Users can upload their own avatar."
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND owner = auth.uid()
  );

-- Update: The user can only update if they are the owner.
CREATE POLICY "Users can update their own avatar."
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND owner = auth.uid()
  );

-- Delete: The user can only delete if they are the owner.
CREATE POLICY "Users can delete their own avatar."
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND owner = auth.uid()
  );
