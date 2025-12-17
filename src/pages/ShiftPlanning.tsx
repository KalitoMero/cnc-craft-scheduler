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
import { Plus, Trash2, UserPlus, CalendarDays, AlertCircle, Users, Palmtree, LayoutGrid, Cog } from "lucide-react";
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

interface EmployeeShiftOverride {
  id: string;
  employee_id: string;
  date: string;
  shift_type: string;
}

const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// Helper to determine if an employee has early or late shift in a given week
// Schicht 1: starts with early shift in week 2 (even weeks = early)
// Schicht 2: starts with early shift in week 3 (odd weeks = early)
const getShiftTypeForWeek = (shiftModel: number | null, weekNumber: number): "early" | "late" | null => {
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
  const [sickDays, setSickDays] = useState<EmployeeSickDay[]>([]);
  const [vacationDays, setVacationDays] = useState<EmployeeVacationDay[]>([]);
  const [shiftOverrides, setShiftOverrides] = useState<EmployeeShiftOverride[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showSickDayDialog, setShowSickDayDialog] = useState(false);
  const [showVacationDayDialog, setShowVacationDayDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeShiftModel, setEmployeeShiftModel] = useState<string>("none");
  const [sickDateRange, setSickDateRange] = useState<DateRange | undefined>(undefined);
  const [sickNote, setSickNote] = useState("");
  const [vacationDateRange, setVacationDateRange] = useState<DateRange | undefined>(undefined);
  const [vacationNote, setVacationNote] = useState("");
  const [overviewMonth, setOverviewMonth] = useState<Date>(new Date());
  
  // Multi-select state
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesData, sickDaysData, vacationDaysData, shiftOverridesData] = await Promise.all([
        api.getEmployees(),
        api.getEmployeeSickDays(),
        api.getEmployeeVacationDays(),
        api.getEmployeeShiftOverrides(),
      ]);
      setEmployees(employeesData);
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

  const handleSaveEmployee = async () => {
    if (!employeeName.trim()) {
      toast({ title: "Fehler", description: "Name ist erforderlich.", variant: "destructive" });
      return;
    }

    const shiftModelValue = employeeShiftModel === "none" ? null : parseInt(employeeShiftModel);

    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, { name: employeeName.trim(), shift_model: shiftModelValue });
        toast({ title: "Erfolg", description: "Mitarbeiter aktualisiert." });
      } else {
        await api.createEmployee({ name: employeeName.trim(), shift_model: shiftModelValue });
        toast({ title: "Erfolg", description: "Mitarbeiter angelegt." });
      }
      setShowEmployeeDialog(false);
      setEmployeeName("");
      setEmployeeShiftModel("none");
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


  const getShiftModelLabel = (model: number | null) => {
    if (model === 1) return "Schicht 1";
    if (model === 2) return "Schicht 2";
    return "Keine";
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
    const isVacationAuto = isCompanyVacation(date);
    const isVacation = isVacationManual || isVacationAuto;
    const override = shiftOverrides.find(so => so.employee_id === employeeId && so.date === dateStr);
    return { isSick, isVacation, isVacationAuto, override };
  };

  const getEffectiveShiftType = (employeeId: string, date: Date, defaultShiftModel: number | null): "early" | "late" | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const override = shiftOverrides.find(so => so.employee_id === employeeId && so.date === dateStr);
    
    if (override) {
      return override.shift_type === 'F' ? 'early' : 'late';
    }
    
    const weekNum = getISOWeek(date);
    return getShiftTypeForWeek(defaultShiftModel, weekNum);
  };

  const handleShiftClick = async (employeeId: string, date: Date, currentShiftType: "early" | "late" | null) => {
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
            setEmployeeShiftModel("none");
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
                    const shiftType = getShiftTypeForWeek(emp.shift_model, currentWeek);
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
                            {emp.shift_model && (
                              <Badge variant={selectedEmployee?.id === emp.id ? "secondary" : "outline"} className="text-xs">
                                {getShiftModelLabel(emp.shift_model)}
                              </Badge>
                            )}
                          </div>
                          {shiftType && (
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
                              setEmployeeShiftModel(emp.shift_model?.toString() || "none");
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
                    {selectedEmployee.shift_model && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">Schichtenmodell: {getShiftModelLabel(selectedEmployee.shift_model)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedEmployee.shift_model === 1 
                            ? "Ungerade Wochen: Frühschicht, Gerade Wochen: Spätschicht"
                            : "Ungerade Wochen: Spätschicht, Gerade Wochen: Frühschicht"}
                        </p>
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
                      <div className="flex flex-wrap gap-2">
                        {getEmployeeVacationDays(selectedEmployee.id).length === 0 ? (
                          <span className="text-sm text-muted-foreground">Keine Urlaubstage eingetragen.</span>
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
                                  {isSick ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded bg-destructive text-destructive-foreground text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      title="Krank"
                                    >
                                      K
                                    </div>
                                  ) : isVacation ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded bg-green-600 text-white text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      title="Urlaub"
                                    >
                                      U
                                    </div>
                                  ) : holiday ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      title="Feiertag - Klicken zum Bearbeiten"
                                    >
                                      FT
                                    </div>
                                  ) : shiftType ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        shiftType === "early" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800",
                                        hasOverride && "ring-1 ring-primary",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )} 
                                      title={`${shiftType === "early" ? "Frühschicht" : "Spätschicht"}${hasOverride ? " (geändert)" : ""} - Halten und ziehen zum Auswählen`}
                                    >
                                      {shiftType === "early" ? "F" : "S"}
                                    </div>
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
                                  {isSick ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded bg-destructive text-destructive-foreground text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      title="Krank"
                                    >
                                      K
                                    </div>
                                  ) : isVacation ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded bg-green-600 text-white text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      title="Urlaub"
                                    >
                                      U
                                    </div>
                                  ) : holiday ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )}
                                      title="Feiertag - Klicken zum Bearbeiten"
                                    >
                                      FT
                                    </div>
                                  ) : shiftType ? (
                                    <div 
                                      data-shift-cell="true"
                                      onMouseDown={() => handleCellMouseDown(emp.id, day)}
                                      onMouseEnter={() => handleCellMouseEnter(emp.id, day)}
                                      className={cn(
                                        "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                                        shiftType === "early" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800",
                                        hasOverride && "ring-1 ring-primary",
                                        isSelected && "ring-2 ring-primary bg-primary/20"
                                      )} 
                                      title={`${shiftType === "early" ? "Frühschicht" : "Spätschicht"}${hasOverride ? " (geändert)" : ""} - Halten und ziehen zum Auswählen`}
                                    >
                                      {shiftType === "early" ? "F" : "S"}
                                    </div>
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

                    {/* Employees without shift model */}
                    {noShiftEmployees.length > 0 && (
                      <>
                        <tr className="bg-muted/50">
                          <td colSpan={overviewDays.length + 1} className="p-2 font-semibold sticky left-0 bg-muted/50">
                            Ohne Schichtmodell
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
                              const { isSick, isVacation } = getStatusForDay(emp.id, day);
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
                                  {isSick ? (
                                    <div className="w-6 h-6 mx-auto rounded bg-destructive text-destructive-foreground text-xs flex items-center justify-center" title="Krank">
                                      K
                                    </div>
                                  ) : isVacation ? (
                                    <div className="w-6 h-6 mx-auto rounded bg-green-600 text-white text-xs flex items-center justify-center" title="Urlaub">
                                      U
                                    </div>
                                  ) : holiday ? (
                                    <div className="w-6 h-6 mx-auto rounded bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs flex items-center justify-center" title="Feiertag">
                                      FT
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-destructive"></div>
                  <span>K = Krank</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-600"></div>
                  <span>U = Urlaub (24.12-06.01 automatisch)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100"></div>
                  <span>F = Frühschicht</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-100"></div>
                  <span>S = Spätschicht</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100 ring-1 ring-primary"></div>
                  <span>= Manuell geändert</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-900"></div>
                  <span>FT = Feiertag</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900"></div>
                  <span>= Feiertag</span>
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
              <Select value={employeeShiftModel} onValueChange={setEmployeeShiftModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Schichtenmodell wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Modell</SelectItem>
                  <SelectItem value="1">Schicht 1 (KW1: Früh, KW2: Spät, ...)</SelectItem>
                  <SelectItem value="2">Schicht 2 (KW1: Spät, KW2: Früh, ...)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Schicht 1 und 2 wechseln sich wöchentlich zwischen Früh- und Spätschicht ab.
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
    </div>
  );
}
