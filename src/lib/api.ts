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
  // Machines
  getMachines: () => request('/machines'),
  createMachine: (payload: { name: string; description?: string | null; display_order?: number; is_active?: boolean; }) =>
    request('/machines', { method: 'POST', body: JSON.stringify(payload) }),
  updateMachine: (id: string, payload: Partial<{ name: string; description: string | null; display_order: number; is_active: boolean; }>) =>
    request(`/machines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteMachine: (id: string) => request(`/machines/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: (machine_id?: string) => request(`/orders${machine_id ? `?machine_id=${machine_id}` : ''}`),
  deleteOrder: (orderId: string) => request(`/orders/${orderId}`, { method: 'DELETE' }),
  deleteOrdersByMachine: (machineId: string) => request(`/orders/by-machine/${machineId}`, { method: 'DELETE' }),
  reorderOrders: (updates: { id: string; sequence_order: number }[]) => request('/orders/reorder', { method: 'PUT', body: JSON.stringify(updates) }),
  bulkImport: (payload: { filename: string; file_path?: string | null; orders: any[]; syncMode?: boolean }) => request('/orders/bulk-import', { method: 'POST', body: JSON.stringify(payload) }),

  // Settings + Excel mappings
  getExcelColumnMappings: () => request('/excel-column-mappings'),
  putExcelColumnMappings: (mappings: any[]) => request('/excel-column-mappings', { method: 'PUT', body: JSON.stringify(mappings) }),
  getMachineExcelMappings: () => request('/machine-excel-mappings'),
  putMachineExcelMappings: (mappings: any[]) => request('/machine-excel-mappings', { method: 'PUT', body: JSON.stringify(mappings) }),
  getSetting: (key: string) => request(`/settings/${encodeURIComponent(key)}`),
  putSetting: (payload: { setting_key: string; setting_value: any; description?: string | null }) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  // Part families
  getPartFamilies: () => request('/part-families'),
  getPartFamilyItems: () => request('/part-family-items'),
  createPartFamily: (payload: { name: string; description?: string | null }) => request('/part-families', { method: 'POST', body: JSON.stringify(payload) }),
  updatePartFamily: (id: string, payload: { name: string; description?: string | null }) => request(`/part-families/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  replaceFamilyItems: (id: string, items: string[]) => request(`/part-families/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
};

export type ApiType = typeof api;
