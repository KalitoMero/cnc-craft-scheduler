import { useMemo } from "react";

interface MachineShift {
  id: string;
  machine_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  shift_name: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;   // "HH:MM:SS"
  hours: number;
  is_active: boolean;
}

interface Order {
  id: string;
  excel_data?: Record<string, any> | null;
  [key: string]: any;
}

interface ExcelColumnMapping {
  column_name: string;
  is_order_duration?: boolean;
}

// Parse time string "HH:MM:SS" or "HH:MM" to minutes from midnight
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

// Get order duration in minutes from excel_data
function getOrderDuration(order: Order, durationColumnName: string | null): number {
  if (!order.excel_data) return 0;
  
  // First try the explicitly configured column
  if (durationColumnName) {
    const value = order.excel_data[durationColumnName];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (!isNaN(num) && num > 0) {
        return Math.max(0, num);
      }
    }
  }
  
  // Fallback: Look for common duration column names
  // "tg" is in minutes, "Zeit" is in hours (needs conversion)
  const minutesColumns = ['tg', 'minuten', 'min', 'dauer_min'];
  const hoursColumns = ['Zeit', 'zeit', 'stunden', 'hours', 'dauer', 'duration'];
  
  // Try minutes columns first
  for (const col of minutesColumns) {
    const value = order.excel_data[col];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (!isNaN(num) && num > 0) {
        return Math.max(0, num);
      }
    }
  }
  
  // Try hours columns (convert to minutes)
  for (const col of hoursColumns) {
    const value = order.excel_data[col];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (!isNaN(num) && num > 0) {
        // Convert hours to minutes
        return Math.max(0, Math.round(num * 60));
      }
    }
  }
  
  return 0;
}

// Calculate completion time considering shifts
export function calculateCompletionTime(
  startDateTime: Date,
  durationMinutes: number,
  shifts: MachineShift[]
): Date {
  if (durationMinutes <= 0 || shifts.length === 0) {
    return new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
  }

  const activeShifts = shifts.filter(s => s.is_active);
  if (activeShifts.length === 0) {
    // No active shifts - just add duration linearly
    return new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
  }

  let currentTime = new Date(startDateTime);
  let remainingMinutes = durationMinutes;
  const maxIterations = 365 * 24; // Safety limit: 1 year
  let iterations = 0;

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    // Find shifts for current day
    const dayShifts = activeShifts
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time));

    if (dayShifts.length === 0) {
      // No shifts today - move to next day at midnight
      currentTime = new Date(currentTime);
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(0, 0, 0, 0);
      continue;
    }

    let workedThisDay = false;

    for (const shift of dayShifts) {
      const shiftStart = parseTimeToMinutes(shift.start_time);
      let shiftEnd = parseTimeToMinutes(shift.end_time);
      
      // Handle overnight shifts (end time < start time means next day)
      const isOvernightShift = shiftEnd <= shiftStart;
      if (isOvernightShift) {
        shiftEnd = 24 * 60; // Treat as ending at midnight for this day
      }

      if (currentMinutes >= shiftEnd) {
        // Shift already passed
        continue;
      }

      // Calculate effective start time within shift
      const effectiveStart = Math.max(currentMinutes, shiftStart);
      const availableMinutes = shiftEnd - effectiveStart;

      if (availableMinutes <= 0) continue;

      workedThisDay = true;

      if (remainingMinutes <= availableMinutes) {
        // Finish within this shift
        currentTime.setHours(0, 0, 0, 0);
        currentTime = new Date(currentTime.getTime() + (effectiveStart + remainingMinutes) * 60 * 1000);
        remainingMinutes = 0;
        break;
      } else {
        // Use all available time in this shift
        remainingMinutes -= availableMinutes;
        currentTime.setHours(0, 0, 0, 0);
        currentTime = new Date(currentTime.getTime() + shiftEnd * 60 * 1000);
      }
    }

    if (remainingMinutes > 0) {
      // Move to next day
      currentTime = new Date(currentTime);
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(0, 0, 0, 0);
    }
  }

  return currentTime;
}

// Find next available shift start time
export function findNextShiftStart(fromDateTime: Date, shifts: MachineShift[]): Date {
  const activeShifts = shifts.filter(s => s.is_active);
  if (activeShifts.length === 0) return fromDateTime;

  let currentTime = new Date(fromDateTime);
  const maxDays = 14; // Look ahead max 2 weeks

  for (let day = 0; day < maxDays; day++) {
    const dayOfWeek = currentTime.getDay();
    const currentMinutes = day === 0 ? currentTime.getHours() * 60 + currentTime.getMinutes() : 0;

    const dayShifts = activeShifts
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time));

    for (const shift of dayShifts) {
      const shiftStart = parseTimeToMinutes(shift.start_time);
      let shiftEnd = parseTimeToMinutes(shift.end_time);
      if (shiftEnd <= shiftStart) shiftEnd = 24 * 60;

      if (currentMinutes < shiftEnd) {
        // This shift is still available
        const effectiveStart = Math.max(currentMinutes, shiftStart);
        const result = new Date(currentTime);
        result.setHours(0, 0, 0, 0);
        return new Date(result.getTime() + effectiveStart * 60 * 1000);
      }
    }

    // Move to next day
    currentTime.setDate(currentTime.getDate() + 1);
    currentTime.setHours(0, 0, 0, 0);
  }

  return fromDateTime;
}

export interface ScheduledOrder {
  orderId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export function useProductionSchedule(
  orders: Order[],
  shifts: MachineShift[],
  productionStart: Date | null,
  excelColumnMappings: ExcelColumnMapping[] | undefined,
  efficiencyPercent: number = 100
): Map<string, ScheduledOrder> {
  return useMemo(() => {
    const scheduleMap = new Map<string, ScheduledOrder>();
    
    if (!productionStart || !orders.length) {
      return scheduleMap;
    }

    // Find duration column
    const durationColumn = excelColumnMappings?.find(c => c.is_order_duration);
    const durationColumnName = durationColumn?.column_name || null;

    // Calculate efficiency factor (e.g., 50% efficiency means tasks take twice as long in real time)
    const efficiencyFactor = Math.max(1, Math.min(100, efficiencyPercent)) / 100;

    let currentTime = findNextShiftStart(productionStart, shifts);

    for (const order of orders) {
      const baseDuration = getOrderDuration(order, durationColumnName);
      // Adjust duration based on efficiency: 60min task at 50% efficiency = 120min real time
      const effectiveDuration = efficiencyFactor > 0 ? Math.round(baseDuration / efficiencyFactor) : baseDuration;
      
      const startTime = new Date(currentTime);
      const endTime = calculateCompletionTime(currentTime, effectiveDuration, shifts);
      
      scheduleMap.set(order.id, {
        orderId: order.id,
        startTime,
        endTime,
        durationMinutes: baseDuration, // Show original duration to user
      });

      // Next order starts where this one ends
      currentTime = endTime;
    }

    return scheduleMap;
  }, [orders, shifts, productionStart, excelColumnMappings, efficiencyPercent]);
}
