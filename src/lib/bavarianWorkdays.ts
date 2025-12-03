// Bavarian public holidays (fixed and variable)
// Returns working days count for each month

const getEasterDate = (year: number): Date => {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getBavarianHolidays = (year: number): Date[] => {
  const easter = getEasterDate(year);
  
  const holidays: Date[] = [
    // Fixed holidays
    new Date(year, 0, 1),   // Neujahr
    new Date(year, 0, 6),   // Heilige Drei Könige
    new Date(year, 4, 1),   // Tag der Arbeit
    new Date(year, 7, 15),  // Mariä Himmelfahrt
    new Date(year, 9, 3),   // Tag der Deutschen Einheit
    new Date(year, 10, 1),  // Allerheiligen
    new Date(year, 11, 25), // 1. Weihnachtstag
    new Date(year, 11, 26), // 2. Weihnachtstag
    
    // Easter-based holidays
    new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000),  // Karfreitag (-2)
    new Date(easter.getTime() + 1 * 24 * 60 * 60 * 1000),  // Ostermontag (+1)
    new Date(easter.getTime() + 39 * 24 * 60 * 60 * 1000), // Christi Himmelfahrt (+39)
    new Date(easter.getTime() + 50 * 24 * 60 * 60 * 1000), // Pfingstmontag (+50)
    new Date(easter.getTime() + 60 * 24 * 60 * 60 * 1000), // Fronleichnam (+60)
  ];
  
  return holidays;
};

const isHoliday = (date: Date, holidays: Date[]): boolean => {
  return holidays.some(h => 
    h.getFullYear() === date.getFullYear() &&
    h.getMonth() === date.getMonth() &&
    h.getDate() === date.getDate()
  );
};

export const getWorkingDaysInMonth = (year: number, month: number): number => {
  const holidays = getBavarianHolidays(year);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    // Skip holidays
    if (isHoliday(date, holidays)) continue;
    
    workingDays++;
  }
  
  return workingDays;
};

export const getMonthName = (month: number): string => {
  const names = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return names[month];
};
