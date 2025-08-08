-- Add display_order column to machines table for manual ordering
ALTER TABLE public.machines 
ADD COLUMN display_order INTEGER DEFAULT 0;

-- Update existing machines with display_order based on their current order
UPDATE public.machines 
SET display_order = row_number() OVER (ORDER BY name)
WHERE display_order = 0;

-- Create index for better performance on ordering
CREATE INDEX idx_machines_display_order ON public.machines(display_order);