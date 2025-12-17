import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plus, Trash2, UserPlus, CalendarDays, AlertCircle, Users, Palmtree, LayoutGrid, Cog, Palette } from "lucide-react";
import MachineAssignmentTab from "@/components/MachineAssignmentTab";
import { format, parseISO, getISOWeek, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, startOfMonth, endOfMonth, isSameDay, addDays, isWeekend } from "date-fns";
import type { DateRange } from "react-day-picker";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getBavarianHolidays } from "@/lib/bavarianWorkdays";

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
  shift_model: number | null;
  shift_model_id: string | null;
}

interface ShiftModel {
  id: string;
  name: string;
  shift_type: string; // 'alternating_early', 'alternating_late', 'fixed'
  description: string | null;
  is_system: boolean;
  source_machine_shift_id: string | null;
}

interface EmployeeSickDay {
  id: string;
  employee_id: string;
  date: string;
  note: string | null;
}

interface EmployeeVacationDay {
  id: string;
  employee_id: string;
  date: string;
  note: string | null;
}

interface ShiftType {
  id: string;
  abbreviation: string;
  name: string;
  color: string;
}

interface EmployeeShiftOverride {
  id: string;
  employee_id: string;
  date: string;
  shift_type: string;
}

const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// Helper to determine if an employee has early or late shift in a given week
// Now supports shift_model_id for dynamic shift models
const getShiftTypeForWeek = (shiftModel: number | null, weekNumber: number, shiftModelData?: ShiftModel | null): "early" | "late" | "fixed" | null => {
  // If employee has a shift_model_id, use the shift_type from the model
  if (shiftModelData) {
    if (shiftModelData.shift_type === 'fixed') return "fixed";
    if (shiftModelData.shift_type === 'alternating_early') {
      const isEvenWeek = weekNumber % 2 === 0;
      return isEvenWeek ? "early" : "late";
    }
    if (shiftModelData.shift_type === 'alternating_late') {
      const isEvenWeek = weekNumber % 2 === 0;
      return isEvenWeek ? "late" : "early";
    }
  }
  
  // Fallback to old integer shift_model
  if (!shiftModel) return null;
  const isEvenWeek = weekNumber % 2 === 0;
  if (shiftModel === 1) {
    // Schicht 1: even weeks (2, 4, 6...) = early, odd weeks (3, 5, 7...) = late
    return isEvenWeek ? "early" : "late";
  } else {
    // Schicht 2: odd weeks (3, 5, 7...) = early, even weeks (2, 4, 6...) = late
    return isEvenWeek ? "late" : "early";
  }
};

interface SelectedCell {
  employeeId: string;
  date: string;
}

export default function ShiftPlanning() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftModels, setShiftModels] = useState<ShiftModel[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [sickDays, setSickDays] = useState<EmployeeSickDay[]>([]);
  const [vacationDays, setVacationDays] = useState<EmployeeVacationDay[]>([]);
  const [shiftOverrides, setShiftOverrides] = useState<EmployeeShiftOverride[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showSickDayDialog, setShowSickDayDialog] = useState(false);
  const [showVacationDayDialog, setShowVacationDayDialog] = useState(false);
  const [showShiftTypeDialog, setShowShiftTypeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingShiftType, setEditingShiftType] = useState<ShiftType | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeShiftModelId, setEmployeeShiftModelId] = useState<string>("none");
  const [sickDateRange, setSickDateRange] = useState<DateRange | undefined>(undefined);
  const [sickNote, setSickNote] = useState("");
  const [vacationDateRange, setVacationDateRange] = useState<DateRange | undefined>(undefined);
  const [vacationNote, setVacationNote] = useState("");
  const [overviewMonth, setOverviewMonth] = useState<Date>(new Date());
  
  // Shift Type form state
  const [shiftTypeAbbreviation, setShiftTypeAbbreviation] = useState("");
  const [shiftTypeName, setShiftTypeName] = useState("");
  const [shiftTypeColor, setShiftTypeColor] = useState("#3b82f6");
  
  // Multi-select state
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesData, shiftModelsData, shiftTypesData, sickDaysData, vacationDaysData, shiftOverridesData] = await Promise.all([
        api.getEmployees(),
        api.getShiftModels(),
        api.getShiftTypes(),
        api.getEmployeeSickDays(),
        api.getEmployeeVacationDays(),
        api.getEmployeeShiftOverrides(),
      ]);
      setEmployees(employeesData);
      setShiftModels(shiftModelsData);
      setShiftTypes(shiftTypesData);
      setSickDays(sickDaysData);
      setVacationDays(vacationDaysData);
      setShiftOverrides(shiftOverridesData);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  // Shift Type handlers
  const handleSaveShiftType = async () => {
    if (!shiftTypeAbbreviation.trim() || !shiftTypeName.trim()) {
      toast({ title: "Fehler", description: "Abkürzung und Name sind erforderlich.", variant: "destructive" });
      return;
    }

    try {
      if (editingShiftType) {
        await api.updateShiftType(editingShiftType.id, {
          abbreviation: shiftTypeAbbreviation.trim(),
          name: shiftTypeName.trim(),
          color: shiftTypeColor,
        });
        toast({ title: "Erfolg", description: "Schichtart aktualisiert." });
      } else {
        await api.createShiftType({
          abbreviation: shiftTypeAbbreviation.trim(),
          name: shiftTypeName.trim(),
          color: shiftTypeColor,
        });
        toast({ title: "Erfolg", description: "Schichtart angelegt." });
      }
      setShowShiftTypeDialog(false);
      resetShiftTypeForm();
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteShiftType = async (id: string) => {
    if (!confirm("Schichtart wirklich löschen?")) return;
    try {
      await api.deleteShiftType(id);
      toast({ title: "Erfolg", description: "Schichtart gelöscht." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const resetShiftTypeForm = () => {
    setShiftTypeAbbreviation("");
    setShiftTypeName("");
    setShiftTypeColor("#3b82f6");
    setEditingShiftType(null);
  };

  const openEditShiftTypeDialog = (st: ShiftType) => {
    setEditingShiftType(st);
    setShiftTypeAbbreviation(st.abbreviation);
    setShiftTypeName(st.name);
    setShiftTypeColor(st.color);
    setShowShiftTypeDialog(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeName.trim()) {
      toast({ title: "Fehler", description: "Name ist erforderlich.", variant: "destructive" });
      return;
    }

    const shiftModelId = employeeShiftModelId === "none" ? null : employeeShiftModelId;

    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, { name: employeeName.trim(), shift_model_id: shiftModelId });
        toast({ title: "Erfolg", description: "Mitarbeiter aktualisiert." });
      } else {
        await api.createEmployee({ name: employeeName.trim(), shift_model_id: shiftModelId });
        toast({ title: "Erfolg", description: "Mitarbeiter angelegt." });
      }
      setShowEmployeeDialog(false);
      setEmployeeName("");
      setEmployeeShiftModelId("none");
      setEditingEmployee(null);
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Mitarbeiter wirklich löschen?")) return;
    try {
      await api.deleteEmployee(id);
      if (selectedEmployee?.id === id) setSelectedEmployee(null);
      toast({ title: "Erfolg", description: "Mitarbeiter gelöscht." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };


  const handleAddSickDay = async () => {
    if (!selectedEmployee || !sickDateRange?.from) return;

    const startDate = sickDateRange.from;
    const endDate = sickDateRange.to || sickDateRange.from;
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    try {
      for (const day of days) {
        await api.createEmployeeSickDay({
          employee_id: selectedEmployee.id,
          date: format(day, "yyyy-MM-dd"),
          note: sickNote || undefined,
        });
      }
      toast({ title: "Erfolg", description: `${days.length} Krankheitstag(e) eingetragen.` });
      setShowSickDayDialog(false);
      setSickDateRange(undefined);
      setSickNote("");
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Eintragen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteSickDay = async (id: string) => {
    try {
      await api.deleteEmployeeSickDay(id);
      toast({ title: "Erfolg", description: "Krankheitstag entfernt." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleAddVacationDay = async () => {
    if (!selectedEmployee || !vacationDateRange?.from) return;

    const startDate = vacationDateRange.from;
    const endDate = vacationDateRange.to || vacationDateRange.from;
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    try {
      for (const day of days) {
        await api.createEmployeeVacationDay({
          employee_id: selectedEmployee.id,
          date: format(day, "yyyy-MM-dd"),
          note: vacationNote || undefined,
        });
      }
      toast({ title: "Erfolg", description: `${days.length} Urlaubstag(e) eingetragen.` });
      setShowVacationDayDialog(false);
      setVacationDateRange(undefined);
      setVacationNote("");
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Eintragen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteVacationDay = async (id: string) => {
    try {
      await api.deleteEmployeeVacationDay(id);
      toast({ title: "Erfolg", description: "Urlaubstag entfernt." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };


  const getEmployeeSickDays = (employeeId: string) => {
    return sickDays.filter(sd => sd.employee_id === employeeId);
  };

  const getEmployeeVacationDays = (employeeId: string) => {
    return vacationDays.filter(vd => vd.employee_id === employeeId);
  };

  // Get automatic company vacation days (Dec 24 - Jan 6)
  const getCompanyVacationDays = (): { date: string; note: string }[] => {
    const currentYear = new Date().getFullYear();
    const days: { date: string; note: string }[] = [];
    
    // Dec 24-31 of current year
    for (let day = 24; day <= 31; day++) {
      const date = new Date(currentYear, 11, day);
      if (!isWeekend(date) && !isHoliday(date)) {
        days.push({ date: format(date, "yyyy-MM-dd"), note: "Betriebsurlaub" });
      }
    }
    
    // Jan 1-6 of next year
    for (let day = 1; day <= 6; day++) {
      const date = new Date(currentYear + 1, 0, day);
      if (!isWeekend(date) && !isHoliday(date)) {
        days.push({ date: format(date, "yyyy-MM-dd"), note: "Betriebsurlaub" });
      }
    }
    
    return days;
  };


  const getShiftModelLabel = (emp: Employee) => {
    if (emp.shift_model_id) {
      const model = shiftModels.find(m => m.id === emp.shift_model_id);
      return model?.name || "Unbekannt";
    }
    if (emp.shift_model === 1) return "Schicht 1";
    if (emp.shift_model === 2) return "Schicht 2";
    return "Keine";
  };

  const getEmployeeShiftModel = (emp: Employee): ShiftModel | null => {
    if (emp.shift_model_id) {
      return shiftModels.find(m => m.id === emp.shift_model_id) || null;
    }
    return null;
  };


  // Overview data calculation
  const overviewStart = startOfMonth(overviewMonth);
  const overviewEnd = endOfMonth(overviewMonth);
  const overviewDays = eachDayOfInterval({ start: overviewStart, end: overviewEnd });

  // Bavarian holidays for the overview month
  const bavarianHolidays = useMemo(() => {
    return getBavarianHolidays(overviewMonth.getFullYear());
  }, [overviewMonth]);

  const isHoliday = (date: Date): boolean => {
    return bavarianHolidays.some(h => 
      h.getFullYear() === date.getFullYear() &&
      h.getMonth() === date.getMonth() &&
      h.getDate() === date.getDate()
    );
  };

  const isNonWorkingDay = (date: Date): boolean => {
    return isWeekend(date) || isHoliday(date);
  };

  // Betriebsurlaub: 24.12 bis 06.01 (inkl.)
  const isCompanyVacation = (date: Date): boolean => {
    const month = date.getMonth(); // 0-indexed: 11 = December, 0 = January
    const day = date.getDate();
    
    // December 24-31
    if (month === 11 && day >= 24) return true;
    // January 1-6
    if (month === 0 && day <= 6) return true;
    
    return false;
  };

  const getStatusForDay = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const isSick = sickDays.some(sd => sd.employee_id === employeeId && sd.date === dateStr);
    const isVacationManual = vacationDays.some(vd => vd.employee_id === employeeId && vd.date === dateStr);
    const isVacationAuto = isCompanyVacation(date) && !isHoliday(date); // Auto vacation only if NOT a holiday
    const isVacation = isVacationManual || isVacationAuto;
    const override = shiftOverrides.find(so => so.employee_id === employeeId && so.date === dateStr);
    return { isSick, isVacation, isVacationManual, isVacationAuto, override };
  };

  const getEffectiveShiftType = (employeeId: string, date: Date, defaultShiftModel: number | null, shiftModelData?: ShiftModel | null): "early" | "late" | "fixed" | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const override = shiftOverrides.find(so => so.employee_id === employeeId && so.date === dateStr);
    
    if (override) {
      return override.shift_type === 'F' ? 'early' : 'late';
    }
    
    const weekNum = getISOWeek(date);
    return getShiftTypeForWeek(defaultShiftModel, weekNum, shiftModelData);
  };

  // Helper to get shift type color and styles from configured shiftTypes
  const getShiftTypeStyle = (abbreviation: string): { backgroundColor: string; color: string } => {
    const shiftType = shiftTypes.find(st => st.abbreviation === abbreviation);
    if (shiftType) {
      return {
        backgroundColor: shiftType.color,
        color: '#ffffff',
      };
    }
    // Fallback colors - solid background with white text
    const fallbacks: Record<string, { backgroundColor: string; color: string }> = {
      'F': { backgroundColor: '#3b82f6', color: '#ffffff' },
      'S': { backgroundColor: '#f97316', color: '#ffffff' },
      'K': { backgroundColor: '#ef4444', color: '#ffffff' },
      'U': { backgroundColor: '#16a34a', color: '#ffffff' },
      'FT': { backgroundColor: '#dc2626', color: '#ffffff' },
      'No': { backgroundColor: '#6b7280', color: '#ffffff' },
    };
    return fallbacks[abbreviation] || { backgroundColor: '#6b7280', color: '#ffffff' };
  };

  const getShiftTypeName = (abbreviation: string): string => {
    const shiftType = shiftTypes.find(st => st.abbreviation === abbreviation);
    return shiftType?.name || abbreviation;
  };

  const handleShiftClick = async (employeeId: string, date: Date, currentShiftType: "early" | "late" | "fixed" | null) => {
    if (!currentShiftType) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const newShiftType = currentShiftType === 'early' ? 'S' : 'F';
    
    // Check if this is reverting to default
    const weekNum = getISOWeek(date);
    const employee = employees.find(e => e.id === employeeId);
    const defaultShiftType = getShiftTypeForWeek(employee?.shift_model || null, weekNum);
    const existingOverride = shiftOverrides.find(so => so.employee_id === employeeId && so.date === dateStr);
    
    try {
      if (existingOverride && ((newShiftType === 'F' && defaultShiftType === 'early') || (newShiftType === 'S' && defaultShiftType === 'late'))) {
        // Remove override if switching back to default
        await api.deleteEmployeeShiftOverride(employeeId, dateStr);
      } else {
        // Create/update override
        await api.upsertEmployeeShiftOverride({
          employee_id: employeeId,
          date: dateStr,
          shift_type: newShiftType,
        });
      }
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Schicht konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleCellMouseDown = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setIsSelecting(true);
    // Toggle selection: remove if already selected, add if not
    setSelectedCells(prev => {
      const exists = prev.some(c => c.employeeId === employeeId && c.date === dateStr);
      if (exists) {
        return prev.filter(c => !(c.employeeId === employeeId && c.date === dateStr));
      }
      return [...prev, { employeeId, date: dateStr }];
    });
  };

  const handleCellMouseEnter = (employeeId: string, date: Date) => {
    if (!isSelecting) return;
    const dateStr = format(date, "yyyy-MM-dd");
    
    setSelectedCells(prev => {
      const exists = prev.some(c => c.employeeId === employeeId && c.date === dateStr);
      if (exists) return prev;
      return [...prev, { employeeId, date: dateStr }];
    });
  };

  const justFinishedSelectingRef = useRef(false);

  const handleCellMouseUp = () => {
    if (isSelecting && selectedCells.length > 0) {
      justFinishedSelectingRef.current = true;
      // Reset the flag after a short delay to allow click event to check it
      setTimeout(() => {
        justFinishedSelectingRef.current = false;
      }, 100);
    }
    setIsSelecting(false);
  };

  const handleTableClick = (e: React.MouseEvent) => {
    // Skip if we just finished selecting
    if (justFinishedSelectingRef.current) return;
    
    // If clicking on something that's not a shift cell, clear selection
    const target = e.target as HTMLElement;
    const isShiftCell = target.closest('[data-shift-cell="true"]');
    if (!isShiftCell && selectedCells.length > 0) {
      setSelectedCells([]);
    }
  };

  const handleApplyShiftToSelected = async (shiftType: 'F' | 'S') => {
    if (selectedCells.length === 0) return;

    try {
      for (const cell of selectedCells) {
        // Wenn wir eine Schicht setzen, soll der Tag kein Urlaub/Krank mehr sein.
        const existingSick = sickDays.find(s => s.employee_id === cell.employeeId && s.date === cell.date);
        const existingVacation = vacationDays.find(v => v.employee_id === cell.employeeId && v.date === cell.date);
        if (existingSick) await api.deleteEmployeeSickDay(existingSick.id);
        if (existingVacation) await api.deleteEmployeeVacationDay(existingVacation.id);

        const employee = employees.find(e => e.id === cell.employeeId);
        const weekNum = getISOWeek(parseISO(cell.date));
        const defaultShiftType = getShiftTypeForWeek(employee?.shift_model || null, weekNum);

        // Check if this matches the default
        const isDefaultShift = (shiftType === 'F' && defaultShiftType === 'early') ||
          (shiftType === 'S' && defaultShiftType === 'late');
        const existingOverride = shiftOverrides.find(so => so.employee_id === cell.employeeId && so.date === cell.date);

        if (isDefaultShift && existingOverride) {
          await api.deleteEmployeeShiftOverride(cell.employeeId, cell.date);
        } else if (!isDefaultShift) {
          await api.upsertEmployeeShiftOverride({
            employee_id: cell.employeeId,
            date: cell.date,
            shift_type: shiftType,
          });
        }
      }

      toast({
        title: "Erfolg",
        description: `${selectedCells.length} Schicht(en) auf ${shiftType === 'F' ? 'Frühschicht' : 'Spätschicht'} gesetzt.`,
      });
      setSelectedCells([]);
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Schichten konnten nicht geändert werden.", variant: "destructive" });
    }
  };

  const clearSelection = () => {
    setSelectedCells([]);
  };

  const handleApplyAbsenceToSelected = async (type: 'sick' | 'vacation') => {
    if (selectedCells.length === 0) return;
    
    try {
      for (const cell of selectedCells) {
        // Check if this cell already has the same absence type
        const existingSick = sickDays.find(s => s.employee_id === cell.employeeId && s.date === cell.date);
        const existingVacation = vacationDays.find(v => v.employee_id === cell.employeeId && v.date === cell.date);
        
        if (type === 'sick') {
          // If already sick, remove it (toggle)
          if (existingSick) {
            await api.deleteEmployeeSickDay(existingSick.id);
          } else {
            // Remove vacation if exists, then add sick
            if (existingVacation) {
              await api.deleteEmployeeVacationDay(existingVacation.id);
            }
            await api.createEmployeeSickDay({
              employee_id: cell.employeeId,
              date: cell.date,
              note: null,
            });
          }
        } else {
          // If already vacation, remove it (toggle)
          if (existingVacation) {
            await api.deleteEmployeeVacationDay(existingVacation.id);
          } else {
            // Remove sick if exists, then add vacation
            if (existingSick) {
              await api.deleteEmployeeSickDay(existingSick.id);
            }
            await api.createEmployeeVacationDay({
              employee_id: cell.employeeId,
              date: cell.date,
              note: null,
            });
          }
        }
      }
      
      toast({ 
        title: "Erfolg", 
        description: `${selectedCells.length} Tag(e) geändert.` 
      });
      setSelectedCells([]);
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Eintragen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const isCellSelected = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return selectedCells.some(c => c.employeeId === employeeId && c.date === dateStr);
  };

  const getDayStatsForGroup = (date: Date, employeeIds: string[]) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const sickCount = sickDays.filter(sd => sd.date === dateStr && employeeIds.includes(sd.employee_id)).length;
    const vacationCount = vacationDays.filter(vd => vd.date === dateStr && employeeIds.includes(vd.employee_id)).length;
    return { sickCount, vacationCount };
  };

  // Group employees by shift model
  const shift1Employees = employees.filter(e => e.shift_model === 1);
  const shift2Employees = employees.filter(e => e.shift_model === 2);
  const noShiftEmployees = employees.filter(e => !e.shift_model);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <h1 className="text-2xl font-bold truncate">Schichtplanung</h1>
        <Button
          onClick={() => {
            setEditingEmployee(null);
            setEmployeeName("");
            setEmployeeShiftModelId("none");
            setShowEmployeeDialog(true);
          }}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Mitarbeiter anlegen
        </Button>
      </div>

      <Tabs defaultValue="employees" className="w-full min-w-0">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mitarbeiter
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="machine-assignment" className="flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Maschinenzuordnung
          </TabsTrigger>
          <TabsTrigger value="shift-types" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Schichtarten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Employee List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Mitarbeiter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {employees.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Keine Mitarbeiter vorhanden.</p>
                ) : (
                  employees.map((emp) => {
                    const currentWeek = getISOWeek(new Date());
                    const empShiftModel = getEmployeeShiftModel(emp);
                    const shiftType = getShiftTypeForWeek(emp.shift_model, currentWeek, empShiftModel);
                    return (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                          selectedEmployee?.id === emp.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        )}
                        onClick={() => setSelectedEmployee(emp)}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{emp.name}</span>
                            {(emp.shift_model || emp.shift_model_id) && (
                              <Badge variant={selectedEmployee?.id === emp.id ? "secondary" : "outline"} className="text-xs">
                                {getShiftModelLabel(emp)}
                              </Badge>
                            )}
                          </div>
                          {shiftType && shiftType !== "fixed" && (
                            <span className={cn("text-xs", selectedEmployee?.id === emp.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                              Diese Woche: {shiftType === "early" ? "Frühschicht" : "Spätschicht"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEmployee(emp);
                              setEmployeeName(emp.name);
                              setEmployeeShiftModelId(emp.shift_model_id || "none");
                              setShowEmployeeDialog(true);
                            }}
                          >
                            ✏️
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmployee(emp.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Shift Assignment */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedEmployee ? `Details für ${selectedEmployee.name}` : "Mitarbeiter auswählen"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedEmployee ? (
                  <p className="text-muted-foreground">Wählen Sie links einen Mitarbeiter aus.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Shift Model Info */}
                    {(selectedEmployee.shift_model || selectedEmployee.shift_model_id) && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">Schichtenmodell: {getShiftModelLabel(selectedEmployee)}</p>
                        {(() => {
                          const model = getEmployeeShiftModel(selectedEmployee);
                          if (model?.shift_type === 'fixed') {
                            return <p className="text-sm text-muted-foreground mt-1">Feste Schicht ohne Wechsel</p>;
                          }
                          return (
                            <p className="text-sm text-muted-foreground mt-1">
                              {(model?.shift_type === 'alternating_early' || selectedEmployee.shift_model === 1)
                                ? "Gerade Wochen: Frühschicht, Ungerade Wochen: Spätschicht"
                                : "Gerade Wochen: Spätschicht, Ungerade Wochen: Frühschicht"}
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    {/* Sick Days Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          Krankheitstage
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setShowSickDayDialog(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Krank eintragen
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getEmployeeSickDays(selectedEmployee.id).length === 0 ? (
                          <span className="text-sm text-muted-foreground">Keine Krankheitstage eingetragen.</span>
                        ) : (
                          getEmployeeSickDays(selectedEmployee.id).map((sd) => (
                            <Badge key={sd.id} variant="destructive" className="flex items-center gap-1">
                              {format(parseISO(sd.date), "dd.MM.yyyy", { locale: de })}
                              {sd.note && <span className="ml-1">({sd.note})</span>}
                              <button
                                className="ml-1 hover:bg-destructive-foreground/20 rounded-full p-0.5"
                                onClick={() => handleDeleteSickDay(sd.id)}
                              >
                                ✕
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Vacation Days Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Palmtree className="h-4 w-4 text-green-600" />
                          Urlaubstage
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setShowVacationDayDialog(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Urlaub eintragen
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {/* Manual vacation days */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Manuell eingetragen:</p>
                          <div className="flex flex-wrap gap-2">
                            {getEmployeeVacationDays(selectedEmployee.id).length === 0 ? (
                              <span className="text-sm text-muted-foreground">Keine manuellen Urlaubstage.</span>
                            ) : (
                              getEmployeeVacationDays(selectedEmployee.id).map((vd) => (
                                <Badge key={vd.id} className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                                  {format(parseISO(vd.date), "dd.MM.yyyy", { locale: de })}
                                  {vd.note && <span className="ml-1">({vd.note})</span>}
                                  <button
                                    className="ml-1 hover:bg-green-800/50 rounded-full p-0.5"
                                    onClick={() => handleDeleteVacationDay(vd.id)}
                                  >
                                    ✕
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                        
                        {/* Automatic company vacation */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Betriebsurlaub (24.12. - 06.01.):</p>
                          <div className="flex flex-wrap gap-2">
                            {getCompanyVacationDays().map((vd) => (
                              <Badge key={vd.date} variant="outline" className="flex items-center gap-1 border-green-600 text-green-700 dark:text-green-400">
                                {format(parseISO(vd.date), "dd.MM.yyyy", { locale: de })}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-4 min-w-0">
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center min-w-0">
                <CardTitle className="sm:flex-1 min-w-0">Mitarbeiter-Übersicht</CardTitle>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOverviewMonth((prev) => addWeeks(prev, -4))}
                  >
                    ← Vorheriger Monat
                  </Button>
                  <span className="font-medium min-w-[120px] text-center">
                    {format(overviewMonth, "MMMM yyyy", { locale: de })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOverviewMonth((prev) => addWeeks(prev, 4))}
                  >
                    Nächster Monat →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0">
              <div 
                className="max-w-full overflow-x-auto pb-2 select-none"
                onMouseUp={handleCellMouseUp}
                onMouseLeave={handleCellMouseUp}
                onClick={handleTableClick}
              >
                <table className="w-max min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sticky left-0 bg-background min-w-[150px]">Mitarbeiter</th>
                      {overviewDays.map(day => {
                        const holiday = isHoliday(day);
                        const weekend = isWeekend(day);
                        const nonWorking = holiday || weekend;
                        return (
                          <th 
                            key={day.toISOString()} 
                            className={cn(
                              "p-1 text-center min-w-[40px]",
                              holiday && "bg-red-100 dark:bg-red-950/50",
                              weekend && !holiday && "bg-gray-100 dark:bg-gray-800/50"
                            )}
                            title={holiday ? "Feiertag" : weekend ? "Wochenende" : undefined}
                          >
                            <div className={cn(
                              "text-xs",
                              nonWorking ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                            )}>
                              {format(day, "EEE", { locale: de })}
                            </div>
                            <div className={cn(nonWorking && "text-red-600 dark:text-red-400")}>
                              {format(day, "d")}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Schicht 1 Group */}
                    {shift1Employees.length > 0 && (
                      <>
                        <tr className="bg-blue-50 dark:bg-blue-950/30">
                          <td colSpan={overviewDays.length + 1} className="p-2 font-semibold sticky left-0 bg-blue-50 dark:bg-blue-950/30">
                            Schicht 1
                          </td>
                        </tr>
                        {shift1Employees.map(emp => (
                          <tr key={emp.id} className="border-b">
                            <td className="p-2 sticky left-0 bg-background font-medium">
                              <div className="flex items-center gap-2">
                                {emp.name}
                              </div>
                            </td>
                            {overviewDays.map(day => {
                              const { isSick, isVacation, override } = getStatusForDay(emp.id, day);
                              const shiftType = getEffectiveShiftType(emp.id, day, emp.shift_model);
                              const hasOverride = !!override;
                              const isSelected = isCellSelected(emp.id, day);
                              const holiday = isHoliday(day);
                              const weekend = isWeekend(day);
                              
                              return (
                                <td 
                                  key={day.toISOString()} 
                                  className={cn(
                                    "p-1 text-center",
                                    holiday && "bg-red-100 dark:bg-red-950/50",
                                    weekend && !holiday && "bg-gray-100 dark:bg-gray-800/50"
                                  )}
                                >
                                  {weekend ? (
                                    <div className="w-6 h-6 mx-auto" />
                                  ) : isSick ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('K')}
                                      title={getShiftTypeName('K')}
                                    >
                                      K
                                    </div>
                                  ) : isVacation ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('U')}
                                      title={getShiftTypeName('U')}
                                    >
                                      U
                                    </div>
                                  ) : holiday ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('FT')}
                                      title={getShiftTypeName('FT')}
                                    >
                                      FT
                                    </div>
                                  ) : shiftType ? (
                                    (() => {
                                      const abbr = shiftType === "early" ? "F" : "S";
                                      return (
                                        <div 
                                          data-shift-cell="true"
                                          onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                          onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                          className={cn(
                                            "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                            hasOverride && "ring-1 ring-primary",
                                            isSelected && "ring-2 ring-primary bg-primary/20"
                                          )}
                                          style={!isSelected ? getShiftTypeStyle(abbr) : undefined}
                                          title={`${getShiftTypeName(abbr)}${hasOverride ? " (geändert)" : ""} - Halten und ziehen zum Auswählen`}
                                        >
                                          {abbr}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="w-6 h-6 mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-blue-100/50 dark:bg-blue-900/30 font-medium">
                          <td className="p-2 sticky left-0 bg-blue-100/50 dark:bg-blue-900/30 text-sm">Zusammenfassung S1</td>
                          {overviewDays.map(day => {
                            const { sickCount, vacationCount } = getDayStatsForGroup(day, shift1Employees.map(e => e.id));
                            return (
                              <td key={day.toISOString()} className="p-1 text-center text-xs">
                                {(sickCount > 0 || vacationCount > 0) && (
                                  <div className="flex flex-col gap-0.5">
                                    {sickCount > 0 && <span className="text-destructive">{sickCount}K</span>}
                                    {vacationCount > 0 && <span className="text-green-600">{vacationCount}U</span>}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </>
                    )}

                    {/* Schicht 2 Group */}
                    {shift2Employees.length > 0 && (
                      <>
                        <tr className="bg-orange-50 dark:bg-orange-950/30">
                          <td colSpan={overviewDays.length + 1} className="p-2 font-semibold sticky left-0 bg-orange-50 dark:bg-orange-950/30">
                            Schicht 2
                          </td>
                        </tr>
                        {shift2Employees.map(emp => (
                          <tr key={emp.id} className="border-b">
                            <td className="p-2 sticky left-0 bg-background font-medium">
                              <div className="flex items-center gap-2">
                                {emp.name}
                              </div>
                            </td>
                            {overviewDays.map(day => {
                              const { isSick, isVacation, override } = getStatusForDay(emp.id, day);
                              const shiftType = getEffectiveShiftType(emp.id, day, emp.shift_model);
                              const hasOverride = !!override;
                              const isSelected = isCellSelected(emp.id, day);
                              const holiday = isHoliday(day);
                              const weekend = isWeekend(day);
                              
                              return (
                                <td 
                                  key={day.toISOString()} 
                                  className={cn(
                                    "p-1 text-center",
                                    holiday && "bg-red-100 dark:bg-red-950/50",
                                    weekend && !holiday && "bg-gray-100 dark:bg-gray-800/50"
                                  )}
                                >
                                  {weekend ? (
                                    <div className="w-6 h-6 mx-auto" />
                                  ) : isSick ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('K')}
                                      title={getShiftTypeName('K')}
                                    >
                                      K
                                    </div>
                                  ) : isVacation ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('U')}
                                      title={getShiftTypeName('U')}
                                    >
                                      U
                                    </div>
                                  ) : holiday ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('FT')}
                                      title={getShiftTypeName('FT')}
                                    >
                                      FT
                                    </div>
                                  ) : shiftType ? (
                                    (() => {
                                      const abbr = shiftType === "early" ? "F" : "S";
                                      return (
                                        <div 
                                          data-shift-cell="true"
                                          onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                          onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                          className={cn(
                                            "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                            hasOverride && "ring-1 ring-primary",
                                            isSelected && "ring-2 ring-primary bg-primary/20"
                                          )}
                                          style={!isSelected ? getShiftTypeStyle(abbr) : undefined}
                                          title={`${getShiftTypeName(abbr)}${hasOverride ? " (geändert)" : ""} - Halten und ziehen zum Auswählen`}
                                        >
                                          {abbr}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="w-6 h-6 mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-orange-100/50 dark:bg-orange-900/30 font-medium">
                          <td className="p-2 sticky left-0 bg-orange-100/50 dark:bg-orange-900/30 text-sm">Zusammenfassung S2</td>
                          {overviewDays.map(day => {
                            const { sickCount, vacationCount } = getDayStatsForGroup(day, shift2Employees.map(e => e.id));
                            return (
                              <td key={day.toISOString()} className="p-1 text-center text-xs">
                                {(sickCount > 0 || vacationCount > 0) && (
                                  <div className="flex flex-col gap-0.5">
                                    {sickCount > 0 && <span className="text-destructive">{sickCount}K</span>}
                                    {vacationCount > 0 && <span className="text-green-600">{vacationCount}U</span>}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </>
                    )}

                    {/* Normalschicht (employees without alternating shift model) */}
                    {noShiftEmployees.length > 0 && (
                      <>
                        <tr className="bg-gray-50 dark:bg-gray-950/30">
                          <td colSpan={overviewDays.length + 1} className="p-2 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-950/30">
                            Normalschicht
                          </td>
                        </tr>
                        {noShiftEmployees.map(emp => (
                          <tr key={emp.id} className="border-b">
                            <td className="p-2 sticky left-0 bg-background font-medium">
                              <div className="flex items-center gap-2">
                                {emp.name}
                              </div>
                            </td>
                            {overviewDays.map(day => {
                              const { isSick, isVacation, override } = getStatusForDay(emp.id, day);
                              const hasOverride = !!override;
                              const overrideShiftType = override?.shift_type === 'F' ? 'early' : override?.shift_type === 'S' ? 'late' : null;
                              const isSelected = isCellSelected(emp.id, day);
                              const holiday = isHoliday(day);
                              const weekend = isWeekend(day);
                              
                              return (
                                <td 
                                  key={day.toISOString()} 
                                  className={cn(
                                    "p-1 text-center",
                                    holiday && "bg-red-100 dark:bg-red-950/50",
                                    weekend && !holiday && "bg-gray-100 dark:bg-gray-800/50"
                                  )}
                                >
                                  {weekend ? (
                                    <div className="w-6 h-6 mx-auto" />
                                  ) : isSick ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('K')}
                                      title={getShiftTypeName('K')}
                                    >
                                      K
                                    </div>
                                  ) : isVacation ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('U')}
                                      title={getShiftTypeName('U')}
                                    >
                                      U
                                    </div>
                                  ) : holiday ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('FT')}
                                      title={getShiftTypeName('FT')}
                                    >
                                      FT
                                    </div>
                                  ) : hasOverride && overrideShiftType ? (
                                    (() => {
                                      const abbr = overrideShiftType === "early" ? "F" : "S";
                                      return (
                                        <div 
                                          data-shift-cell="true"
                                          onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                          onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                          className={cn(
                                            "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                            "ring-1 ring-primary",
                                            isSelected && "ring-2 ring-primary bg-primary/20"
                                          )}
                                          style={!isSelected ? getShiftTypeStyle(abbr) : undefined}
                                          title={`${getShiftTypeName(abbr)} (manuell gesetzt) - Halten und ziehen zum Auswählen`}
                                        >
                                          {abbr}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      style={getShiftTypeStyle('No')}
                                      title={getShiftTypeName('No')}
                                    >
                                      No
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-gray-100/50 dark:bg-gray-900/30 font-medium">
                          <td className="p-2 sticky left-0 bg-gray-100/50 dark:bg-gray-900/30 text-sm">Zusammenfassung No</td>
                          {overviewDays.map(day => {
                            const { sickCount, vacationCount } = getDayStatsForGroup(day, noShiftEmployees.map(e => e.id));
                            return (
                              <td key={day.toISOString()} className="p-1 text-center text-xs">
                                {(sickCount > 0 || vacationCount > 0) && (
                                  <div className="flex flex-col gap-0.5">
                                    {sickCount > 0 && <span className="text-destructive">{sickCount}K</span>}
                                    {vacationCount > 0 && <span className="text-green-600">{vacationCount}U</span>}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {shiftTypes.map(st => (
                  <div key={st.id} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: st.color }}
                    />
                    <span>{st.abbreviation} = {st.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded ring-1 ring-primary" style={getShiftTypeStyle('F')} />
                  <span>= Manuell geändert</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"></div>
                  <span>= Wochenende</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tipp: Halten und ziehen Sie über mehrere Zellen, um sie auszuwählen. Dann unten Schichttyp wählen.
              </p>
              
              {/* Selection Action Bar */}
              {selectedCells.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">
                    {selectedCells.length} Zelle(n) ausgewählt
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => handleApplyShiftToSelected('F')}
                    >
                      Frühschicht
                    </Button>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => handleApplyShiftToSelected('S')}
                    >
                      Spätschicht
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApplyAbsenceToSelected('vacation')}
                    >
                      Urlaub
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => handleApplyAbsenceToSelected('sick')}
                    >
                      Krank
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machine-assignment" className="mt-4 min-w-0">
          <MachineAssignmentTab />
        </TabsContent>

        <TabsContent value="shift-types" className="mt-4 min-w-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Schichtarten verwalten
                </CardTitle>
                <Button
                  onClick={() => {
                    resetShiftTypeForm();
                    setShowShiftTypeDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Schichtart
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shiftTypes.length === 0 ? (
                  <p className="text-muted-foreground col-span-full">Keine Schichtarten vorhanden.</p>
                ) : (
                  shiftTypes.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: st.color }}
                        >
                          {st.abbreviation}
                        </div>
                        <div>
                          <p className="font-medium">{st.name}</p>
                          <p className="text-xs text-muted-foreground">Abkürzung: {st.abbreviation}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditShiftTypeDialog(st)}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteShiftType(st.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Name des Mitarbeiters"
              />
            </div>
            <div>
              <Label>Schichtenmodell</Label>
              <Select value={employeeShiftModelId} onValueChange={setEmployeeShiftModelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Schichtenmodell wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Modell</SelectItem>
                  {shiftModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                      {model.description && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({model.shift_type === 'fixed' ? 'fest' : 'wechselnd'})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Wählen Sie ein Schichtmodell. Neue Modelle werden automatisch aus der Schichtzuordnung erstellt.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveEmployee}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sick Day Dialog */}
      <Dialog open={showSickDayDialog} onOpenChange={setShowSickDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Krankheitstage eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Zeitraum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {sickDateRange?.from ? (
                      sickDateRange.to ? (
                        <>
                          {format(sickDateRange.from, "dd.MM.yyyy", { locale: de })} - {format(sickDateRange.to, "dd.MM.yyyy", { locale: de })}
                        </>
                      ) : (
                        format(sickDateRange.from, "dd.MM.yyyy", { locale: de })
                      )
                    ) : (
                      "Zeitraum wählen"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={sickDateRange}
                    onSelect={setSickDateRange}
                    locale={de}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Klicken Sie auf ein Startdatum und dann auf ein Enddatum
              </p>
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Input
                value={sickNote}
                onChange={(e) => setSickNote(e.target.value)}
                placeholder="z.B. Erkältung"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSickDayDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddSickDay} disabled={!sickDateRange?.from}>
              Eintragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vacation Day Dialog */}
      <Dialog open={showVacationDayDialog} onOpenChange={setShowVacationDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Urlaubstage eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Zeitraum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {vacationDateRange?.from ? (
                      vacationDateRange.to ? (
                        <>
                          {format(vacationDateRange.from, "dd.MM.yyyy", { locale: de })} - {format(vacationDateRange.to, "dd.MM.yyyy", { locale: de })}
                        </>
                      ) : (
                        format(vacationDateRange.from, "dd.MM.yyyy", { locale: de })
                      )
                    ) : (
                      "Zeitraum wählen"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={vacationDateRange}
                    onSelect={setVacationDateRange}
                    locale={de}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Klicken Sie auf ein Startdatum und dann auf ein Enddatum
              </p>
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Input
                value={vacationNote}
                onChange={(e) => setVacationNote(e.target.value)}
                placeholder="z.B. Sommerurlaub"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVacationDayDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddVacationDay} disabled={!vacationDateRange?.from}>
              Eintragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Type Dialog */}
      <Dialog open={showShiftTypeDialog} onOpenChange={(open) => {
        setShowShiftTypeDialog(open);
        if (!open) resetShiftTypeForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShiftType ? "Schichtart bearbeiten" : "Neue Schichtart"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Abkürzung</Label>
              <Input
                value={shiftTypeAbbreviation}
                onChange={(e) => setShiftTypeAbbreviation(e.target.value)}
                placeholder="z.B. F, S, No, N"
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kurze Abkürzung für die Anzeige (max. 5 Zeichen)
              </p>
            </div>
            <div>
              <Label>Name (ausgeschrieben)</Label>
              <Input
                value={shiftTypeName}
                onChange={(e) => setShiftTypeName(e.target.value)}
                placeholder="z.B. Frühschicht, Spätschicht, Nachtschicht"
              />
            </div>
            <div>
              <Label>Farbe</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={shiftTypeColor}
                  onChange={(e) => setShiftTypeColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={shiftTypeColor}
                  onChange={(e) => setShiftTypeColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="w-28 font-mono"
                />
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: shiftTypeColor }}
                >
                  {shiftTypeAbbreviation || "?"}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowShiftTypeDialog(false);
              resetShiftTypeForm();
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveShiftType} disabled={!shiftTypeAbbreviation.trim() || !shiftTypeName.trim()}>
              {editingShiftType ? "Speichern" : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
