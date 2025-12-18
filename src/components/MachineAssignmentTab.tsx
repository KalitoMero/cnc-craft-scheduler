import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { UserPlus, X, Cog, Plus, GripVertical, User, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, subDays, getISOWeek, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface Machine {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
  shift_model: number | null;
  shift_model_id: string | null;
}

interface MachineShift {
  id: string;
  machine_id: string;
  day_of_week: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  hours: number;
  is_active: boolean;
  shift_type: string | null;
}

interface ShiftModel {
  id: string;
  name: string;
  shift_type: string;
  is_system: boolean;
  source_machine_shift_id: string | null;
}

interface EmployeeMachineAssignment {
  id: string;
  employee_id: string;
  machine_id: string;
}

interface DailyMachineAssignment {
  id: string;
  employee_id: string;
  machine_id: string;
  date: string;
}

interface SickDay {
  id: string;
  employee_id: string;
  date: string;
}

interface VacationDay {
  id: string;
  employee_id: string;
  date: string;
}

// Helper to get shift type for a week number based on shift model
function getShiftTypeForWeek(shiftModel: number | null, weekNumber: number, shiftModelData?: ShiftModel | null): string | null {
  // If employee has a shift_model_id, use the shift_type from the model
  if (shiftModelData) {
    if (shiftModelData.shift_type === 'fixed') return shiftModelData.name; // Return the shift name for fixed
    if (shiftModelData.shift_type === 'alternating_early') {
      const isOddWeek = weekNumber % 2 === 1;
      return isOddWeek ? 'F' : 'S';
    }
    if (shiftModelData.shift_type === 'alternating_late') {
      const isOddWeek = weekNumber % 2 === 1;
      return isOddWeek ? 'S' : 'F';
    }
  }
  
  // Fallback to old integer shift_model
  if (shiftModel === null) return null;
  const isOddWeek = weekNumber % 2 === 1;
  if (shiftModel === 1) {
    return isOddWeek ? 'F' : 'S';
  } else if (shiftModel === 2) {
    return isOddWeek ? 'S' : 'F';
  }
  return null;
}

// Draggable Employee Badge
function DraggableEmployee({ 
  employee, 
  assignmentId,
  machineId,
  shiftType,
  onRemove 
}: { 
  employee: Employee; 
  assignmentId: string;
  machineId: string;
  shiftType: string | null;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${assignmentId}`,
    data: { employee, assignmentId, machineId },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const isEarlyShift = shiftType === 'F' || shiftType === 'Frühschicht';
  const isLateShift = shiftType === 'S' || shiftType === 'Spätschicht';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("inline-flex", isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <Badge
        variant="secondary"
        className="flex items-center gap-0.5 pr-0.5 cursor-grab active:cursor-grabbing text-[9px] py-0 px-1"
      >
        <GripVertical className="h-2 w-2 text-muted-foreground" />
        <span className="truncate max-w-[60px]">{employee.name}</span>
        {shiftType && (
          <span className={cn(
            "ml-0.5 px-1 rounded text-[8px] font-bold",
            isEarlyShift ? "bg-yellow-500/30 text-yellow-700" : 
            isLateShift ? "bg-blue-500/30 text-blue-700" : 
            "bg-green-500/30 text-green-700"
          )}>
            {shiftType === 'F' ? 'F' : shiftType === 'S' ? 'S' : shiftType?.substring(0, 1)}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X className="h-2 w-2" />
        </button>
      </Badge>
    </div>
  );
}

// Droppable Machine Shift Area
function DroppableMachineShift({ 
  machineId,
  shiftType,
  shiftLabel,
  children,
  isOver,
  onClickEmpty,
}: { 
  machineId: string;
  shiftType: string;
  shiftLabel?: string;
  children: React.ReactNode;
  isOver: boolean;
  onClickEmpty?: () => void;
}) {
  const droppableId = `${machineId}-${shiftType}`;
  const { setNodeRef } = useDroppable({
    id: droppableId,
    data: { machineId, shiftType },
  });

  const isEarlyShift = shiftType === 'F' || shiftType === 'Frühschicht';
  const isLateShift = shiftType === 'S' || shiftType === 'Spätschicht';

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "flex flex-wrap gap-1 min-h-[24px] p-1 rounded transition-colors border",
        isEarlyShift ? "border-yellow-500/30 bg-yellow-500/5" : 
        isLateShift ? "border-blue-500/30 bg-blue-500/5" : 
        "border-green-500/30 bg-green-500/5",
        isOver && "bg-primary/20 ring-2 ring-primary",
        onClickEmpty && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onClickEmpty}
    >
      <span className={cn(
        "text-[8px] font-bold mr-1",
        isEarlyShift ? "text-yellow-600" : 
        isLateShift ? "text-blue-600" : 
        "text-green-600"
      )}>
        {shiftLabel || shiftType}:
      </span>
      {children}
    </div>
  );
}

export default function MachineAssignmentTab() {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftModels, setShiftModels] = useState<ShiftModel[]>([]);
  const [machineShifts, setMachineShifts] = useState<MachineShift[]>([]);
  const [defaultAssignments, setDefaultAssignments] = useState<EmployeeMachineAssignment[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyMachineAssignment[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);
  const [vacationDays, setVacationDays] = useState<VacationDay[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selected date for daily view
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const weekNumber = getISOWeek(selectedDate);
  
  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [overDroppableId, setOverDroppableId] = useState<string | null>(null);
  
  // For adding new default assignment
  const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  
  // Quick-assign popover state
  const [quickAssignOpen, setQuickAssignOpen] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Load daily assignments when date changes
    loadDailyAssignments();
  }, [formattedDate]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [machinesData, employeesData, shiftModelsData, machineShiftsData, defaultAssignmentsData, sickDaysData, vacationDaysData] = await Promise.all([
        api.getMachines(),
        api.getEmployees(),
        api.getShiftModels(),
        api.getAllMachineShifts(),
        api.getEmployeeMachineAssignments(),
        api.getEmployeeSickDays(),
        api.getEmployeeVacationDays(),
      ]);
      setMachines(machinesData);
      setEmployees(employeesData);
      setShiftModels(shiftModelsData);
      setMachineShifts(machineShiftsData);
      setDefaultAssignments(defaultAssignmentsData);
      setSickDays(sickDaysData);
      setVacationDays(vacationDaysData);
      await loadDailyAssignments();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDailyAssignments = async () => {
    try {
      const data = await api.getDailyMachineAssignments(formattedDate);
      setDailyAssignments(data);
    } catch (error) {
      console.error("Error loading daily assignments:", error);
    }
  };

  // Check if employee is unavailable (sick or vacation) on selected date
  const isEmployeeUnavailable = (employeeId: string): boolean => {
    const isSick = sickDays.some(s => s.employee_id === employeeId && s.date === formattedDate);
    const isOnVacation = vacationDays.some(v => v.employee_id === employeeId && v.date === formattedDate);
    return isSick || isOnVacation;
  };

  // Get employees assigned to a machine for the current date, filtered by shift type
  // Priority: daily override > default assignment
  // Excludes employees who are sick or on vacation
  const getAssignedEmployeesForMachineAndShift = (machineId: string, shiftType: string): { employee: Employee; assignmentId: string; isDaily: boolean }[] => {
    const result: { employee: Employee; assignmentId: string; isDaily: boolean }[] = [];
    const seenEmployeeIds = new Set<string>();
    
    // First, check daily assignments for this date and machine
    const dailyForMachine = dailyAssignments.filter(a => a.machine_id === machineId);
    for (const da of dailyForMachine) {
      const emp = employees.find(e => e.id === da.employee_id);
      if (emp) {
        // Skip if employee is sick or on vacation
        if (isEmployeeUnavailable(emp.id)) continue;
        
        const shiftModelData = emp.shift_model_id ? shiftModels.find(m => m.id === emp.shift_model_id) : null;
        const empShiftType = getShiftTypeForWeek(emp.shift_model, weekNumber, shiftModelData);
        // Match shift type - for Normalschicht check if employee has fixed shift model
        const isMatch = empShiftType === shiftType || 
          (shiftType === 'No' && shiftModelData?.shift_type === 'fixed');
        if (isMatch) {
          result.push({ employee: emp, assignmentId: da.id, isDaily: true });
          seenEmployeeIds.add(emp.id);
        }
      }
    }
    
    // Then, add default assignments (but only if employee doesn't have a daily override)
    const defaultForMachine = defaultAssignments.filter(a => a.machine_id === machineId);
    for (const da of defaultForMachine) {
      // Check if this employee has any daily assignment for today (could be to different machine)
      const hasDaily = dailyAssignments.some(daily => daily.employee_id === da.employee_id);
      if (hasDaily) continue; // Skip, employee is overridden for today
      
      const emp = employees.find(e => e.id === da.employee_id);
      if (emp && !seenEmployeeIds.has(emp.id)) {
        // Skip if employee is sick or on vacation
        if (isEmployeeUnavailable(emp.id)) continue;
        
        const shiftModelData = emp.shift_model_id ? shiftModels.find(m => m.id === emp.shift_model_id) : null;
        const empShiftType = getShiftTypeForWeek(emp.shift_model, weekNumber, shiftModelData);
        // Match shift type - for Normalschicht check if employee has fixed shift model
        const isMatch = empShiftType === shiftType || 
          (shiftType === 'No' && shiftModelData?.shift_type === 'fixed');
        if (isMatch) {
          result.push({ employee: emp, assignmentId: da.id, isDaily: false });
          seenEmployeeIds.add(emp.id);
        }
      }
    }
    
    return result;
  };

  // Get shift type for an employee on the selected date
  const getEmployeeShiftType = (employee: Employee): string | null => {
    const shiftModelData = employee.shift_model_id ? shiftModels.find(m => m.id === employee.shift_model_id) : null;
    return getShiftTypeForWeek(employee.shift_model, weekNumber, shiftModelData);
  };

  // Get all default assignments for an employee
  const getEmployeeDefaultAssignments = (employeeId: string) => {
    return defaultAssignments
      .filter(a => a.employee_id === employeeId)
      .map(a => {
        const machine = machines.find(m => m.id === a.machine_id);
        return { assignmentId: a.id, machine };
      })
      .filter(a => a.machine);
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeForAssign || !selectedMachineId) return;

    try {
      await api.createEmployeeMachineAssignment({
        employee_id: selectedEmployeeForAssign,
        machine_id: selectedMachineId,
      });

      toast({ title: "Erfolg", description: "Standard-Zuordnung erstellt." });
      setSelectedEmployeeForAssign(null);
      setSelectedMachineId("");
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Zuordnung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleQuickAssign = async (employeeId: string, machineId: string) => {
    try {
      // Quick assign creates a daily override for this date
      const tempId = `temp-${Date.now()}`;
      setDailyAssignments(prev => [...prev, {
        id: tempId,
        employee_id: employeeId,
        machine_id: machineId,
        date: formattedDate,
      }]);
      setQuickAssignOpen(null);

      const newAssignment = await api.upsertDailyMachineAssignment({
        employee_id: employeeId,
        machine_id: machineId,
        date: formattedDate,
      });

      setDailyAssignments(prev => prev.map(a => 
        a.id === tempId ? { ...a, id: newAssignment.id } : a
      ));
    } catch (error) {
      loadDailyAssignments();
      toast({ title: "Fehler", description: "Zuordnung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string, isDaily: boolean, employeeId: string) => {
    if (isDaily) {
      // Remove daily override
      const previousAssignments = [...dailyAssignments];
      setDailyAssignments(prev => prev.filter(a => a.id !== assignmentId));

      try {
        await api.deleteDailyMachineAssignment(employeeId, formattedDate);
      } catch (error) {
        setDailyAssignments(previousAssignments);
        toast({ title: "Fehler", description: "Entfernen fehlgeschlagen.", variant: "destructive" });
      }
    } else {
      // Create a daily override with no machine (effectively removing for today)
      // Actually, for simplicity, let's just show a toast that this is the default
      toast({ 
        title: "Hinweis", 
        description: "Um die Standard-Zuordnung zu ändern, nutze 'Mitarbeiter Zuordnen'.",
      });
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const data = active.data.current;
    if (data?.employee) {
      setActiveEmployee(data.employee);
    }
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    setOverDroppableId(over?.id || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveEmployee(null);
    setOverDroppableId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) return;

    const { employee, machineId: fromMachineId } = activeData;
    const { machineId: toMachineId } = overData;

    // If dropped on the same machine, do nothing
    if (fromMachineId === toMachineId) return;

    // Create/update daily override for this employee to the new machine
    const tempId = `temp-${Date.now()}`;
    const previousDailyAssignments = [...dailyAssignments];
    
    // Remove existing daily assignment for this employee and add new one
    setDailyAssignments(prev => {
      const filtered = prev.filter(a => a.employee_id !== employee.id);
      return [...filtered, {
        id: tempId,
        employee_id: employee.id,
        machine_id: toMachineId,
        date: formattedDate,
      }];
    });

    try {
      const newAssignment = await api.upsertDailyMachineAssignment({
        employee_id: employee.id,
        machine_id: toMachineId,
        date: formattedDate,
      });

      setDailyAssignments(prev => prev.map(a => 
        a.id === tempId ? { ...a, id: newAssignment.id } : a
      ));
    } catch (error) {
      setDailyAssignments(previousDailyAssignments);
      toast({ title: "Fehler", description: "Verschieben fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleRemoveDefaultAssignment = async (assignmentId: string) => {
    const previousAssignments = [...defaultAssignments];
    setDefaultAssignments(prev => prev.filter(a => a.id !== assignmentId));

    try {
      await api.deleteEmployeeMachineAssignment(assignmentId);
      toast({ title: "Erfolg", description: "Standard-Zuordnung entfernt." });
    } catch (error) {
      setDefaultAssignments(previousAssignments);
      toast({ title: "Fehler", description: "Entfernen fehlgeschlagen.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Laden...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[200px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'EEEE, dd.MM.yyyy', { locale: de })}
                  <span className="ml-2 text-muted-foreground text-xs">(KW {weekNumber})</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
              Heute
            </Button>
          </div>
          <Button onClick={() => setShowAssignDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Mitarbeiter Zuordnen
          </Button>
        </div>
        {/* Machine Grid - Custom Layout */}
        {(() => {
          const activeMachines = machines.filter(m => m.is_active);
          
          const renderMachineCard = (machineName: string) => {
            const machine = activeMachines.find(m => m.name === machineName);
            if (!machine) return <div className="w-36 h-24" />; // Empty placeholder
            
            // Get configured shift types for this machine
            const machineShiftTypes = machineShifts
              .filter(s => s.machine_id === machine.id && s.shift_type)
              .map(s => s.shift_type as string);
            const uniqueShiftTypes = [...new Set(machineShiftTypes)];
            
            // If no shift types configured, show F and S as default
            const shiftTypesToShow = uniqueShiftTypes.length > 0 ? uniqueShiftTypes : ['F', 'S'];
            
            const getAssignedForShift = (shiftType: string) => 
              getAssignedEmployeesForMachineAndShift(machine.id, shiftType);
            
            const assignedF = getAssignedForShift('F');
            const assignedS = getAssignedForShift('S');
            const allShiftsFilled = (!shiftTypesToShow.includes('F') || assignedF.length > 0) && 
                                   (!shiftTypesToShow.includes('S') || assignedS.length > 0);

            const renderShiftArea = (shiftType: string, shiftLabel: string) => {
              const assigned = getAssignedForShift(shiftType);
              const isOver = overDroppableId === `${machine.id}-${shiftType}`;
              const quickAssignKey = `${machine.id}-${shiftType}`;

              // Get employees that match this shift type
              const matchingEmployees = employees.filter(e => {
                if (!e.is_active) return false;
                const empShiftType = getEmployeeShiftType(e);
                if (shiftType === 'No') {
                  const shiftModelData = e.shift_model_id ? shiftModels.find(m => m.id === e.shift_model_id) : null;
                  return shiftModelData?.shift_type === 'fixed';
                }
                return empShiftType === shiftType;
              });

              if (assigned.length === 0) {
                return (
                  <Popover 
                    open={quickAssignOpen === quickAssignKey}
                    onOpenChange={(open) => setQuickAssignOpen(open ? quickAssignKey : null)}
                  >
                    <PopoverTrigger asChild>
                      <div>
                        <DroppableMachineShift
                          machineId={machine.id}
                          shiftType={shiftType}
                          shiftLabel={shiftLabel}
                          isOver={isOver}
                          onClickEmpty={() => setQuickAssignOpen(quickAssignKey)}
                        >
                          <span className="text-[8px] text-muted-foreground italic flex items-center gap-0.5">
                            <Plus className="h-2 w-2" />
                          </span>
                        </DroppableMachineShift>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                      <div className="text-xs font-medium mb-2">
                        {shiftLabel} - Mitarbeiter wählen
                      </div>
                      <ScrollArea className="max-h-40">
                        <div className="space-y-1">
                          {matchingEmployees.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Keine passenden Mitarbeiter</p>
                          ) : (
                            matchingEmployees.map((employee) => (
                              <button
                                key={employee.id}
                                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted flex items-center gap-1.5"
                                onClick={() => handleQuickAssign(employee.id, machine.id)}
                              >
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="flex-1">{employee.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <DroppableMachineShift
                  machineId={machine.id}
                  shiftType={shiftType}
                  shiftLabel={shiftLabel}
                  isOver={isOver}
                >
                  {assigned.map(({ employee, assignmentId, isDaily }) => (
                    <DraggableEmployee
                      key={`${employee.id}-${assignmentId}`}
                      employee={employee}
                      assignmentId={assignmentId}
                      machineId={machine.id}
                      shiftType={shiftType}
                      onRemove={() => handleRemoveAssignment(assignmentId, isDaily, employee.id)}
                    />
                  ))}
                </DroppableMachineShift>
              );
            };

            return (
              <Card key={machine.id} className={cn(
                "border w-36",
                allShiftsFilled 
                  ? "bg-green-500/10 border-green-500/50" 
                  : "bg-red-500/10 border-red-500/50"
              )}>
                <CardHeader className="p-2 pb-1">
                  <CardTitle className="flex items-center gap-1 text-xs font-semibold truncate">
                    <Cog className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{machine.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  {shiftTypesToShow.map(shiftType => renderShiftArea(shiftType, shiftType))}
                </CardContent>
              </Card>
            );
          };

          // Track which machines are in the layout
          const layoutMachineNames = ['MSY-1', '200MS', '100-2', '250Y', '250L', '300N', 'CLX-I', '250MS', '800X', 'MSY-2', '10N', '15M'];
          const otherMachines = activeMachines.filter(m => !layoutMachineNames.includes(m.name));

          return (
            <div className="space-y-6">
              {/* Row 1: MSY-1, 200MS */}
              <div className="flex justify-center gap-8">
                {renderMachineCard('MSY-1')}
                {renderMachineCard('200MS')}
              </div>
              
              {/* Row 2: 100-2, 250Y, 250L, 300N, CLX-I */}
              <div className="flex items-center gap-4">
                {renderMachineCard('100-2')}
                <div className="flex-1" />
                <div className="flex gap-2">
                  {renderMachineCard('250Y')}
                  {renderMachineCard('250L')}
                  {renderMachineCard('300N')}
                  {renderMachineCard('CLX-I')}
                </div>
              </div>
              
              {/* Row 3: 250MS, 800X, MSY-2 */}
              <div className="flex justify-center gap-4 pl-16">
                {renderMachineCard('250MS')}
                {renderMachineCard('800X')}
                {renderMachineCard('MSY-2')}
              </div>

              {/* Row 4: 10N, 15M and any other machines */}
              <div className="flex justify-start gap-4">
                {renderMachineCard('10N')}
                {renderMachineCard('15M')}
                {otherMachines.map(m => renderMachineCard(m.name))}
              </div>
            </div>
          );
        })()}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeEmployee ? (
            <Badge variant="secondary" className="flex items-center gap-1 cursor-grabbing shadow-lg">
              <GripVertical className="h-3 w-3 mr-0.5 text-muted-foreground" />
              {activeEmployee.name}
            </Badge>
          ) : null}
        </DragOverlay>

        {/* Default Assignment Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Standard-Maschinenzuordnung</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Hier legst du fest, an welchen Maschinen ein Mitarbeiter standardmäßig arbeitet.
              </p>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-2">
                {employees.filter(e => e.is_active).map((employee) => {
                  const employeeAssignments = getEmployeeDefaultAssignments(employee.id);
                  const isExpanded = selectedEmployeeForAssign === employee.id;

                  return (
                    <div key={employee.id} className="border rounded p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{employee.name}</span>
                          {employee.shift_model && (
                            <Badge variant="outline" className="text-xs">
                              Schicht {employee.shift_model}
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedEmployeeForAssign(isExpanded ? null : employee.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {employeeAssignments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {employeeAssignments.map(({ assignmentId, machine }) => (
                            <Badge key={assignmentId} variant="secondary" className="text-xs">
                              {machine?.name}
                              <button
                                onClick={() => handleRemoveDefaultAssignment(assignmentId)}
                                className="ml-1 hover:bg-destructive/20 rounded-full"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {isExpanded && (
                        <div className="mt-2 flex gap-2">
                          <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Maschine wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {machines.filter(m => m.is_active).map((machine) => (
                                <SelectItem key={machine.id} value={machine.id}>
                                  {machine.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            onClick={handleAssignEmployee}
                            disabled={!selectedMachineId}
                          >
                            Hinzufügen
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
