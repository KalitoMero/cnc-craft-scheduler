import { supabase } from "@/integrations/supabase/client";

// Simple HTTP client for Express API
const DEFAULT_BASE = 'http://172.16.5.153:3006/api';
const getBase = () => localStorage.getItem('API_BASE_URL') || DEFAULT_BASE;

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok || (data && data.success === false)) {
    const msg = (data && (data.error || data.message)) || res.statusText;
    throw new Error(msg);
  }
  return data?.data !== undefined ? data.data : data;
}

export const api = {
  // Machines - using Supabase
  getMachines: async () => {
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },
  
  createMachine: async (payload: { name: string; description?: string | null; display_order?: number; is_active?: boolean; }) => {
    const { data, error } = await supabase
      .from('machines')
      .insert({
        name: payload.name,
        description: payload.description ?? null,
        display_order: payload.display_order ?? 0,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },
  
  updateMachine: async (id: string, payload: Partial<{ name: string; description: string | null; display_order: number; is_active: boolean; }>) => {
    const { data, error } = await supabase
      .from('machines')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },
  
  deleteMachine: async (id: string) => {
    const { data, error } = await supabase
      .from('machines')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  // Orders
  getOrders: (machine_id?: string) => request(`/orders${machine_id ? `?machine_id=${machine_id}` : ''}`),
  deleteOrder: (orderId: string) => request(`/orders/${orderId}`, { method: 'DELETE' }),
  deleteOrdersByMachine: (machineId: string) => request(`/orders/by-machine/${machineId}`, { method: 'DELETE' }),
  reorderOrders: (updates: { id: string; sequence_order: number }[]) => request('/orders/reorder', { method: 'PUT', body: JSON.stringify(updates) }),
  bulkImport: (payload: { filename: string; file_path?: string | null; orders: any[]; syncMode?: boolean }) => request('/orders/bulk-import', { method: 'POST', body: JSON.stringify(payload) }),

  // Settings + Excel mappings - using Supabase
  getExcelColumnMappings: async () => {
    const { data, error } = await supabase
      .from('excel_column_mappings')
      .select('*')
      .order('column_number', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },
  
  putExcelColumnMappings: async (mappings: any[]) => {
    // Delete all existing mappings
    const { error: deleteError } = await supabase
      .from('excel_column_mappings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) throw new Error(deleteError.message);
    
    // Insert new mappings
    if (mappings.length > 0) {
      const { data, error } = await supabase
        .from('excel_column_mappings')
        .insert(mappings.map(m => {
          const mapping: any = {
            column_name: m.column_name,
            column_number: m.column_number,
            is_ba_number: m.is_ba_number ?? false,
            is_article_number: m.is_article_number ?? false,
          };
          // Only include id if it exists
          if (m.id) {
            mapping.id = m.id;
          }
          return mapping;
        }))
        .select();
      
      if (error) throw new Error(error.message);
      return data;
    }
    return [];
  },
  
  getMachineExcelMappings: async () => {
    const { data, error } = await supabase
      .from('machine_excel_mappings')
      .select('*');
    
    if (error) throw new Error(error.message);
    return data;
  },
  
  putMachineExcelMappings: async (mappings: any[]) => {
    // Delete all existing mappings
    const { error: deleteError } = await supabase
      .from('machine_excel_mappings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) throw new Error(deleteError.message);
    
    // Insert new mappings
    if (mappings.length > 0) {
      const { data, error } = await supabase
        .from('machine_excel_mappings')
        .insert(mappings.map(m => {
          const mapping: any = {
            machine_id: m.machine_id,
            excel_designation: m.excel_designation,
            column_numbers: m.column_numbers ?? [],
          };
          // Only include id if it exists
          if (m.id) {
            mapping.id = m.id;
          }
          return mapping;
        }))
        .select();
      
      if (error) throw new Error(error.message);
      return data;
    }
    return [];
  },
  
  getSetting: async (key: string) => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('setting_key', key)
      .maybeSingle();
    
    if (error) throw new Error(error.message);
    return data;
  },
  
  putSetting: async (payload: { setting_key: string; setting_value: any; description?: string | null }) => {
    // Try to update first
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('setting_key', payload.setting_key)
      .maybeSingle();
    
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('settings')
        .update({
          setting_value: payload.setting_value,
          description: payload.description ?? null,
        })
        .eq('setting_key', payload.setting_key)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('settings')
        .insert({
          setting_key: payload.setting_key,
          setting_value: payload.setting_value,
          description: payload.description ?? null,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    }
  },

  // Part families
  getPartFamilies: () => request('/part-families'),
  getPartFamilyItems: () => request('/part-family-items'),
  createPartFamily: (payload: { name: string; description?: string | null }) => request('/part-families', { method: 'POST', body: JSON.stringify(payload) }),
  updatePartFamily: (id: string, payload: { name: string; description?: string | null }) => request(`/part-families/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  replaceFamilyItems: (id: string, items: string[]) => request(`/part-families/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
};

export type ApiType = typeof api;
