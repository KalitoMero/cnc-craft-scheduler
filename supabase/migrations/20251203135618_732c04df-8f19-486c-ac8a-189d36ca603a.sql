-- Create table for machine shifts
CREATE TABLE public.machine_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  shift_name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.machine_shifts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view machine_shifts" 
ON public.machine_shifts 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage machine_shifts" 
ON public.machine_shifts 
FOR ALL 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_machine_shifts_updated_at
BEFORE UPDATE ON public.machine_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_machine_shifts_machine_day ON public.machine_shifts(machine_id, day_of_week);