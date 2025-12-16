import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { UserPlus, X, Cog } from "lucide-react";
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

const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export default function MachineAssignmentTab() {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineShifts, setMachineShifts] = useState<MachineShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShiftAssignment[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    // Group by shift_name to get unique shift types
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

  // Check if employee is assigned to any shift of a machine's shift name
  const isEmployeeAssigned = (employeeId: string, machineId: string, shiftName: string): boolean => {
    const shiftIds = getShiftIdsForName(machineId, shiftName);
    return assignments.some((a) => a.employee_id === employeeId && shiftIds.includes(a.machine_shift_id));
  };

  // Get assignment ID for employee and shift
  const getAssignmentId = (employeeId: string, machineId: string, shiftName: string): string | null => {
    const shiftIds = getShiftIdsForName(machineId, shiftName);
    const assignment = assignments.find((a) => a.employee_id === employeeId && shiftIds.includes(a.machine_shift_id));
    return assignment?.id || null;
  };

  const handleAssignEmployee = async (employeeId: string, machineId: string, shiftName: string) => {
    try {
      // Get any shift ID for this machine+shiftName combination
      const shiftIds = getShiftIdsForName(machineId, shiftName);
      if (shiftIds.length === 0) return;

      // Use the first shift ID as the reference
      await api.createEmployeeShiftAssignment({
        employee_id: employeeId,
        machine_shift_id: shiftIds[0],
      });

      toast({ title: "Erfolg", description: "Mitarbeiter zugeordnet." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Zuordnung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleRemoveAssignment = async (employeeId: string, machineId: string, shiftName: string) => {
    const assignmentId = getAssignmentId(employeeId, machineId, shiftName);
    if (!assignmentId) return;

    try {
      await api.deleteEmployeeShiftAssignment(assignmentId);
      toast({ title: "Erfolg", description: "Zuordnung entfernt." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Entfernen fehlgeschlagen.", variant: "destructive" });
    }
  };

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
                      <div key={shift.id} className="border rounded-lg p-3 bg-muted/30">
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
                            assignedEmployees.map((emp) => (
                              <Badge
                                key={emp.id}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1"
                              >
                                {emp.name}
                                <button
                                  onClick={() => handleRemoveAssignment(emp.id, machine.id, shift.shift_name)}
                                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
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
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Mitarbeiter zuordnen</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {employees.map((employee) => (
                <div key={employee.id} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">{employee.name}</h4>
                  <div className="space-y-2">
                    {machines.map((machine) => {
                      const uniqueShifts = getUniqueShiftsForMachine(machine.id);
                      if (uniqueShifts.length === 0) return null;

                      return (
                        <div key={machine.id} className="ml-2">
                          <span className="text-sm font-medium text-muted-foreground">{machine.name}</span>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {uniqueShifts.map((shift) => {
                              const isAssigned = isEmployeeAssigned(employee.id, machine.id, shift.shift_name);

                              return (
                                <Button
                                  key={shift.id}
                                  size="sm"
                                  variant={isAssigned ? "default" : "outline"}
                                  className={cn(
                                    "text-xs",
                                    isAssigned && "bg-primary text-primary-foreground"
                                  )}
                                  onClick={() =>
                                    isAssigned
                                      ? handleRemoveAssignment(employee.id, machine.id, shift.shift_name)
                                      : handleAssignEmployee(employee.id, machine.id, shift.shift_name)
                                  }
                                >
                                  {shift.shift_name}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
  );
}
