-- Add is_internal_completion_date column to excel_column_mappings
ALTER TABLE excel_column_mappings 
ADD COLUMN is_internal_completion_date boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN excel_column_mappings.is_internal_completion_date IS 'Marks this column as the internal completion date (int. lft) for sorting and date formatting';