-- Create table for Excel column mappings
CREATE TABLE public.excel_column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_name TEXT NOT NULL,
  column_number INTEGER NOT NULL,
  is_ba_number BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.excel_column_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Anyone can view excel_column_mappings" 
ON public.excel_column_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage excel_column_mappings" 
ON public.excel_column_mappings 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_excel_column_mappings_updated_at
BEFORE UPDATE ON public.excel_column_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();