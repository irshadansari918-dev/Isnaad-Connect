-- ============================================================================
-- Isnaad Connect — Storage bucket policies
-- Day 7: Run after creating the "attachments" bucket in Supabase Dashboard.
-- ============================================================================

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Allow public read access to uploaded files
CREATE POLICY "Public read access"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'attachments');

-- Allow users to delete their own uploads (owner = auth.uid)
CREATE POLICY "Users can delete own uploads"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] IS NOT NULL);
