/**
 * Utility functions for merging overlapping time intervals
 */

export interface TimeInterval {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

/**
 * Parse a time string (HH:MM:SS or HH:MM) to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight back to hours (decimal)
 */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Merge overlapping time intervals and return total effective hours
 * @param intervals Array of time intervals (start/end in minutes from midnight)
 * @returns Total effective hours after merging overlaps
 */
export function mergeIntervalsAndGetHours(intervals: TimeInterval[]): number {
  if (intervals.length === 0) return 0;
  
  // Sort by start time
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  
  const merged: TimeInterval[] = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    if (next.start <= current.end) {
      // Overlapping or adjacent - extend current interval
      current.end = Math.max(current.end, next.end);
    } else {
      // No overlap - push current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  
  // Calculate total minutes
  const totalMinutes = merged.reduce((sum, interval) => {
    return sum + (interval.end - interval.start);
  }, 0);
  
  return minutesToHours(totalMinutes);
}

/**
 * Get the calendar week number for a date (ISO week)
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Determine if an employee works a specific shift type on a given date based on their shift model
 * @param shiftModelType - 'alternating_early' (Schicht 1), 'alternating_late' (Schicht 2), 'fixed' (Normalschicht)
 * @param shiftType - 'F' (Frühschicht), 'S' (Spätschicht), 'No' (Normalschicht)
 * @param date - The date to check
 */
export function doesEmployeeWorkShift(
  shiftModelType: string | null,
  shiftType: string | null,
  date: Date
): boolean {
  if (!shiftModelType || !shiftType) return false;
  
  // Normalschicht employees only work 'No' shifts
  if (shiftModelType === 'fixed') {
    return shiftType === 'No';
  }
  
  const weekNumber = getISOWeekNumber(date);
  const isEvenWeek = weekNumber % 2 === 0;
  
  // Schicht 1 (alternating_early): F in even weeks, S in odd weeks
  if (shiftModelType === 'alternating_early') {
    if (isEvenWeek) {
      return shiftType === 'F';
    } else {
      return shiftType === 'S';
    }
  }
  
  // Schicht 2 (alternating_late): S in even weeks, F in odd weeks
  if (shiftModelType === 'alternating_late') {
    if (isEvenWeek) {
      return shiftType === 'S';
    } else {
      return shiftType === 'F';
    }
  }
  
  return false;
}
