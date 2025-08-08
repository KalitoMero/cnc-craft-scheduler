-- Create table for part families
CREATE TABLE IF NOT EXISTS public.part_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.part_families ENABLE ROW LEVEL SECURITY;

-- Policies (open like existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'part_families' AND policyname = 'Anyone can manage part_families'
  ) THEN
    CREATE POLICY "Anyone can manage part_families"
    ON public.part_families
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'part_families' AND policyname = 'Anyone can view part_families'
  ) THEN
    CREATE POLICY "Anyone can view part_families"
    ON public.part_families
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_part_families_updated_at'
  ) THEN
    CREATE TRIGGER update_part_families_updated_at
    BEFORE UPDATE ON public.part_families
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create table for part family items
CREATE TABLE IF NOT EXISTS public.part_family_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.part_families(id) ON DELETE CASCADE,
  part_value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient ordering and lookups
CREATE INDEX IF NOT EXISTS idx_part_family_items_family_id_position
ON public.part_family_items (family_id, position);

-- Enable RLS
ALTER TABLE public.part_family_items ENABLE ROW LEVEL SECURITY;

-- Policies (open like existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'part_family_items' AND policyname = 'Anyone can manage part_family_items'
  ) THEN
    CREATE POLICY "Anyone can manage part_family_items"
    ON public.part_family_items
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'part_family_items' AND policyname = 'Anyone can view part_family_items'
  ) THEN
    CREATE POLICY "Anyone can view part_family_items"
    ON public.part_family_items
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Trigger to auto-update updated_at for items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_part_family_items_updated_at'
  ) THEN
    CREATE TRIGGER update_part_family_items_updated_at
    BEFORE UPDATE ON public.part_family_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;