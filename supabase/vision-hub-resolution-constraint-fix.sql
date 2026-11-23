-- Safely align the media resolution constraint with the Admin upload options.
-- Existing rows and media objects are preserved.
ALTER TABLE public.vh_media_assets
  DROP CONSTRAINT IF EXISTS vh_media_assets_resolution_check;

ALTER TABLE public.vh_media_assets
  ADD CONSTRAINT vh_media_assets_resolution_check
  CHECK (
    resolution IS NULL OR resolution = ANY (
      ARRAY[
        'original'::text,
        '180p'::text,
        '240p'::text,
        '360p'::text,
        '420p'::text,
        '480p'::text,
        '720p'::text,
        '1080p'::text,
        '2k'::text,
        '4k'::text,
        '8k'::text
      ]
    )
  );
