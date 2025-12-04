import { getBavarianHolidays } from "./bavarianWorkdays";
import { format, isWeekend } from "date-fns";

interface CustomWorkday {
  date: string;
  is_working_day: boolean;
}

// Check if a specific date is a working day
export function isWorkingDay(
  date: Date,
  customWorkdays: CustomWorkday[],
  year?: number
): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  
  // Check custom overrides first
  const custom = customWorkdays.find(cw => cw.date === dateStr);
  if (custom !== undefined) {
    return custom.is_working_day;
  }
  
  // Default: not a weekend and not a Bavarian holiday
  if (isWeekend(date)) return false;
  
  const holidays = getBavarianHolidays(year ?? date.getFullYear());
  const isHoliday = holidays.some(
    h => format(h, "yyyy-MM-dd") === dateStr
  );
  
  return !isHoliday;
}

// Count working days in a specific month considering custom workdays
export function getWorkingDaysInMonthWithCustom(
  year: number,
  month: number,
  customWorkdays: CustomWorkday[]
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (isWorkingDay(date, customWorkdays, year)) {
      workingDays++;
    }
  }
  
  return workingDays;
}
