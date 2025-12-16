-- Create table for default employee-to-machine assignments (no shift, just machine)
CREATE TABLE public.employee_machine_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, machine_id)
);

-- Enable RLS
ALTER TABLE public.employee_machine_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view employee_machine_assignments" 
ON public.employee_machine_assignments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage employee_machine_assignments" 
ON public.employee_machine_assignments 
FOR ALL 
USING (true);

-- Create table for daily overrides
CREATE TABLE public.daily_machine_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_machine_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view daily_machine_assignments" 
ON public.daily_machine_assignments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage daily_machine_assignments" 
ON public.daily_machine_assignments 
FOR ALL 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_employee_machine_assignments_updated_at
BEFORE UPDATE ON public.employee_machine_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();