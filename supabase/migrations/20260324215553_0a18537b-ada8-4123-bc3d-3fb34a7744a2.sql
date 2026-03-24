CREATE POLICY "Authenticated users can update intervention photos"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'intervention-photos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'intervention-photos' AND auth.role() = 'authenticated');