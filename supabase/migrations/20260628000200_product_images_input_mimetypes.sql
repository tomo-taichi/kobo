-- Originals are now uploaded straight to the bucket from the browser (under a tmp/
-- prefix) and processed server-side into WebP, then the original is deleted. Allow the
-- common input image types in addition to the stored WebP derivatives.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
where id = 'product-images';
