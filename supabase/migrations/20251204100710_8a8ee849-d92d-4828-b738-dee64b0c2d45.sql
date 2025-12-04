-- Table for custom working days overrides
CREATE TABLE public.custom_workdays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public access for this internal tool)
ALTER TABLE public.custom_workdays ENABLE ROW LEVEL SECURITY;

-- Allow all operations (internal business tool without auth)
CREATE POLICY "Allow all operations on custom_workdays" 
ON public.custom_workdays 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_custom_workdays_updated_at
BEFORE UPDATE ON public.custom_workdays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();