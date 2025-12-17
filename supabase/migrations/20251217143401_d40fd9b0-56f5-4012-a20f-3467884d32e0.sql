-- Create table for custom shift types
CREATE TABLE public.shift_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  abbreviation TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view shift_types" ON public.shift_types FOR SELECT USING (true);
CREATE POLICY "Anyone can manage shift_types" ON public.shift_types FOR ALL USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_shift_types_updated_at
  BEFORE UPDATE ON public.shift_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default shift types
INSERT INTO public.shift_types (abbreviation, name, color) VALUES
  ('F', 'Frühschicht', '#eab308'),
  ('S', 'Spätschicht', '#3b82f6'),
  ('No', 'Normalschicht', '#22c55e'),
  ('FT', 'Feiertag', '#ef4444'),
  ('U', 'Urlaub', '#8b5cf6'),
  ('K', 'Krank', '#f97316');