-- Add efficiency percentage column to machines table
ALTER TABLE public.machines 
ADD COLUMN efficiency_percent integer NOT NULL DEFAULT 100;

-- Add comment explaining the column
COMMENT ON COLUMN public.machines.efficiency_percent IS 'Machine efficiency as percentage (1-100). E.g., 50 means only 50% of shift time is actual production time.';