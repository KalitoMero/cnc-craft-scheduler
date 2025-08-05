-- Create table for machine Excel mappings
CREATE TABLE public.machine_excel_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  excel_designation TEXT NOT NULL,
  column_numbers INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.machine_excel_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for machine Excel mappings
CREATE POLICY "Anyone can view machine_excel_mappings" 
ON public.machine_excel_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage machine_excel_mappings" 
ON public.machine_excel_mappings 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_machine_excel_mappings_updated_at
BEFORE UPDATE ON public.machine_excel_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add setting for machine designation column
INSERT INTO public.settings (setting_key, setting_value, description) 
VALUES (
  'machine_designation_column',
  '1',
  'Spaltennummer in der die Maschinenbezeichnungen in Excel zu finden sind'
) ON CONFLICT (setting_key) DO NOTHING;