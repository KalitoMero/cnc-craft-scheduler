-- Add a flag to mark a column as the 'Artikelnummer' (article number)
ALTER TABLE public.excel_column_mappings
ADD COLUMN IF NOT EXISTS is_article_number boolean NOT NULL DEFAULT false;

-- Optional: keep updated_at consistent via triggers if added later (no change needed now)
