-- Add shift_type column to machine_shifts table to indicate if it's an early shift (F), late shift (S), or other
ALTER TABLE public.machine_shifts ADD COLUMN IF NOT EXISTS shift_type text;