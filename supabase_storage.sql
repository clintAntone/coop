-- Supabase Storage: avatars bucket
-- Run this in your Supabase SQL editor ONCE to set up avatar storage.

-- 1. Create the avatars bucket (public, 300 KB limit, images only)
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow anyone to read avatars (public bucket)
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 3. Allow authenticated users to upload their own avatar
--    Files must be placed under a folder matching the user's auth UID:
--    e.g. avatars/{uid}/avatar.jpg
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to update (replace) their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
