-- Storage policies for knowledge-documents bucket
-- Service role (backend API) bypasses RLS; these policies support direct Supabase client access.

CREATE POLICY "Service role full access on knowledge documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'knowledge-documents')
WITH CHECK (bucket_id = 'knowledge-documents');

CREATE POLICY "Authenticated users can read knowledge files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-documents'
  AND (storage.foldername(name))[1] = 'knowledge'
);

CREATE POLICY "Authenticated users can upload knowledge files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-documents'
  AND (storage.foldername(name))[1] = 'knowledge'
);

CREATE POLICY "Authenticated users can delete knowledge files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-documents'
  AND (storage.foldername(name))[1] = 'knowledge'
);
