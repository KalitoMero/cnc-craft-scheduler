-- Add is_order_duration column to excel_column_mappings
ALTER TABLE public.excel_column_mappings 
ADD COLUMN is_order_duration BOOLEAN NOT NULL DEFAULT false;