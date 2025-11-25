-- Add UNIQUE constraint to order_number for upsert functionality
ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);