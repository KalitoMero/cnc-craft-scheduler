-- Add display_order column to machines table for manual ordering
ALTER TABLE public.machines 
ADD COLUMN display_order INTEGER DEFAULT 0;

-- Create index for better performance on ordering
CREATE INDEX idx_machines_display_order ON public.machines(display_order);