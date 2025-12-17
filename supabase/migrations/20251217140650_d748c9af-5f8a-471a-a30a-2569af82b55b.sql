-- Create shift_models table
CREATE TABLE public.shift_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  shift_type text NOT NULL, -- 'alternating_early', 'alternating_late', 'fixed'
  description text,
  is_system boolean NOT NULL DEFAULT false,
  source_machine_shift_id uuid REFERENCES machine_shifts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_models ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view shift_models" ON public.shift_models FOR SELECT USING (true);
CREATE POLICY "Anyone can manage shift_models" ON public.shift_models FOR ALL USING (true);

-- Insert default system shift models
INSERT INTO public.shift_models (name, shift_type, description, is_system) VALUES
  ('Schicht 1', 'alternating_early', 'Frühschicht in geraden Wochen, Spätschicht in ungeraden Wochen', true),
  ('Schicht 2', 'alternating_late', 'Spätschicht in geraden Wochen, Frühschicht in ungeraden Wochen', true),
  ('Normalschicht', 'fixed', 'Feste Schicht ohne Wechsel', true);

-- Add shift_model_id column to employees (keeping old shift_model for migration)
ALTER TABLE public.employees ADD COLUMN shift_model_id uuid REFERENCES shift_models(id) ON DELETE SET NULL;

-- Migrate existing data: shift_model 1 -> Schicht 1, shift_model 2 -> Schicht 2
UPDATE public.employees e
SET shift_model_id = (SELECT id FROM public.shift_models WHERE name = 'Schicht 1')
WHERE e.shift_model = 1;

UPDATE public.employees e
SET shift_model_id = (SELECT id FROM public.shift_models WHERE name = 'Schicht 2')
WHERE e.shift_model = 2;

-- Create trigger for updated_at
CREATE TRIGGER tr_shift_models_updated_at 
  BEFORE UPDATE ON public.shift_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();