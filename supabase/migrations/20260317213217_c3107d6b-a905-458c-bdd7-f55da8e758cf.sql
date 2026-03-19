
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view service images" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');
CREATE POLICY "Authenticated users can upload service images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-images');
CREATE POLICY "Authenticated users can update own service images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'service-images');
CREATE POLICY "Authenticated users can delete own service images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'service-images');
