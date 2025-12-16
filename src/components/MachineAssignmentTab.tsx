import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { UserPlus, X, Cog, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function MachineAssignmentTab() {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineShifts, setMachineShifts] = useState<MachineShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShiftAssignment[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // For adding new assignment
  const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [selectedShiftName, setSelectedShiftName] = useState<string>("");

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
  const getAssignedEmployees = (machineId: string, shiftName: string): Employee[] => {
    const shiftIds = getShiftIdsForName(machineId, shiftName);
    const assignedEmployeeIds = assignments
      .filter((a) => shiftIds.includes(a.machine_shift_id))
      .map((a) => a.employee_id);
    const uniqueEmployeeIds = [...new Set(assignedEmployeeIds)];
    return uniqueEmployeeIds.map((id) => employees.find((e) => e.id === id)!).filter(Boolean);
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

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await api.deleteEmployeeShiftAssignment(assignmentId);
      toast({ title: "Erfolg", description: "Zuordnung entfernt." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Entfernen fehlgeschlagen.", variant: "destructive" });
    }
  };

  // Get available shifts for selected machine
  const availableShifts = selectedMachineId ? getUniqueShiftsForMachine(selectedMachineId) : [];

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowAssignDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Mitarbeiter Zuordnen
        </Button>
      </div>

      {/* Machine Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {machines.map((machine) => {
          const uniqueShifts = getUniqueShiftsForMachine(machine.id);

          return (
            <Card key={machine.id} className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Cog className="h-5 w-5 text-muted-foreground" />
                  {machine.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {uniqueShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Schichten konfiguriert</p>
                ) : (
                  uniqueShifts.map((shift) => {
                    const assignedEmployees = getAssignedEmployees(machine.id, shift.shift_name);

                      return (
                      <div key={shift.id} className={cn(
                        "border rounded-lg p-3",
                        assignedEmployees.length > 0 
                          ? "bg-green-500/20 border-green-500/50" 
                          : "bg-red-500/20 border-red-500/50"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{shift.shift_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedEmployees.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">Keine Mitarbeiter zugeordnet</span>
                          ) : (
                            assignedEmployees.map((emp) => {
                              const assignmentId = getAssignmentId(emp.id, machine.id, shift.shift_name);
                              return (
                                <Badge
                                  key={emp.id}
                                  variant="secondary"
                                  className="flex items-center gap-1 pr-1"
                                >
                                  {emp.name}
                                  <button
                                    onClick={() => assignmentId && handleRemoveAssignment(assignmentId)}
                                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
  );
}
