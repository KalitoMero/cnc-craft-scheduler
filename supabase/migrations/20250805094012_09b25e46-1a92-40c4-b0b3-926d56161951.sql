-- Create machines table
CREATE TABLE public.machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create excel_imports table
CREATE TABLE public.excel_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  imported_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  row_count INTEGER DEFAULT 0
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  excel_import_id UUID REFERENCES public.excel_imports(id) ON DELETE SET NULL,
  order_number TEXT,
  part_number TEXT,
  description TEXT,
  quantity INTEGER,
  priority INTEGER DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  excel_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create policies for machines
CREATE POLICY "Anyone can view machines" 
ON public.machines 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage machines" 
ON public.machines 
FOR ALL 
USING (true);

-- Create policies for excel_imports
CREATE POLICY "Anyone can view excel_imports" 
ON public.excel_imports 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage excel_imports" 
ON public.excel_imports 
FOR ALL 
USING (true);

-- Create policies for orders
CREATE POLICY "Anyone can view orders" 
ON public.orders 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage orders" 
ON public.orders 
FOR ALL 
USING (true);

-- Create policies for settings
CREATE POLICY "Anyone can view settings" 
ON public.settings 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage settings" 
ON public.settings 
FOR ALL 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (setting_key, setting_value, description) VALUES
('excel_column_mapping', '{"machine_column": "Maschine", "order_number_column": "Auftragsnummer", "part_number_column": "Teilenummer", "description_column": "Beschreibung", "quantity_column": "Menge"}', 'Excel-Spalten-Mapping für Import'),
('display_columns', '["order_number", "part_number", "description", "quantity", "status"]', 'Anzuzeigende Spalten in der Auftragsübersicht');

-- Create indexes for better performance
CREATE INDEX idx_orders_machine_id ON public.orders(machine_id);
CREATE INDEX idx_orders_sequence_order ON public.orders(machine_id, sequence_order);
CREATE INDEX idx_orders_excel_import_id ON public.orders(excel_import_id);