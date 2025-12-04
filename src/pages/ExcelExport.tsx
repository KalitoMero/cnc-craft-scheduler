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
import { calculateCompletionTime, findNextShiftStart } from "@/hooks/useProductionSchedule";
import { groupOrdersByBase, getBaseOrderNumber } from "@/lib/orderUtils";
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

  // Helper function to get order duration (same logic as useProductionSchedule)
  const getOrderDuration = (order: any, durationColumnName: string | null): number => {
    if (!order.excel_data) return 0;
    
    // Column names that contain hours (need to multiply by 60)
    const hoursColumnPatterns = ['zeit', 'stunden', 'hours', 'dauer', 'duration'];
    
    // Check if a column name is an hours column
    const isHoursColumn = (colName: string): boolean => {
      const lowerName = colName.toLowerCase();
      return hoursColumnPatterns.some(pattern => lowerName.includes(pattern));
    };
    
    // First try the explicitly configured column
    if (durationColumnName) {
      const value = order.excel_data[durationColumnName];
      if (value !== undefined && value !== null) {
        const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
        if (!isNaN(num) && num > 0) {
          // Check if this is an hours column - convert to minutes
          if (isHoursColumn(durationColumnName)) {
            return Math.max(0, Math.round(num * 60));
          }
          return Math.max(0, num);
        }
      }
    }
    
    // Fallback: Look for common duration column names
    // "tg" is in minutes, "Zeit" is in hours (needs conversion)
    const minutesColumns = ['tg', 'minuten', 'min', 'dauer_min'];
    
    // Try minutes columns first (tg has priority)
    for (const col of minutesColumns) {
      const value = order.excel_data[col];
      if (value !== undefined && value !== null) {
        const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
        if (!isNaN(num) && num > 0) {
          return Math.max(0, num);
        }
      }
    }
    
    // Try "Zeit" column specifically (in hours, convert to minutes)
    const zeitValue = order.excel_data['Zeit'] ?? order.excel_data['zeit'];
    if (zeitValue !== undefined && zeitValue !== null) {
      const num = typeof zeitValue === "number" ? zeitValue : parseFloat(String(zeitValue).replace(",", "."));
      if (!isNaN(num) && num > 0) {
        return Math.max(0, Math.round(num * 60));
      }
    }
    
    return 0;
  };

  const calculateCompletionTimeForExport = (
    orders: any[],
    shifts: any[],
    startDate: Date,
    efficiencyPercent: number,
    columnMappings: any[],
    customWorkdays: any[]
  ) => {
    const durationMapping = columnMappings.find((m: any) => m.is_order_duration);
    const durationColumnName = durationMapping?.column_name || null;

    const efficiencyFactor = Math.max(1, Math.min(100, efficiencyPercent)) / 100;
    
    // Start from next available shift (same as useProductionSchedule)
    let currentTime = findNextShiftStart(startDate, shifts, customWorkdays);
    const results: { orderId: string; completionTime: Date | null }[] = [];

    for (const order of orders) {
      const baseDuration = getOrderDuration(order, durationColumnName);
      
      if (baseDuration <= 0) {
        results.push({ orderId: order.id, completionTime: null });
        continue;
      }

      // Apply efficiency (same formula as useProductionSchedule)
      const effectiveDuration = efficiencyFactor > 0 ? Math.round(baseDuration / efficiencyFactor) : baseDuration;
      
      // Use the shared calculateCompletionTime function
      const completionTime = calculateCompletionTime(currentTime, effectiveDuration, shifts, customWorkdays);
      
      results.push({ orderId: order.id, completionTime });
      
      // Next order starts where this one ends
      currentTime = completionTime;
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

        // Group orders the same way as OrderPlanning does
        const groupedOrders = groupOrdersByBase(machineOrders);

        // Calculate completion times for grouped orders (main orders only)
        const completionTimes = calculateCompletionTimeForExport(
          groupedOrders,
          machineShifts,
          startDate,
          machine.efficiency_percent || 100,
          columnMappings,
          customWorkdays
        );

        // Create a map of base order number -> completion time
        const completionTimeByBase = new Map<string, Date | null>();
        for (const groupedOrder of groupedOrders) {
          const completionInfo = completionTimes.find((c) => c.orderId === groupedOrder.id);
          const baseNumber = getBaseOrderNumber(groupedOrder.order_number);
          completionTimeByBase.set(baseNumber, completionInfo?.completionTime || null);
        }

        for (const order of machineOrders) {
          // Get completion time from main order (same base number)
          const baseNumber = getBaseOrderNumber(order.order_number);
          const completionTime = completionTimeByBase.get(baseNumber);
          
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
            completionTime
              ? format(completionTime, "dd.MM.yyyy HH:mm", { locale: de })
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
