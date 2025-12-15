-- Create table for employee shift overrides (individual day overrides)
CREATE TABLE public.employee_shift_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('F', 'S')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Enable RLS
ALTER TABLE public.employee_shift_overrides ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view employee_shift_overrides" 
ON public.employee_shift_overrides 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage employee_shift_overrides" 
ON public.employee_shift_overrides 
FOR ALL 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_employee_shift_overrides_updated_at
BEFORE UPDATE ON public.employee_shift_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();