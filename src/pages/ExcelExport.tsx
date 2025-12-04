import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const ExcelExport = () => {
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: api.getMachines,
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.getOrders(),
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ["machine-shifts"],
    queryFn: () => api.getMachineShifts(),
  });

  const { data: customWorkdays = [] } = useQuery({
    queryKey: ["custom-workdays"],
    queryFn: api.getCustomWorkdays,
  });

  const { data: columnMappings = [] } = useQuery({
    queryKey: ["excel-column-mappings"],
    queryFn: api.getExcelColumnMappings,
  });

  const { data: savedStartDate } = useQuery({
    queryKey: ["production-start-date"],
    queryFn: () => api.getSetting("production_start_date"),
  });

  const activeMachines = (machines as any[]).filter((m: any) => m.is_active);

  const handleSelectAll = () => {
    if (selectedMachines.length === activeMachines.length) {
      setSelectedMachines([]);
    } else {
      setSelectedMachines(activeMachines.map((m) => m.id));
    }
  };

  const handleMachineToggle = (machineId: string) => {
    setSelectedMachines((prev) =>
      prev.includes(machineId)
        ? prev.filter((id) => id !== machineId)
        : [...prev, machineId]
    );
  };

  const calculateCompletionTimeForExport = (
    orders: any[],
    shifts: any[],
    startDate: Date,
    efficiencyPercent: number,
    columnMappings: any[],
    customWorkdays: any[]
  ) => {
    const durationMapping = columnMappings.find((m) => m.is_order_duration);
    const durationColumnName = durationMapping?.column_name;

    let currentTime = new Date(startDate);
    const results: { orderId: string; completionTime: Date | null }[] = [];

    for (const order of orders) {
      let durationMinutes = 0;
      if (durationColumnName && order.excel_data?.[durationColumnName]) {
        const rawValue = order.excel_data[durationColumnName];
        const numValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue).replace(",", "."));
        if (!isNaN(numValue)) {
          // "tg" column is already in minutes, use directly
          durationMinutes = numValue;
        }
      }

      if (durationMinutes <= 0) {
        results.push({ orderId: order.id, completionTime: null });
        continue;
      }

      // Apply efficiency
      const effectiveDuration = durationMinutes / (efficiencyPercent / 100);
      let remainingMinutes = effectiveDuration;

      // Process through shifts
      while (remainingMinutes > 0) {
        const dayOfWeek = currentTime.getDay();
        const dayShifts = shifts
          .filter((s) => s.day_of_week === dayOfWeek && s.is_active)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        // Check if working day
        const dateStr = format(currentTime, "yyyy-MM-dd");
        const customDay = customWorkdays.find((d) => d.date === dateStr);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isWorkingDay = customDay ? customDay.is_working_day : !isWeekend;

        if (!isWorkingDay || dayShifts.length === 0) {
          currentTime = new Date(currentTime);
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(0, 0, 0, 0);
          continue;
        }

        let workedToday = false;
        for (const shift of dayShifts) {
          const [startH, startM] = shift.start_time.split(":").map(Number);
          const [endH, endM] = shift.end_time.split(":").map(Number);

          const shiftStart = new Date(currentTime);
          shiftStart.setHours(startH, startM, 0, 0);
          const shiftEnd = new Date(currentTime);
          shiftEnd.setHours(endH, endM, 0, 0);

          if (currentTime < shiftStart) {
            currentTime = new Date(shiftStart);
          }

          if (currentTime >= shiftEnd) continue;

          const availableMinutes = (shiftEnd.getTime() - currentTime.getTime()) / 60000;
          if (availableMinutes <= 0) continue;

          if (remainingMinutes <= availableMinutes) {
            currentTime = new Date(currentTime.getTime() + remainingMinutes * 60000);
            remainingMinutes = 0;
            workedToday = true;
            break;
          } else {
            remainingMinutes -= availableMinutes;
            currentTime = new Date(shiftEnd);
            workedToday = true;
          }
        }

        if (remainingMinutes > 0) {
          currentTime = new Date(currentTime);
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(0, 0, 0, 0);
        }
      }

      results.push({ orderId: order.id, completionTime: new Date(currentTime) });
    }

    return results;
  };

  const handleExport = async () => {
    if (selectedMachines.length === 0) {
      toast.error("Bitte wählen Sie mindestens eine Maschine aus");
      return;
    }

    setIsExporting(true);

    try {
      const startDate = savedStartDate?.setting_value
        ? new Date(savedStartDate.setting_value as string)
        : new Date();

      // Sort column mappings by column_number to determine export order
      const sortedMappings = [...columnMappings].sort((a, b) => a.column_number - b.column_number);
      const orderedColumnNames = sortedMappings.map(m => m.column_name);

      const exportData: any[][] = [];
      
      // Create headers in column number order, plus additional columns at the end
      const headers = [
        ...orderedColumnNames,
        "Maschine",
        "Reihenfolge",
        "Priorität",
        "Voraussichtlich Fertig"
      ];
      exportData.push(headers);

      for (const machineId of selectedMachines) {
        const machine = machines.find((m) => m.id === machineId);
        if (!machine) continue;

        const machineOrders = allOrders
          .filter((o) => o.machine_id === machineId)
          .sort((a, b) => a.sequence_order - b.sequence_order);

        const machineShifts = allShifts.filter((s) => s.machine_id === machineId);

        const completionTimes = calculateCompletionTimeForExport(
          machineOrders,
          machineShifts,
          startDate,
          machine.efficiency_percent || 100,
          columnMappings,
          customWorkdays
        );

        for (const order of machineOrders) {
          const completionInfo = completionTimes.find((c) => c.orderId === order.id);
          
          // Build row in same order as headers
          const row: any[] = [];
          
          // Add excel_data columns in sorted order
          for (const colName of orderedColumnNames) {
            row.push(order.excel_data?.[colName] ?? "");
          }
          
          // Add additional columns
          row.push(machine.name);
          row.push(order.sequence_order + 1);
          row.push(order.priority === 1 ? "Ja" : "Nein");
          row.push(
            completionInfo?.completionTime
              ? format(completionInfo.completionTime, "dd.MM.yyyy HH:mm", { locale: de })
              : "Nicht berechenbar"
          );
          
          exportData.push(row);
        }
      }

      // Create worksheet from array of arrays
      const worksheet = XLSX.utils.aoa_to_sheet(exportData);
      
      // Get range for autofilter
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      
      // Add autofilter to make it filterable (this works in free SheetJS)
      worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1" };

      // Calculate column widths based on actual data content
      const colWidths = headers.map((header, colIndex) => {
        let maxWidth = String(header).length;
        // Check all data rows for this column
        for (let rowIndex = 1; rowIndex < exportData.length; rowIndex++) {
          const cellValue = String(exportData[rowIndex][colIndex] ?? "");
          maxWidth = Math.max(maxWidth, cellValue.length);
        }
        return { wch: Math.min(50, Math.max(10, maxWidth + 2)) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Aufträge");

      const filename = `Auftragsplanung_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast.success(`Export erfolgreich: ${filename}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Fehler beim Export");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Excel Export</h1>
        <p className="text-muted-foreground">
          Exportieren Sie Auftragsdaten mit berechneten Fertigstellungszeiten
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Maschinen auswählen
          </CardTitle>
          <CardDescription>
            Wählen Sie die Maschinen aus, deren Aufträge exportiert werden sollen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectedMachines.length === activeMachines.length && activeMachines.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="font-medium">
              Alle Maschinen auswählen
            </Label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeMachines.map((machine) => (
              <div key={machine.id} className="flex items-center space-x-2">
                <Checkbox
                  id={machine.id}
                  checked={selectedMachines.includes(machine.id)}
                  onCheckedChange={() => handleMachineToggle(machine.id)}
                />
                <Label htmlFor={machine.id}>{machine.name}</Label>
              </div>
            ))}
          </div>

          {activeMachines.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Keine aktiven Maschinen gefunden
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export-Informationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Die exportierte Excel-Datei enthält:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Alle Excel-Spalten in ihrer ursprünglichen Reihenfolge (nach Spaltennummer sortiert)</li>
            <li>Maschine</li>
            <li>Reihenfolge</li>
            <li>Priorität</li>
            <li><strong>Voraussichtlich Fertig</strong> (berechneter Fertigstellungszeitpunkt)</li>
          </ul>
          <p className="mt-2">Die Daten werden als formatierte Excel-Tabelle exportiert.</p>
        </CardContent>
      </Card>

      <Button
        onClick={handleExport}
        disabled={selectedMachines.length === 0 || isExporting}
        size="lg"
        className="w-full md:w-auto"
      >
        <Download className="h-4 w-4 mr-2" />
        {isExporting ? "Exportiere..." : "Excel exportieren"}
      </Button>
    </div>
  );
};

export default ExcelExport;
