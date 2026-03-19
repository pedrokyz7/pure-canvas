
-- Add video_url column to services table
ALTER TABLE public.services ADD COLUMN video_url text DEFAULT NULL;

-- Create storage bucket for service videos
INSERT INTO storage.buckets (id, name, public) VALUES ('service-videos', 'service-videos', true);

-- RLS policies for service-videos bucket
CREATE POLICY "Anyone can view service videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-videos');

CREATE POLICY "Authenticated users can upload service videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-videos');

CREATE POLICY "Users can update own service videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'service-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own service videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
