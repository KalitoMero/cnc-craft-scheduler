import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, AlertCircle, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ColumnMapping {
  columnIndex: number;
  columnLetter: string;
  fieldName: string;
  displayName: string;
}

interface ExcelData {
  headers: string[];
  rows: string[][];
}

const FIELD_OPTIONS = [
  { value: 'none', label: 'Nicht zuordnen' },
  { value: 'order_number', label: 'Auftragsnummer' },
  { value: 'part_number', label: 'Teilenummer' },
  { value: 'quantity', label: 'Menge' },
  { value: 'priority', label: 'Priorität' },
  { value: 'description', label: 'Beschreibung' },
];

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [machines, setMachines] = useState<Array<{id: string, name: string}>>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchMachines();
  }, []);

  const getColumnLetter = (index: number): string => {
    let result = '';
    let temp = index;
    while (temp >= 0) {
      result = String.fromCharCode(65 + (temp % 26)) + result;
      temp = Math.floor(temp / 26) - 1;
    }
    return result;
  };

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name')
        .eq('is_active', true);

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const createMachinesFromExcel = async (excelData: ExcelData) => {
    try {
      // Hole die Maschinen-Spaltennummer aus den Einstellungen
      const { data: settings, error } = await supabase
        .from('settings')
        .select('setting_value')
        .eq('setting_key', 'machine_column_number')
        .single();

      if (error || !settings) {
        console.log('Keine Maschinen-Spalte konfiguriert');
        return;
      }

      const machineColumnIndex = (settings.setting_value as number) - 1; // Konvertiere zu 0-basiertem Index
      
      // Extrahiere einzigartige Maschinennamen aus der Excel-Datei
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const allRows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
          
          const uniqueMachineNames = [...new Set(
            allRows
              .map(row => row[machineColumnIndex])
              .filter(name => name && name.trim() !== '')
          )];

          // Hole existierende Maschinen
          const { data: existingMachines } = await supabase
            .from('machines')
            .select('name');

          const existingNames = existingMachines?.map(m => m.name) || [];
          
          // Erstelle nur neue Maschinen
          const newMachineNames = uniqueMachineNames.filter(name => !existingNames.includes(name));
          
          if (newMachineNames.length > 0) {
            const { error: insertError } = await supabase
              .from('machines')
              .insert(
                newMachineNames.map(name => ({
                  name,
                  description: `Automatisch erstellt aus Excel-Import`,
                  is_active: true
                }))
              );

            if (insertError) throw insertError;

            toast({
              title: "Neue Maschinen erstellt",
              description: `${newMachineNames.length} neue Maschinen wurden automatisch erstellt: ${newMachineNames.join(', ')}`,
            });

            // Aktualisiere die Maschinenliste
            fetchMachines();
          }
        } catch (error) {
          console.error('Error creating machines from excel:', error);
        }
      };
      reader.readAsText(file!);
    } catch (error) {
      console.error('Error in createMachinesFromExcel:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setExcelData(null);
        setColumnMappings([]);
      } else {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Excel (.xlsx, .xls) oder CSV-Datei aus.",
          variant: "destructive",
        });
      }
    }
  };

  const parseExcelFile = async () => {
    if (!file) return;

    setParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0]?.split(',').map(h => h.trim()) || [];
          const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

          const data: ExcelData = { headers, rows: rows.slice(0, 10) };
          setExcelData(data);

          const mappings: ColumnMapping[] = headers.map((header, index) => ({
            columnIndex: index,
            columnLetter: getColumnLetter(index),
            fieldName: '',
            displayName: header
          }));
          setColumnMappings(mappings);

          // Automatisch Maschinen aus Excel erstellen
          createMachinesFromExcel(data);
        } catch (error) {
          throw new Error('Fehler beim Parsen der Datei');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Fehler",
        description: "Die Datei konnte nicht geparst werden.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const updateColumnMapping = (columnIndex: number, field: 'fieldName' | 'displayName', value: string) => {
    setColumnMappings(prev => prev.map(mapping => 
      mapping.columnIndex === columnIndex 
        ? { ...mapping, [field]: value }
        : mapping
    ));
  };

  const handleImport = async () => {
    if (!file || !excelData || !selectedMachine) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Datei, ordnen Sie Spalten zu und wählen Sie eine Maschine.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const allRows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

          const { data: importRecord, error: importError } = await supabase
            .from('excel_imports')
            .insert({
              filename: file.name,
              file_path: `uploads/${file.name}`,
              row_count: allRows.length,
            })
            .select()
            .single();

          if (importError) throw importError;

          const ordersToInsert = allRows.map((row, index) => {
            const orderData: any = {
              machine_id: selectedMachine,
              excel_import_id: importRecord.id,
              sequence_order: index,
              excel_data: row,
            };

            columnMappings.forEach(mapping => {
              if (mapping.fieldName && mapping.fieldName !== 'none' && row[mapping.columnIndex]) {
                let value: any = row[mapping.columnIndex];
                if (mapping.fieldName === 'quantity' || mapping.fieldName === 'priority') {
                  value = parseInt(value) || 0;
                }
                orderData[mapping.fieldName] = value;
              }
            });

            return orderData;
          });

          const { error: ordersError } = await supabase
            .from('orders')
            .insert(ordersToInsert);

          if (ordersError) throw ordersError;

          toast({
            title: "Import erfolgreich",
            description: `${ordersToInsert.length} Aufträge wurden importiert.`,
          });

          setFile(null);
          setExcelData(null);
          setColumnMappings([]);
          setSelectedMachine('');
        } catch (error) {
          throw error;
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing file:', error);
      toast({
        title: "Import-Fehler",
        description: "Die Datei konnte nicht importiert werden.",
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
          <CardTitle>Aufträge aus Excel importieren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unterstützte Formate: Excel (.xlsx, .xls) und CSV-Dateien.
              Die erste Zeile sollte Spaltenüberschriften enthalten.
            </AlertDescription>
          </Alert>
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Datei auswählen</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ziehen Sie eine Datei hierher oder klicken Sie zum Auswählen
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="max-w-xs"
                />
              </div>
            </div>
          </div>
          
          {file && !excelData && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                onClick={parseExcelFile}
                disabled={parsing}
              >
                <Eye className="w-4 h-4 mr-2" />
                {parsing ? 'Lade Vorschau...' : 'Vorschau anzeigen'}
              </Button>
            </div>
          )}
          
          {excelData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Spalten zuordnen</h4>
                <p className="text-sm text-muted-foreground">
                  Vorschau der ersten {excelData.rows.length} Zeilen
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Zielmaschine auswählen</Label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Maschine auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Spalte</TableHead>
                      <TableHead className="w-48">Zuordnung</TableHead>
                      <TableHead className="w-48">Anzeigename</TableHead>
                      <TableHead>Vorschau</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columnMappings.map((mapping) => (
                      <TableRow key={mapping.columnIndex}>
                        <TableCell className="font-mono text-sm">
                          {mapping.columnLetter}
                          <span className="text-muted-foreground ml-1">
                            ({mapping.columnIndex + 1})
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.fieldName}
                            onValueChange={(value) => updateColumnMapping(mapping.columnIndex, 'fieldName', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Feld wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={mapping.displayName}
                            onChange={(e) => updateColumnMapping(mapping.columnIndex, 'displayName', e.target.value)}
                            placeholder="Anzeigename..."
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{excelData.headers[mapping.columnIndex]}</div>
                            {excelData.rows.slice(0, 3).map((row, index) => (
                              <div key={index} className="text-xs text-muted-foreground truncate">
                                {row[mapping.columnIndex] || '-'}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {setExcelData(null); setColumnMappings([])}}>
                  Abbrechen
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || !selectedMachine}
                >
                  {loading ? 'Importiere...' : 'Aufträge importieren'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Erwartete Spalten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Erforderliche Spalten:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Maschinennname</li>
                <li>• Auftragsnummer</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Optionale Spalten:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Teilenummer</li>
                <li>• Beschreibung</li>
                <li>• Menge</li>
                <li>• Priorität</li>
                <li>• Status</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}