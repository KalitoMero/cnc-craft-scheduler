import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        // Automatisch importieren
        await handleAutoImport(selectedFile);
      } else {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Excel (.xlsx, .xls) oder CSV-Datei aus.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAutoImport = async (selectedFile: File) => {
    setLoading(true);
    
    try {
      // Hole Einstellungen für BA-Nummer und Maschinen-Spalte
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['ba_column_number', 'machine_column_number']);

      if (settingsError) throw settingsError;

      const baColumnNumber = settings?.find(s => s.setting_key === 'ba_column_number')?.setting_value as number || 1;
      const machineColumnNumber = settings?.find(s => s.setting_key === 'machine_column_number')?.setting_value as number || 2;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const allRows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

          // Extrahiere einzigartige Maschinennamen
          const uniqueMachineNames = [...new Set(
            allRows
              .map(row => row[machineColumnNumber - 1])
              .filter(name => name && name.trim() !== '')
          )];

          // Hole existierende Maschinen
          const { data: existingMachines } = await supabase
            .from('machines')
            .select('id, name');

          const existingNames = existingMachines?.map(m => m.name) || [];
          const machineMap = new Map(existingMachines?.map(m => [m.name, m.id]) || []);

          // Erstelle neue Maschinen
          const newMachineNames = uniqueMachineNames.filter(name => !existingNames.includes(name));
          
          if (newMachineNames.length > 0) {
            const { data: newMachines, error: insertError } = await supabase
              .from('machines')
              .insert(
                newMachineNames.map(name => ({
                  name,
                  description: `Automatisch erstellt aus Excel-Import`,
                  is_active: true
                }))
              )
              .select();

            if (insertError) throw insertError;

            // Füge neue Maschinen zur Map hinzu
            newMachines?.forEach(machine => {
              machineMap.set(machine.name, machine.id);
            });

            toast({
              title: "Neue Maschinen erstellt",
              description: `${newMachineNames.length} neue Maschinen wurden automatisch erstellt: ${newMachineNames.join(', ')}`,
            });
          }

          // Erstelle Import-Record
          const { data: importRecord, error: importError } = await supabase
            .from('excel_imports')
            .insert({
              filename: selectedFile.name,
              file_path: `uploads/${selectedFile.name}`,
              row_count: allRows.length,
            })
            .select()
            .single();

          if (importError) throw importError;

          // Erstelle Aufträge automatisch mit Maschinen-Zuordnung
          const ordersToInsert = allRows
            .filter(row => row[machineColumnNumber - 1] && row[baColumnNumber - 1]) // Nur Zeilen mit Maschine und BA-Nummer
            .map((row, index) => {
              const machineName = row[machineColumnNumber - 1];
              const machineId = machineMap.get(machineName);
              
              return {
                machine_id: machineId,
                excel_import_id: importRecord.id,
                sequence_order: index,
                excel_data: row,
                order_number: row[baColumnNumber - 1], // BA-Nummer als Auftragsnummer
                status: 'pending'
              };
            })
            .filter(order => order.machine_id); // Nur Aufträge mit gültiger Maschinen-ID

          if (ordersToInsert.length > 0) {
            const { error: ordersError } = await supabase
              .from('orders')
              .insert(ordersToInsert);

            if (ordersError) throw ordersError;

            toast({
              title: "Import erfolgreich",
              description: `${ordersToInsert.length} Aufträge wurden automatisch importiert und den Maschinen zugeordnet.`,
            });
          } else {
            toast({
              title: "Warnung",
              description: "Keine Aufträge konnten importiert werden. Überprüfen Sie die Spalten-Konfiguration in den Einstellungen.",
              variant: "destructive",
            });
          }

          setFile(null);
        } catch (error) {
          console.error('Error in auto import:', error);
          toast({
            title: "Import-Fehler",
            description: "Die Datei konnte nicht automatisch importiert werden.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(selectedFile);
    } catch (error) {
      console.error('Error in handleAutoImport:', error);
      toast({
        title: "Fehler",
        description: "Import konnte nicht gestartet werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Excel Import</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Automatischer Aufträge-Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Laden Sie eine Excel-Datei hoch, um Aufträge automatisch zu importieren. 
              Maschinen werden automatisch erkannt und erstellt. Die Spaltenkonfiguration 
              können Sie in den Einstellungen anpassen.
            </AlertDescription>
          </Alert>
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Datei für automatischen Import</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Excel-Datei auswählen für sofortigen Import
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="max-w-xs"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
          
          {file && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {loading && (
                <div className="text-sm text-muted-foreground">
                  Importiere...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Konfiguration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Automatischer Import-Ablauf:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Excel-Datei wird analysiert</li>
                <li>Maschinen werden aus der konfigurierten Spalte erkannt</li>
                <li>Neue Maschinen werden automatisch erstellt</li>
                <li>Aufträge werden basierend auf BA-Nummer importiert</li>
                <li>Aufträge werden automatisch den Maschinen zugeordnet</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">Wichtige Hinweise:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Konfigurieren Sie die Spalten in den Einstellungen</li>
                <li>• BA-Nummer und Maschinen-Spalte müssen ausgefüllt sein</li>
                <li>• Erste Zeile sollte Spaltenüberschriften enthalten</li>
                <li>• Unterstützte Formate: Excel (.xlsx, .xls) und CSV</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}