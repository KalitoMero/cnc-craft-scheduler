import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { UserPlus, X, Cog, Plus, GripVertical, User } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface MachineShift {
  id: string;
  machine_id: string;
  day_of_week: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  hours: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
  shift_model: number | null;
}

interface EmployeeShiftAssignment {
  id: string;
  employee_id: string;
  machine_shift_id: string;
}

// Draggable Employee Badge
function DraggableEmployee({ 
  employee, 
  assignmentId, 
  machineId, 
  shiftName,
  onRemove 
}: { 
  employee: Employee; 
  assignmentId: string;
  machineId: string;
  shiftName: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${assignmentId}`,
    data: { employee, assignmentId, machineId, shiftName },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

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

// Droppable Shift Area
function DroppableShift({ 
  machineId, 
  shiftName, 
  shiftId,
  children,
  isOver,
  onClickEmpty,
}: { 
  machineId: string; 
  shiftName: string;
  shiftId: string;
  children: React.ReactNode;
  isOver: boolean;
  onClickEmpty?: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `${machineId}-${shiftName}`,
    data: { machineId, shiftName, shiftId },
  });

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "flex flex-wrap gap-1.5 min-h-[32px] p-1 rounded transition-colors",
        isOver && "bg-primary/20 ring-2 ring-primary",
        onClickEmpty && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onClickEmpty}
    >
      {children}
    </div>
  );
}

export default function MachineAssignmentTab() {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineShifts, setMachineShifts] = useState<MachineShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShiftAssignment[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [overDroppableId, setOverDroppableId] = useState<string | null>(null);
  
  // For adding new assignment
  const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [selectedShiftName, setSelectedShiftName] = useState<string>("");
  
  // Quick-assign popover state
  const [quickAssignOpen, setQuickAssignOpen] = useState<string | null>(null); // format: "machineId-shiftName"

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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [machinesData, shiftsData, employeesData, assignmentsData] = await Promise.all([
        api.getMachines(),
        api.getMachineShifts(),
        api.getEmployees(),
        api.getEmployeeShiftAssignments(),
      ]);
      setMachines(machinesData);
      setMachineShifts(shiftsData);
      setEmployees(employeesData);
      setAssignments(assignmentsData);
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

  // Get unique shifts per machine (group by shift_name)
  const getUniqueShiftsForMachine = (machineId: string): MachineShift[] => {
    const shifts = machineShifts.filter((s) => s.machine_id === machineId && s.is_active);
    const uniqueShiftNames = [...new Set(shifts.map((s) => s.shift_name))];
    return uniqueShiftNames.map((name) => shifts.find((s) => s.shift_name === name)!);
  };

  // Get all shift IDs for a specific shift name on a machine
  const getShiftIdsForName = (machineId: string, shiftName: string): string[] => {
    return machineShifts
      .filter((s) => s.machine_id === machineId && s.shift_name === shiftName && s.is_active)
      .map((s) => s.id);
  };

  // Get employees assigned to a machine's shift
  const getAssignedEmployees = (machineId: string, shiftName: string): { employee: Employee; assignmentId: string }[] => {
    const shiftIds = getShiftIdsForName(machineId, shiftName);
    const employeeAssignments = assignments
      .filter((a) => shiftIds.includes(a.machine_shift_id))
      .map((a) => ({
        employee: employees.find((e) => e.id === a.employee_id)!,
        assignmentId: a.id,
      }))
      .filter((a) => a.employee);
    
    // Remove duplicates by employee ID
    const seen = new Set();
    return employeeAssignments.filter((a) => {
      if (seen.has(a.employee.id)) return false;
      seen.add(a.employee.id);
      return true;
    });
  };

  // Get assignment ID for employee and shift
  const getAssignmentId = (employeeId: string, machineId: string, shiftName: string): string | null => {
    const shiftIds = getShiftIdsForName(machineId, shiftName);
    const assignment = assignments.find((a) => a.employee_id === employeeId && shiftIds.includes(a.machine_shift_id));
    return assignment?.id || null;
  };

  // Get all assignments for an employee with machine/shift info
  const getEmployeeAssignments = (employeeId: string) => {
    const employeeAssignments = assignments.filter((a) => a.employee_id === employeeId);
    return employeeAssignments.map((a) => {
      const shift = machineShifts.find((s) => s.id === a.machine_shift_id);
      const machine = machines.find((m) => m.id === shift?.machine_id);
      return { assignmentId: a.id, machine, shift };
    }).filter((a) => a.machine && a.shift);
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeForAssign || !selectedMachineId || !selectedShiftName) return;

    try {
      const shiftIds = getShiftIdsForName(selectedMachineId, selectedShiftName);
      if (shiftIds.length === 0) return;

      await api.createEmployeeShiftAssignment({
        employee_id: selectedEmployeeForAssign,
        machine_shift_id: shiftIds[0],
      });

      toast({ title: "Erfolg", description: "Mitarbeiter zugeordnet." });
      setSelectedEmployeeForAssign(null);
      setSelectedMachineId("");
      setSelectedShiftName("");
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Zuordnung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleQuickAssign = async (employeeId: string, machineId: string, shiftName: string) => {
    try {
      const shiftIds = getShiftIdsForName(machineId, shiftName);
      if (shiftIds.length === 0) return;

      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      setAssignments(prev => [...prev, {
        id: tempId,
        employee_id: employeeId,
        machine_shift_id: shiftIds[0],
      }]);
      setQuickAssignOpen(null);

      const newAssignment = await api.createEmployeeShiftAssignment({
        employee_id: employeeId,
        machine_shift_id: shiftIds[0],
      });

      setAssignments(prev => prev.map(a => 
        a.id === tempId ? { ...a, id: newAssignment.id } : a
      ));
    } catch (error) {
      loadData(); // Reload on error
      toast({ title: "Fehler", description: "Zuordnung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    // Optimistic update
    const previousAssignments = [...assignments];
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));

    try {
      await api.deleteEmployeeShiftAssignment(assignmentId);
    } catch (error) {
      // Revert on error
      setAssignments(previousAssignments);
      toast({ title: "Fehler", description: "Entfernen fehlgeschlagen.", variant: "destructive" });
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

    const { assignmentId, employee, machineId: fromMachineId, shiftName: fromShiftName } = activeData;
    const { machineId: toMachineId, shiftName: toShiftName } = overData;

    // If dropped on the same shift, do nothing
    if (fromMachineId === toMachineId && fromShiftName === toShiftName) return;

    const targetShiftIds = getShiftIdsForName(toMachineId, toShiftName);
    if (targetShiftIds.length === 0) return;

    // Optimistic update - create a temporary ID for the new assignment
    const tempId = `temp-${Date.now()}`;
    const previousAssignments = [...assignments];
    
    setAssignments(prev => {
      // Remove old assignment
      const filtered = prev.filter(a => a.id !== assignmentId);
      // Add new assignment with temp ID
      return [...filtered, {
        id: tempId,
        employee_id: employee.id,
        machine_shift_id: targetShiftIds[0],
      }];
    });

    try {
      // Delete old assignment
      await api.deleteEmployeeShiftAssignment(assignmentId);
      
      // Create new assignment
      const newAssignment = await api.createEmployeeShiftAssignment({
        employee_id: employee.id,
        machine_shift_id: targetShiftIds[0],
      });

      // Update temp ID with real ID
      setAssignments(prev => prev.map(a => 
        a.id === tempId ? { ...a, id: newAssignment.id } : a
      ));
    } catch (error) {
      // Revert on error
      setAssignments(previousAssignments);
      toast({ title: "Fehler", description: "Verschieben fehlgeschlagen.", variant: "destructive" });
    }
  };

  // Get available shifts for selected machine
  const availableShifts = selectedMachineId ? getUniqueShiftsForMachine(selectedMachineId) : [];

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
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setShowAssignDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Mitarbeiter Zuordnen
          </Button>
        </div>

        {/* Machine Grid - Compact layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
          {machines.map((machine) => {
            const uniqueShifts = getUniqueShiftsForMachine(machine.id);

            return (
              <Card key={machine.id} className="border">
                <CardHeader className="p-2 pb-1">
                  <CardTitle className="flex items-center gap-1 text-xs font-semibold truncate">
                    <Cog className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{machine.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  {uniqueShifts.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">Keine Schichten</p>
                  ) : (
                    uniqueShifts.map((shift) => {
                      const assignedEmployees = getAssignedEmployees(machine.id, shift.shift_name);
                      const droppableId = `${machine.id}-${shift.shift_name}`;
                      const isOver = overDroppableId === droppableId;

                      return (
                        <div key={shift.id} className={cn(
                          "border rounded p-1.5",
                          assignedEmployees.length > 0 
                            ? "bg-green-500/20 border-green-500/50" 
                            : "bg-red-500/20 border-red-500/50"
                        )}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-[10px]">{shift.shift_name}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {shift.start_time.slice(0, 5)}
                            </span>
                          </div>
                          <Popover 
                            open={quickAssignOpen === `${machine.id}-${shift.shift_name}`}
                            onOpenChange={(open) => setQuickAssignOpen(open ? `${machine.id}-${shift.shift_name}` : null)}
                          >
                            <PopoverTrigger asChild>
                              <div>
                                <DroppableShift
                                  machineId={machine.id}
                                  shiftName={shift.shift_name}
                                  shiftId={shift.id}
                                  isOver={isOver}
                                  onClickEmpty={assignedEmployees.length === 0 ? () => setQuickAssignOpen(`${machine.id}-${shift.shift_name}`) : undefined}
                                >
                                  {assignedEmployees.length === 0 ? (
                                    <span className="text-[9px] text-muted-foreground italic flex items-center gap-0.5">
                                      <Plus className="h-2 w-2" />
                                      Hinzufügen
                                    </span>
                                  ) : (
                                    assignedEmployees.map(({ employee, assignmentId }) => (
                                      <DraggableEmployee
                                        key={assignmentId}
                                        employee={employee}
                                        assignmentId={assignmentId}
                                        machineId={machine.id}
                                        shiftName={shift.shift_name}
                                        onRemove={() => handleRemoveAssignment(assignmentId)}
                                      />
                                    ))
                                  )}
                                </DroppableShift>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                              <div className="text-xs font-medium mb-2">Mitarbeiter wählen</div>
                              <ScrollArea className="max-h-40">
                                <div className="space-y-1">
                                  {employees.filter(e => e.is_active).map((employee) => (
                                    <button
                                      key={employee.id}
                                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted flex items-center gap-1.5"
                                      onClick={() => handleQuickAssign(employee.id, machine.id, shift.shift_name)}
                                    >
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      {employee.name}
                                    </button>
                                  ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeEmployee ? (
            <Badge variant="secondary" className="flex items-center gap-1 cursor-grabbing shadow-lg">
              <GripVertical className="h-3 w-3 mr-0.5 text-muted-foreground" />
              {activeEmployee.name}
            </Badge>
          ) : null}
        </DragOverlay>

        {/* Assignment Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Mitarbeiter zuordnen</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-2">
                {employees.map((employee) => {
                  const employeeAssignments = getEmployeeAssignments(employee.id);
                  const isExpanded = selectedEmployeeForAssign === employee.id;

                  return (
                    <div key={employee.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium">{employee.name}</span>
                          {employeeAssignments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {employeeAssignments.map(({ assignmentId, machine, shift }) => (
                                <Badge key={assignmentId} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                                  {machine?.name} - {shift?.shift_name}
                                  <button
                                    onClick={() => handleRemoveAssignment(assignmentId)}
                                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (isExpanded) {
                              setSelectedEmployeeForAssign(null);
                              setSelectedMachineId("");
                              setSelectedShiftName("");
                            } else {
                              setSelectedEmployeeForAssign(employee.id);
                              setSelectedMachineId("");
                              setSelectedShiftName("");
                            }
                          }}
                        >
                          <Plus className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-45")} />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <div className="space-y-2">
                            <Select value={selectedMachineId} onValueChange={(val) => {
                              setSelectedMachineId(val);
                              setSelectedShiftName("");
                            }}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Maschine auswählen" />
                              </SelectTrigger>
                              <SelectContent>
                                {machines.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedMachineId && availableShifts.length > 0 && (
                              <Select value={selectedShiftName} onValueChange={setSelectedShiftName}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Schicht auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableShifts.map((s) => (
                                    <SelectItem key={s.id} value={s.shift_name}>{s.shift_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {selectedMachineId && availableShifts.length === 0 && (
                              <p className="text-sm text-muted-foreground">Keine Schichten für diese Maschine konfiguriert</p>
                            )}
                          </div>

                          <Button
                            size="sm"
                            disabled={!selectedMachineId || !selectedShiftName}
                            onClick={handleAssignEmployee}
                          >
                            Zuordnen
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAssignDialog(false);
                setSelectedEmployeeForAssign(null);
                setSelectedMachineId("");
                setSelectedShiftName("");
              }}>
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
