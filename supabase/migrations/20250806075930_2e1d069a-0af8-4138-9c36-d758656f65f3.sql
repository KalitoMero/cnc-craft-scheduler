-- Add unique constraint on machine_id to allow proper upsert operations
ALTER TABLE machine_excel_mappings 
ADD CONSTRAINT machine_excel_mappings_machine_id_unique UNIQUE (machine_id);