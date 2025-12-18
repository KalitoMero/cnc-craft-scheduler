import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMonthName } from "@/lib/bavarianWorkdays";
import { isWorkingDay } from "@/lib/workdayUtils";
import {
  mergeIntervalsAndGetHours,
  parseTimeToMinutes,
  doesEmployeeWorkShift,
  TimeInterval,
} from "@/lib/timeIntervalUtils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, getDaysInMonth, isWeekend } from "date-fns";

interface MachineShift {
  id: string;
  machine_id: string;
  day_of_week: number;
  shift_name: string;
  shift_type: string | null;
  start_time: string;
  end_time: string;
  hours: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  shift_model_id: string | null;
  is_active: boolean;
}

interface ShiftModel {
  id: string;
  name: string;
  shift_type: string;
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

interface AbsenceDay {
  id: string;
  employee_id: string;
  date: string;
}

export const CapacityAnalysis = () => {
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: () => api.getMachines(),
  });

  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.getOrders(),
  });

  const { data: shifts } = useQuery({
    queryKey: ["machine-shifts", selectedMachineId],
    queryFn: () => api.getMachineShifts(selectedMachineId!),
    enabled: !!selectedMachineId,
  });

  const { data: columnMappings } = useQuery({
    queryKey: ["excel-column-mappings"],
    queryFn: () => api.getExcelColumnMappings(),
  });

  const { data: customWorkdays = [] } = useQuery({
    queryKey: ["customWorkdays"],
    queryFn: () => api.getCustomWorkdays(),
  });

  // Additional data for employee-based capacity
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.getEmployees(),
  });

  const { data: shiftModels = [] } = useQuery({
    queryKey: ["shift-models"],
    queryFn: () => api.getShiftModels(),
  });

  const { data: employeeMachineAssignments = [] } = useQuery({
    queryKey: ["employee-machine-assignments"],
    queryFn: () => api.getEmployeeMachineAssignments(),
  });

  const { data: dailyMachineAssignments = [] } = useQuery({
    queryKey: ["daily-machine-assignments"],
    queryFn: () => api.getDailyMachineAssignments(),
  });

  const { data: sickDays = [] } = useQuery({
    queryKey: ["employee-sick-days"],
    queryFn: () => api.getEmployeeSickDays(),
  });

  const { data: vacationDays = [] } = useQuery({
    queryKey: ["employee-vacation-days"],
    queryFn: () => api.getEmployeeVacationDays(),
  });

  const selectedMachine = machines?.find((m) => m.id === selectedMachineId);

  // Find the column marked as internal completion date
  const completionDateColumn = useMemo(() => {
    return columnMappings?.find((c) => c.is_internal_completion_date)?.column_name || null;
  }, [columnMappings]);

  // Find the column marked as order duration
  const durationColumn = useMemo(() => {
    return columnMappings?.find((c) => c.is_order_duration)?.column_name || null;
  }, [columnMappings]);

  // Create lookup maps for efficiency
  const employeeShiftModelMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((emp: Employee) => {
      if (emp.shift_model_id) {
        const model = shiftModels.find((m: ShiftModel) => m.id === emp.shift_model_id);
        if (model) {
          map.set(emp.id, model.shift_type);
        }
      }
    });
    return map;
  }, [employees, shiftModels]);

  const sickDaysSet = useMemo(() => {
    const set = new Set<string>();
    sickDays.forEach((s: AbsenceDay) => {
      set.add(`${s.employee_id}_${s.date}`);
    });
    return set;
  }, [sickDays]);

  const vacationDaysSet = useMemo(() => {
    const set = new Set<string>();
    vacationDays.forEach((v: AbsenceDay) => {
      set.add(`${v.employee_id}_${v.date}`);
    });
    return set;
  }, [vacationDays]);

  // Get assigned employees for a machine on a specific date
  const getAssignedEmployees = (machineId: string, date: Date): string[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    // Check for daily overrides first
    const dailyAssignments = dailyMachineAssignments.filter(
      (a: DailyMachineAssignment) => a.machine_id === machineId && a.date === dateStr
    );
    
    if (dailyAssignments.length > 0) {
      return dailyAssignments.map((a: DailyMachineAssignment) => a.employee_id);
    }
    
    // Fall back to default assignments
    return employeeMachineAssignments
      .filter((a: EmployeeMachineAssignment) => a.machine_id === machineId)
      .map((a: EmployeeMachineAssignment) => a.employee_id);
  };

  // Check if an employee is available (not sick, not on vacation)
  const isEmployeeAvailable = (employeeId: string, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${employeeId}_${dateStr}`;
    
    // Check sick days
    if (sickDaysSet.has(key)) return false;
    
    // Check vacation days
    if (vacationDaysSet.has(key)) return false;
    
    // Check company vacation (Dec 24 - Jan 6)
    const month = date.getMonth();
    const day = date.getDate();
    if ((month === 11 && day >= 24) || (month === 0 && day <= 6)) {
      return false;
    }
    
    return true;
  };

  // Calculate effective hours for a specific day considering employee availability
  const calculateDayCapacity = (
    machineId: string,
    date: Date,
    machineShifts: MachineShift[],
    efficiencyPercent: number
  ): number => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...
    
    // Get shifts for this weekday
    const dayShifts = machineShifts.filter(
      (s) => s.is_active && s.day_of_week === dayOfWeek
    );
    
    if (dayShifts.length === 0) return 0;
    
    // Get assigned employees for this machine on this date
    const assignedEmployeeIds = getAssignedEmployees(machineId, date);
    
    // If no employees assigned, no capacity
    if (assignedEmployeeIds.length === 0) return 0;
    
    // Filter to available employees
    const availableEmployeeIds = assignedEmployeeIds.filter((empId) =>
      isEmployeeAvailable(empId, date)
    );
    
    // If no employees available, no capacity
    if (availableEmployeeIds.length === 0) return 0;
    
    // Collect time intervals for shifts that have at least one available employee
    const staffedIntervals: TimeInterval[] = [];
    
    dayShifts.forEach((shift) => {
      // Check if any available employee can work this shift type
      const canBeStaffed = availableEmployeeIds.some((empId) => {
        const shiftModelType = employeeShiftModelMap.get(empId);
        return doesEmployeeWorkShift(shiftModelType || null, shift.shift_type, date);
      });
      
      if (canBeStaffed) {
        staffedIntervals.push({
          start: parseTimeToMinutes(shift.start_time),
          end: parseTimeToMinutes(shift.end_time),
        });
      }
    });
    
    // Merge overlapping intervals and get effective hours
    const effectiveHours = mergeIntervalsAndGetHours(staffedIntervals);
    
    // Apply efficiency
    return effectiveHours * (efficiencyPercent / 100);
  };

  // Calculate monthly data
  const chartData = useMemo(() => {
    if (!selectedMachineId || !orders || !completionDateColumn) return [];

    const machineOrders = orders.filter((o) => o.machine_id === selectedMachineId);
    if (machineOrders.length === 0) return [];

    // Group orders by month
    const monthlyHours: Record<string, number> = {};
    const monthKeys: Set<string> = new Set();

    machineOrders.forEach((order) => {
      const excelData = order.excel_data as Record<string, any> | null;
      if (!excelData) return;

      const dateValue = excelData[completionDateColumn];
      if (!dateValue) return;

      // Parse date (handle various formats)
      let date: Date | null = null;
      if (typeof dateValue === "string") {
        // Try DD.MM.YYYY format
        const parts = dateValue.split(".");
        if (parts.length === 3) {
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === "number") {
        // Excel serial date
        date = new Date((dateValue - 25569) * 86400 * 1000);
      }

      if (!date || isNaN(date.getTime())) return;

      // Get duration from configured column - values are in MINUTES, need to convert to hours
      let durationMinutes = 0;
      if (durationColumn && excelData[durationColumn] !== undefined && excelData[durationColumn] !== null) {
        const durValue = excelData[durationColumn];
        if (typeof durValue === "number") {
          durationMinutes = durValue;
        } else if (typeof durValue === "string") {
          durationMinutes = parseFloat(durValue) || 0;
        }
      }
      
      const durationHours = durationMinutes / 60;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
      monthKeys.add(monthKey);
      monthlyHours[monthKey] = (monthlyHours[monthKey] || 0) + durationHours;
    });

    // Sort month keys
    const sortedMonths = Array.from(monthKeys).sort();
    if (sortedMonths.length === 0) return [];

    // Calculate max capacity per month based on employee availability
    const efficiencyPercent = selectedMachine?.efficiency_percent || 100;

    return sortedMonths.map((monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const daysInMonth = getDaysInMonth(new Date(year, month, 1));
      
      let totalCapacity = 0;
      let workingDaysCount = 0;
      
      // Calculate capacity for each day in the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        
        // Skip non-working days
        if (!isWorkingDay(date, customWorkdays)) continue;
        
        workingDaysCount++;
        
        if (shifts && shifts.length > 0) {
          totalCapacity += calculateDayCapacity(
            selectedMachineId,
            date,
            shifts as MachineShift[],
            efficiencyPercent
          );
        }
      }

      const orderHours = monthlyHours[monthKey] || 0;

      return {
        month: `${getMonthName(month)} ${year}`,
        monthShort: `${getMonthName(month).substring(0, 3)} ${year}`,
        orderHours: Math.round(orderHours * 10) / 10,
        maxCapacity: Math.round(totalCapacity * 10) / 10,
        workingDays: workingDaysCount,
        isOverCapacity: orderHours > totalCapacity,
      };
    });
  }, [
    selectedMachineId,
    orders,
    shifts,
    completionDateColumn,
    durationColumn,
    selectedMachine,
    customWorkdays,
    employeeMachineAssignments,
    dailyMachineAssignments,
    employeeShiftModelMap,
    sickDaysSet,
    vacationDaysSet,
  ]);

  return (
    <div className="space-y-6">
      {/* Machine Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Maschine auswählen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {machines?.map((machine) => (
              <Button
                key={machine.id}
                variant={selectedMachineId === machine.id ? "default" : "outline"}
                onClick={() => setSelectedMachineId(machine.id)}
              >
                {machine.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {selectedMachineId && (
        <Card>
          <CardHeader>
            <CardTitle>
              Kapazitätsübersicht: {selectedMachine?.name}
              {selectedMachine?.efficiency_percent && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Wirkungsgrad: {selectedMachine.efficiency_percent}%)
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Kapazität basiert auf zugeordneten Mitarbeitern, deren Verfügbarkeit und Schichtmodellen.
              Überlappende Schichten werden nur einfach gezählt.
            </p>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {!completionDateColumn
                  ? "Bitte markieren Sie eine Excel-Spalte als 'Internes Fertigungsende' in den Excel-Spalten Einstellungen."
                  : "Keine Aufträge mit Fertigungsende für diese Maschine gefunden."}
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="monthShort"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                      label={{
                        value: "Stunden",
                        angle: -90,
                        position: "insideLeft",
                        className: "fill-muted-foreground",
                      }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} Std.`,
                        name === "orderHours" ? "Auftragsstunden" : "MA-Kapazität",
                      ]}
                      labelFormatter={(label) => `Monat: ${label}`}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "orderHours" ? "Auftragsstunden" : "MA-Kapazität"
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="maxCapacity"
                      name="maxCapacity"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="orderHours"
                      name="orderHours"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Summary Table */}
            {chartData.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Monat</th>
                      <th className="text-right py-2 px-3">Arbeitstage</th>
                      <th className="text-right py-2 px-3">Auftragsstunden</th>
                      <th className="text-right py-2 px-3">MA-Kapazität</th>
                      <th className="text-right py-2 px-3">Auslastung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row, idx) => {
                      const utilization = row.maxCapacity > 0 
                        ? Math.round((row.orderHours / row.maxCapacity) * 100) 
                        : 0;
                      return (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2 px-3">{row.month}</td>
                          <td className="text-right py-2 px-3">{row.workingDays}</td>
                          <td className="text-right py-2 px-3">{row.orderHours} Std.</td>
                          <td className="text-right py-2 px-3">{row.maxCapacity} Std.</td>
                          <td className={`text-right py-2 px-3 font-medium ${row.isOverCapacity ? "text-destructive" : ""}`}>
                            {utilization}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
