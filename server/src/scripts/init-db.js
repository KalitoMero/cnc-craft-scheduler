const { query, pool } = require('../config/database');

// Initializes the PostgreSQL schema used by the Express API
// Usage: npm run init-db

const SQL = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Machines
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Excel imports
CREATE TABLE IF NOT EXISTS excel_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid NULL,
  row_count integer DEFAULT 0
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  excel_import_id uuid NULL REFERENCES excel_imports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  order_number text NULL,
  part_number text NULL,
  description text NULL,
  quantity integer NULL,
  priority integer DEFAULT 0,
  sequence_order integer NOT NULL DEFAULT 0,
  excel_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_machine_seq ON orders(machine_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_key ON settings(setting_key);

-- Excel column mappings
CREATE TABLE IF NOT EXISTS excel_column_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_name text NOT NULL,
  column_number integer NOT NULL,
  is_article_number boolean NOT NULL DEFAULT false,
  is_ba_number boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Part families
CREATE TABLE IF NOT EXISTS part_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Part family items
CREATE TABLE IF NOT EXISTS part_family_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES part_families(id) ON DELETE CASCADE,
  part_value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pfi_family_position ON part_family_items(family_id, position);

-- Machine Excel mappings
CREATE TABLE IF NOT EXISTS machine_excel_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  excel_designation text NOT NULL,
  column_numbers integer[] NOT NULL DEFAULT '{}'::integer[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers for updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_machines_updated_at') THEN
    CREATE TRIGGER tr_machines_updated_at BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_orders_updated_at') THEN
    CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_settings_updated_at') THEN
    CREATE TRIGGER tr_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_ecm_updated_at') THEN
    CREATE TRIGGER tr_ecm_updated_at BEFORE UPDATE ON excel_column_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_pf_updated_at') THEN
    CREATE TRIGGER tr_pf_updated_at BEFORE UPDATE ON part_families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_pfi_updated_at') THEN
    CREATE TRIGGER tr_pfi_updated_at BEFORE UPDATE ON part_family_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_mem_updated_at') THEN
    CREATE TRIGGER tr_mem_updated_at BEFORE UPDATE ON machine_excel_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
`;

(async () => {
  try {
    console.log('Initializing database schema...');
    await query('BEGIN');
    await query(SQL);
    await query('COMMIT');
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err);
    try { await query('ROLLBACK'); } catch {}
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
