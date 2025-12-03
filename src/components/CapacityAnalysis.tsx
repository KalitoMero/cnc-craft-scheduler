import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWorkingDaysInMonth, getMonthName } from "@/lib/bavarianWorkdays";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Cell,
} from "recharts";

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

  const selectedMachine = machines?.find((m) => m.id === selectedMachineId);

  // Find the column marked as internal completion date
  const completionDateColumn = useMemo(() => {
    return columnMappings?.find((c) => c.is_internal_completion_date)?.column_name || null;
  }, [columnMappings]);

  // Find the column marked as order duration
  const durationColumn = useMemo(() => {
    return columnMappings?.find((c) => c.is_order_duration)?.column_name || null;
  }, [columnMappings]);

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

      // Get duration in minutes, convert to hours
      // Try multiple possible duration field names
      let durationMinutes = 0;
      const possibleDurationFields = [durationColumn, "Zeit", "zeit", "Dauer", "dauer", "time", "duration"].filter(Boolean);
      
      for (const field of possibleDurationFields) {
        if (field && excelData[field] !== undefined && excelData[field] !== null) {
          const durValue = excelData[field];
          if (typeof durValue === "number") {
            durationMinutes = durValue;
            break;
          } else if (typeof durValue === "string") {
            // Try parsing HH:MM:SS or just number
            if (durValue.includes(":")) {
              const timeParts = durValue.split(":");
              durationMinutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1] || "0");
            } else {
              durationMinutes = parseFloat(durValue) || 0;
            }
            if (durationMinutes > 0) break;
          }
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

    // Calculate max capacity per month based on shifts and efficiency
    const efficiencyPercent = selectedMachine?.efficiency_percent || 100;

    return sortedMonths.map((monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const workingDays = getWorkingDaysInMonth(year, month);

      // Calculate daily shift hours (sum of active shifts for weekdays)
      let dailyShiftHours = 0;
      if (shifts && shifts.length > 0) {
        // Get unique weekday shifts (Mon-Fri: 1-5)
        const weekdayShifts = shifts.filter((s: MachineShift) => s.is_active && s.day_of_week >= 1 && s.day_of_week <= 5);
        // Average daily hours (some days might have different shifts)
        const hoursPerDay: Record<number, number> = {};
        weekdayShifts.forEach((s: MachineShift) => {
          hoursPerDay[s.day_of_week] = (hoursPerDay[s.day_of_week] || 0) + s.hours;
        });
        const totalHours = Object.values(hoursPerDay).reduce((sum, h) => sum + h, 0);
        const daysWithShifts = Object.keys(hoursPerDay).length;
        dailyShiftHours = daysWithShifts > 0 ? totalHours / daysWithShifts : 0;
      }

      const maxCapacity = workingDays * dailyShiftHours * (efficiencyPercent / 100);
      const orderHours = monthlyHours[monthKey] || 0;

      return {
        month: `${getMonthName(month)} ${year}`,
        monthShort: `${getMonthName(month).substring(0, 3)} ${year}`,
        orderHours: Math.round(orderHours * 10) / 10,
        maxCapacity: Math.round(maxCapacity * 10) / 10,
        isOverCapacity: orderHours > maxCapacity,
      };
    });
  }, [selectedMachineId, orders, shifts, completionDateColumn, durationColumn, selectedMachine]);

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
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
                        name === "orderHours" ? "Auftragsstunden" : "Max. Kapazität",
                      ]}
                      labelFormatter={(label) => `Monat: ${label}`}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "orderHours" ? "Auftragsstunden" : "Max. Kapazität"
                      }
                    />
                    <Bar dataKey="orderHours" name="orderHours" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isOverCapacity ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                        />
                      ))}
                    </Bar>
                    <ReferenceLine
                      y={0}
                      stroke="transparent"
                    />
                    {chartData.map((entry, index) => (
                      <ReferenceLine
                        key={`ref-${index}`}
                        y={entry.maxCapacity}
                        stroke="hsl(var(--chart-2))"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                        style={{ display: index === 0 ? "block" : "none" }}
                      />
                    ))}
                    {/* Single reference line for average max capacity */}
                    {chartData.length > 0 && (
                      <ReferenceLine
                        y={chartData[0]?.maxCapacity || 0}
                        stroke="hsl(var(--chart-2))"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                          value: `Max. Kapazität: ${chartData[0]?.maxCapacity || 0} Std.`,
                          position: "top",
                          className: "fill-muted-foreground text-xs",
                        }}
                      />
                    )}
                  </BarChart>
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
                      <th className="text-right py-2 px-3">Auftragsstunden</th>
                      <th className="text-right py-2 px-3">Max. Kapazität</th>
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
