// Helper function to extract base order number (without AFO)
export const getBaseOrderNumber = (orderNumber: string | null | undefined): string => {
  if (!orderNumber) return '';
  // Check if order number matches pattern: 9 digits.point.2 digits
  const match = orderNumber.match(/^(\d{9})\.\d{2}$/);
  return match ? match[1] : orderNumber;
};

// Helper function to extract AFO number
export const getAfoNumber = (orderNumber: string | null | undefined): number => {
  if (!orderNumber) return 0;
  const match = orderNumber.match(/^(\d{9})\.(\d{2})$/);
  return match ? parseInt(match[2], 10) : 0;
};

export interface GroupedOrder {
  id: string;
  order_number: string | null;
  sequence_order: number;
  excel_data?: Record<string, any> | null;
  subOrders: any[];
  hasSubOrders: boolean;
  [key: string]: any;
}

// Group orders by base order number and select lowest AFO as main order
export const groupOrdersByBase = (ordersList: any[]): GroupedOrder[] => {
  const grouped = new Map<string, any[]>();
  
  ordersList.forEach(order => {
    if (!order.order_number) return;
    
    const baseNumber = getBaseOrderNumber(order.order_number);
    if (!grouped.has(baseNumber)) {
      grouped.set(baseNumber, []);
    }
    grouped.get(baseNumber)!.push(order);
  });

  const result = Array.from(grouped.values()).map(group => {
    // Sort by AFO number (lowest first)
    group.sort((a, b) => getAfoNumber(a.order_number) - getAfoNumber(b.order_number));
    
    const mainOrder = group[0];
    const subOrders = group.slice(1);
    
    return {
      ...mainOrder,
      subOrders: subOrders,
      hasSubOrders: subOrders.length > 0
    } as GroupedOrder;
  });

  // Sort by main order's sequence_order
  result.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
  
  return result;
};
