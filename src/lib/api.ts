import { supabase } from "@/integrations/supabase/client";

// ============= EXPRESS SERVER BACKUP =============
// Um zurück zu Express zu wechseln, einfach sagen: "Wechsle zurück auf Express"
/*
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
  // Machines - Express version
  getMachines: () => request('/machines'),
  createMachine: (payload: { name: string; description?: string | null; display_order?: number; is_active?: boolean }) => 
    request('/machines', { method: 'POST', body: JSON.stringify(payload) }),
  updateMachine: (id: string, payload: Partial<{ name: string; description: string | null; display_order: number; is_active: boolean }>) => 
    request(`/machines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteMachine: (id: string) => request(`/machines/${id}`, { method: 'DELETE' }),

  // Orders - Express version
  getOrders: (machine_id?: string) => request(`/orders${machine_id ? `?machine_id=${machine_id}` : ''}`),
  deleteOrder: (orderId: string) => request(`/orders/${orderId}`, { method: 'DELETE' }),
  deleteOrdersByMachine: (machineId: string) => request(`/orders/by-machine/${machineId}`, { method: 'DELETE' }),
  reorderOrders: (updates: { id: string; sequence_order: number }[]) => 
    request('/orders/reorder', { method: 'PUT', body: JSON.stringify(updates) }),
  bulkImport: (payload: { filename: string; file_path?: string | null; orders: any[]; syncMode?: boolean }) => 
    request('/orders/bulk-import', { method: 'POST', body: JSON.stringify(payload) }),

  // Excel Mappings - Express version
  getExcelColumnMappings: () => request('/excel-column-mappings'),
  putExcelColumnMappings: (mappings: any[]) => 
    request('/excel-column-mappings', { method: 'PUT', body: JSON.stringify(mappings) }),
  getMachineExcelMappings: () => request('/machine-excel-mappings'),
  putMachineExcelMappings: (mappings: any[]) => 
    request('/machine-excel-mappings', { method: 'PUT', body: JSON.stringify(mappings) }),

  // Settings - Express version
  getSetting: (key: string) => request(`/settings/${key}`),
  putSetting: (payload: { setting_key: string; setting_value: any; description?: string | null }) => 
    request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  // Part Families - Express version
  getPartFamilies: () => request('/part-families'),
  getPartFamilyItems: () => request('/part-family-items'),
  createPartFamily: (payload: { name: string; description?: string | null }) => 
    request('/part-families', { method: 'POST', body: JSON.stringify(payload) }),
  updatePartFamily: (id: string, payload: { name: string; description?: string | null }) => 
    request(`/part-families/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  replaceFamilyItems: (id: string, items: string[]) => 
    request(`/part-families/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
};
*/

// ============= SUPABASE (AKTIV) =============
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
  
  updateMachine: async (id: string, payload: Partial<{ name: string; description: string | null; display_order: number; is_active: boolean; efficiency_percent: number; }>) => {
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

  // Orders - using Supabase
  getOrders: async (machine_id?: string) => {
    let query = supabase
      .from('orders')
      .select('*')
      .order('sequence_order', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (machine_id) {
      query = query.eq('machine_id', machine_id);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  deleteOrder: async (orderId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteOrdersByMachine: async (machineId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('machine_id', machineId)
      .select();
    
    if (error) throw new Error(error.message);
    return data;
  },

  reorderOrders: async (updates: { id: string; sequence_order: number }[]) => {
    // Batch update orders in parallel for speed
    const results = await Promise.all(
      updates.map(async (update) => {
        const { data, error } = await supabase
          .from('orders')
          .update({ sequence_order: update.sequence_order })
          .eq('id', update.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      })
    );
    return results;
  },

  bulkImport: async (payload: { filename: string; file_path?: string | null; orders: any[]; syncMode?: boolean }) => {
    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('excel_imports')
      .insert({
        filename: payload.filename,
        file_path: payload.file_path || '',
        status: 'completed',
        row_count: payload.orders.length,
      })
      .select()
      .single();
    
    if (importError) throw new Error(importError.message);
    
    const orderNumbers = payload.orders.map(o => o.order_number).filter(Boolean);
    
    // Load existing orders to check which ones already exist
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id, order_number, sequence_order, priority');
    
    const existingMap = new Map(
      existingOrders?.map(o => [o.order_number, o]) || []
    );
    
    // Sync mode: delete orders not in the new import - ONLY for affected machines (like Express)
    let deletedCount = 0;
    const affectedMachineIds = [...new Set(payload.orders.map(o => o.machine_id))];
    
    if (payload.syncMode && payload.orders.length > 0) {
      const newOrderNumbers = new Set(orderNumbers);
      
      for (const machineId of affectedMachineIds) {
        // Get existing orders for THIS machine only
        const { data: machineOrders } = await supabase
          .from('orders')
          .select('id, order_number')
          .eq('machine_id', machineId);
        
        const ordersToDelete = machineOrders?.filter(order => 
          !newOrderNumbers.has(order.order_number)
        ) || [];
        
        for (const orderToDelete of ordersToDelete) {
          const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderToDelete.id);
          if (!error) deletedCount++;
        }
      }
      
      // Resequence remaining orders for each affected machine after deletion
      if (deletedCount > 0) {
        for (const machineId of affectedMachineIds) {
          const { data: remainingOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('machine_id', machineId)
            .order('sequence_order', { ascending: true })
            .order('created_at', { ascending: true });
          
          if (remainingOrders && remainingOrders.length > 0) {
            await Promise.all(
              remainingOrders.map((order, index) =>
                supabase
                  .from('orders')
                  .update({ sequence_order: index })
                  .eq('id', order.id)
              )
            );
          }
        }
      }
    }
    
    // Separate orders into new and existing
    const ordersToInsert: any[] = [];
    const ordersToUpdate: any[] = [];
    
    for (const order of payload.orders) {
      const existing = existingMap.get(order.order_number);
      
      if (existing) {
        ordersToUpdate.push({ ...order, existingId: existing.id });
      } else {
        ordersToInsert.push(order);
      }
    }
    
    // Batch INSERT new orders
    let insertedCount = 0;
    if (ordersToInsert.length > 0) {
      const insertData = ordersToInsert.map(order => ({
        order_number: order.order_number,
        part_number: order.part_number,
        machine_id: order.machine_id,
        description: order.description,
        excel_data: order.excel_data,
        sequence_order: order.sequence_order ?? 0,
        priority: order.priority ?? 0,
        status: order.status ?? 'pending',
        excel_import_id: importRecord.id,
      }));
      
      const { error } = await supabase.from('orders').insert(insertData);
      if (!error) insertedCount = ordersToInsert.length;
    }
    
    // Batch UPDATE existing orders in parallel
    let updatedCount = 0;
    if (ordersToUpdate.length > 0) {
      const updateResults = await Promise.all(
        ordersToUpdate.map(async (order) => {
          const { error } = await supabase
            .from('orders')
            .update({
              excel_data: order.excel_data,
              part_number: order.part_number,
              machine_id: order.machine_id,
              description: order.description,
              excel_import_id: importRecord.id,
            })
            .eq('id', order.existingId);
          return !error;
        })
      );
      updatedCount = updateResults.filter(Boolean).length;
    }
    
    return {
      insertedCount,
      updatedCount,
      deletedCount,
    };
  },

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
        // Important: never send `id` on insert so Supabase always generates it
        .insert(mappings.map(m => ({
          column_name: m.column_name,
          column_number: m.column_number,
          is_ba_number: m.is_ba_number ?? false,
          is_article_number: m.is_article_number ?? false,
          is_internal_completion_date: m.is_internal_completion_date ?? false,
          is_order_duration: m.is_order_duration ?? false,
        })))
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
        // Important: never send `id` on insert so Supabase always generates it
        .insert(mappings.map(m => ({
          machine_id: m.machine_id,
          excel_designation: m.excel_designation,
          column_numbers: m.column_numbers ?? [],
        })))
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

  // Part families - using Supabase
  getPartFamilies: async () => {
    const { data, error } = await supabase
      .from('part_families')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },

  getPartFamilyItems: async () => {
    const { data, error } = await supabase
      .from('part_family_items')
      .select('*')
      .order('position', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },

  createPartFamily: async (payload: { name: string; description?: string | null }) => {
    const { data, error } = await supabase
      .from('part_families')
      .insert({
        name: payload.name,
        description: payload.description ?? null,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  updatePartFamily: async (id: string, payload: { name: string; description?: string | null }) => {
    const { data, error } = await supabase
      .from('part_families')
      .update({
        name: payload.name,
        description: payload.description ?? null,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  // Custom workdays - using Supabase
  getCustomWorkdays: async (): Promise<{ date: string; is_working_day: boolean; note: string | null }[]> => {
    const { data, error } = await supabase
      .from('custom_workdays')
      .select('date, is_working_day, note')
      .order('date', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data || [];
  },

  upsertCustomWorkday: async (payload: { date: string; is_working_day: boolean; note?: string }) => {
    const { data, error } = await supabase
      .from('custom_workdays')
      .upsert({
        date: payload.date,
        is_working_day: payload.is_working_day,
        note: payload.note ?? null,
      }, { onConflict: 'date' })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteCustomWorkday: async (date: string) => {
    const { error } = await supabase
      .from('custom_workdays')
      .delete()
      .eq('date', date);
    
    if (error) throw new Error(error.message);
  },

  deleteCustomWorkdaysInRange: async (startDate: string, endDate: string) => {
    const { error } = await supabase
      .from('custom_workdays')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (error) throw new Error(error.message);
  },

  replaceFamilyItems: async (id: string, items: string[]) => {
    // Delete all existing items for this family
    const { error: deleteError } = await supabase
      .from('part_family_items')
      .delete()
      .eq('family_id', id);
    
    if (deleteError) throw new Error(deleteError.message);
    
    // Insert new items
    if (items.length > 0) {
      const itemsToInsert = items.map((item, index) => ({
        family_id: id,
        part_value: item,
        position: index,
      }));
      
      const { data, error } = await supabase
        .from('part_family_items')
        .insert(itemsToInsert)
        .select();
      
      if (error) throw new Error(error.message);
      return data;
    }
    
    return [];
  },

  // Machine Shifts
  getMachineShifts: async (machineId?: string) => {
    let query = supabase
      .from('machine_shifts')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (machineId) {
      query = query.eq('machine_id', machineId);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  createMachineShift: async (payload: {
    machine_id: string;
    day_of_week: number;
    shift_name: string;
    start_time: string;
    end_time: string;
    hours: number;
    is_active?: boolean;
    shift_type?: string | null;
  }) => {
    const { data, error } = await supabase
      .from('machine_shifts')
      .insert({
        machine_id: payload.machine_id,
        day_of_week: payload.day_of_week,
        shift_name: payload.shift_name,
        start_time: payload.start_time,
        end_time: payload.end_time,
        hours: payload.hours,
        is_active: payload.is_active ?? true,
        shift_type: payload.shift_type ?? null,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  updateMachineShift: async (id: string, payload: Partial<{
    shift_name: string;
    start_time: string;
    end_time: string;
    hours: number;
    is_active: boolean;
    shift_type: string | null;
  }>) => {
    const { data, error } = await supabase
      .from('machine_shifts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteMachineShift: async (id: string) => {
    const { error } = await supabase
      .from('machine_shifts')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Employees
  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },

  createEmployee: async (payload: { name: string; shift_model?: number | null; shift_model_id?: string | null }) => {
    const { data, error } = await supabase
      .from('employees')
      .insert({ 
        name: payload.name, 
        shift_model: payload.shift_model ?? null,
        shift_model_id: payload.shift_model_id ?? null,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  updateEmployee: async (id: string, payload: { name?: string; is_active?: boolean; shift_model?: number | null; shift_model_id?: string | null }) => {
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Employee Shift Assignments
  getEmployeeShiftAssignments: async () => {
    const { data, error } = await supabase
      .from('employee_shift_assignments')
      .select('*');
    
    if (error) throw new Error(error.message);
    return data;
  },

  createEmployeeShiftAssignment: async (payload: { employee_id: string; machine_shift_id: string }) => {
    const { data, error } = await supabase
      .from('employee_shift_assignments')
      .insert(payload)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteEmployeeShiftAssignment: async (id: string) => {
    const { error } = await supabase
      .from('employee_shift_assignments')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Employee Sick Days
  getEmployeeSickDays: async () => {
    const { data, error } = await supabase
      .from('employee_sick_days')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data;
  },

  createEmployeeSickDay: async (payload: { employee_id: string; date: string; note?: string }) => {
    const { data, error } = await supabase
      .from('employee_sick_days')
      .insert({
        employee_id: payload.employee_id,
        date: payload.date,
        note: payload.note ?? null,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteEmployeeSickDay: async (id: string) => {
    const { error } = await supabase
      .from('employee_sick_days')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Employee Vacation Days
  getEmployeeVacationDays: async () => {
    const { data, error } = await supabase
      .from('employee_vacation_days')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data;
  },

  createEmployeeVacationDay: async (payload: { employee_id: string; date: string; note?: string }) => {
    const { data, error } = await supabase
      .from('employee_vacation_days')
      .insert({
        employee_id: payload.employee_id,
        date: payload.date,
        note: payload.note ?? null,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteEmployeeVacationDay: async (id: string) => {
    const { error } = await supabase
      .from('employee_vacation_days')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Employee Shift Overrides
  getEmployeeShiftOverrides: async () => {
    const { data, error } = await supabase
      .from('employee_shift_overrides')
      .select('*')
      .order('date', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },

  upsertEmployeeShiftOverride: async (payload: { employee_id: string; date: string; shift_type: 'F' | 'S' }) => {
    const { data, error } = await supabase
      .from('employee_shift_overrides')
      .upsert({
        employee_id: payload.employee_id,
        date: payload.date,
        shift_type: payload.shift_type,
      }, { onConflict: 'employee_id,date' })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteEmployeeShiftOverride: async (employeeId: string, date: string) => {
    const { error } = await supabase
      .from('employee_shift_overrides')
      .delete()
      .eq('employee_id', employeeId)
      .eq('date', date);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Employee Machine Assignments (Default)
  getEmployeeMachineAssignments: async () => {
    const { data, error } = await supabase
      .from('employee_machine_assignments')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },

  createEmployeeMachineAssignment: async (payload: { employee_id: string; machine_id: string }) => {
    const { data, error } = await supabase
      .from('employee_machine_assignments')
      .insert({
        employee_id: payload.employee_id,
        machine_id: payload.machine_id,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteEmployeeMachineAssignment: async (id: string) => {
    const { error } = await supabase
      .from('employee_machine_assignments')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Daily Machine Assignments (Overrides)
  getDailyMachineAssignments: async (date?: string) => {
    let query = supabase
      .from('daily_machine_assignments')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (date) {
      query = query.eq('date', date);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  upsertDailyMachineAssignment: async (payload: { employee_id: string; machine_id: string; date: string }) => {
    const { data, error } = await supabase
      .from('daily_machine_assignments')
      .upsert({
        employee_id: payload.employee_id,
        machine_id: payload.machine_id,
        date: payload.date,
      }, { onConflict: 'employee_id,date' })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteDailyMachineAssignment: async (employeeId: string, date: string) => {
    const { error } = await supabase
      .from('daily_machine_assignments')
      .delete()
      .eq('employee_id', employeeId)
      .eq('date', date);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Shift Models
  getShiftModels: async () => {
    const { data, error } = await supabase
      .from('shift_models')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },

  createShiftModel: async (payload: { 
    name: string; 
    shift_type: string; 
    description?: string; 
    is_system?: boolean;
    source_machine_shift_id?: string;
  }) => {
    const { data, error } = await supabase
      .from('shift_models')
      .insert({
        name: payload.name,
        shift_type: payload.shift_type,
        description: payload.description ?? null,
        is_system: payload.is_system ?? false,
        source_machine_shift_id: payload.source_machine_shift_id ?? null,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  deleteShiftModel: async (id: string) => {
    const { error } = await supabase
      .from('shift_models')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Sync shift model when creating machine shift
  syncShiftModelFromMachineShift: async (shiftName: string, machineShiftId: string) => {
    // Check if shift model with this name already exists
    const { data: existing } = await supabase
      .from('shift_models')
      .select('id')
      .eq('name', shiftName)
      .maybeSingle();
    
    if (existing) return existing;
    
    // Create new shift model
    const { data, error } = await supabase
      .from('shift_models')
      .insert({
        name: shiftName,
        shift_type: 'fixed',
        description: `Automatisch erstellt aus Maschinenschicht`,
        is_system: false,
        source_machine_shift_id: machineShiftId,
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  // Get all machine shifts (for MachineAssignmentTab)
  getAllMachineShifts: async () => {
    const { data, error } = await supabase
      .from('machine_shifts')
      .select('*')
      .eq('is_active', true)
      .order('machine_id', { ascending: true })
      .order('shift_name', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  },
};

export type ApiType = typeof api;
