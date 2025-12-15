-- Add shift_model column to employees (1 = Schicht 1, 2 = Schicht 2)
ALTER TABLE public.employees ADD COLUMN shift_model INTEGER DEFAULT NULL;

-- Create employee vacation days table
CREATE TABLE public.employee_vacation_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Enable RLS
ALTER TABLE public.employee_vacation_days ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view employee_vacation_days" ON public.employee_vacation_days FOR SELECT USING (true);
CREATE POLICY "Anyone can manage employee_vacation_days" ON public.employee_vacation_days FOR ALL USING (true);