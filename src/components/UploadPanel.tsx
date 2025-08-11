import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, File, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExcelPreview } from "@/components/ExcelPreview";
import * as XLSX from 'xlsx';

interface ProcessedOrder {
  id: string;
  baNumber: string;
  partNumber: string;
  machineDesignation: string;
  machineId?: string;
  machineName?: string;
  rawData: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export const UploadPanel = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedOrder[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch column mappings
  const { data: columnMappings } = useQuery({
    queryKey: ["excel-column-mappings"],
    queryFn: async () => {
      return await api.getExcelColumnMappings();
    },
  });

  // Fetch machine mappings
  const { data: machineMappings } = useQuery({
    queryKey: ["machine-excel-mappings"],
    queryFn: async () => {
      return await api.getMachineExcelMappings();
    },
  });

  // Fetch machine designation column setting
  const { data: machineDesignationColumn } = useQuery({
    queryKey: ["machine-designation-column"],
    queryFn: async () => {
      const setting = await api.getSetting('machine_designation_column');
      return parseInt(setting?.setting_value as string);
    },
  });

  const processExcelFile = async (file: File) => {
    return new Promise<ProcessedOrder[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (!columnMappings || !machineMappings || !machineDesignationColumn) {
            reject(new Error("Konfiguration nicht vollständig. Bitte überprüfen Sie die Excel-Spalten-Einstellungen."));
            return;
          }

          const processedOrders: ProcessedOrder[] = [];
          
          // Skip header row
          for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
            const row = jsonData[rowIndex];
            if (!row || row.length === 0) continue;

            const order: ProcessedOrder = {
              id: `row_${rowIndex}`,
              baNumber: "",
              partNumber: "",
              machineDesignation: "",
              rawData: {},
              isValid: true,
              errors: [],
            };

            // Extract data based on column mappings
            columnMappings.forEach(mapping => {
              const cellValue = row[mapping.column_number - 1]; // Excel columns are 1-indexed
              if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
                order.rawData[mapping.column_name] = cellValue;
                
                if (mapping.is_ba_number) {
                  order.baNumber = String(cellValue);
                }
                if (mapping.is_article_number) {
                  order.partNumber = String(cellValue);
                }
              }
            });

            // Extract machine designation
            if (machineDesignationColumn && row[machineDesignationColumn - 1]) {
              order.machineDesignation = String(row[machineDesignationColumn - 1]);
            }

            // Validate required fields
            if (!order.baNumber) {
              order.isValid = false;
              order.errors.push("BA-Nummer nicht gefunden");
            }

            if (!order.machineDesignation) {
              order.isValid = false;
              order.errors.push("Maschinenbezeichnung nicht gefunden");
            }

            // Find matching machine
            if (order.machineDesignation) {
              const machineMapping = machineMappings.find(m => 
                m.excel_designation.toLowerCase() === order.machineDesignation.toLowerCase()
              );
              
              if (machineMapping) {
                order.machineId = machineMapping.machine_id;
                // optional: machine name not joined in API
              } else {
                order.isValid = false;
                order.errors.push(`Keine Maschine für "${order.machineDesignation}" gefunden`);
              }
            }

            processedOrders.push(order);
          }

          resolve(processedOrders);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Fehler beim Lesen der Datei"));
      reader.readAsArrayBuffer(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Check if it's an Excel file
      const isExcelFile = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                          file.type === 'application/vnd.ms-excel' ||
                          file.name.endsWith('.xlsx') ||
                          file.name.endsWith('.xls');
      
      if (isExcelFile) {
        setSelectedFile(file);
        setIsProcessing(true);
        
        try {
          const processed = await processExcelFile(file);
          setProcessedData(processed);
          setShowPreview(true);
          
          toast({
            title: "Datei verarbeitet",
            description: `${processed.length} Datensätze gefunden`,
          });
        } catch (error) {
          toast({
            title: "Verarbeitungsfehler",
            description: error instanceof Error ? error.message : "Unbekannter Fehler",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      } else {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Excel-Datei (.xlsx oder .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast, columnMappings, machineMappings, machineDesignationColumn]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsProcessing(true);
      
      try {
        const processed = await processExcelFile(file);
        setProcessedData(processed);
        setShowPreview(true);
        
        toast({
          title: "Datei verarbeitet",
          description: `${processed.length} Datensätze gefunden`,
        });
      } catch (error) {
        toast({
          title: "Verarbeitungsfehler",
          description: error instanceof Error ? error.message : "Unbekannter Fehler",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setProcessedData([]);
    setShowPreview(false);
  };

  // Helper function to extract base order number (without AFO)
  const getBaseOrderNumber = (orderNumber: string): string => {
    // Check if order number matches pattern: 9 digits.point.2 digits
    const match = orderNumber.match(/^(\d{2}\.\d{3}\.\d{4})\.\d{2}$/);
    return match ? match[1] : orderNumber;
  };

  // Save mutation
  const saveOrdersMutation = useMutation({
    mutationFn: async (orders: ProcessedOrder[]) => {
      const validOrders = orders.filter(order => order.isValid);
      const payload = {
        filename: selectedFile?.name || 'unknown.xlsx',
        file_path: null,
        orders: validOrders.map(o => ({
          order_number: o.baNumber,
          part_number: o.partNumber || null,
          machine_id: o.machineId!,
          excel_data: o.rawData,
        })),
      };
      const result = await api.bulkImport(payload);
      return result; // { newCount, skippedCount }
    },
    onSuccess: (result: any) => {
      const { newCount = 0, skippedCount = 0 } = result || {};
      let message = "";
      if (newCount > 0 && skippedCount > 0) {
        message = `${newCount} neue Aufträge importiert, ${skippedCount} bereits vorhandene übersprungen`;
      } else if (newCount > 0) {
        message = `${newCount} neue Aufträge erfolgreich importiert`;
      } else {
        message = `Alle ${skippedCount} Aufträge bereits vorhanden - keine neuen Aufträge hinzugefügt`;
      }
      toast({ title: "Import abgeschlossen", description: message });
      setSelectedFile(null);
      setProcessedData([]);
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      toast({ title: "Import-Fehler", description: "Die Aufträge konnten nicht gespeichert werden", variant: "destructive" });
      console.error("Error saving orders:", error);
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    saveOrdersMutation.mutate(processedData);
  };

  const handleCancel = () => {
    setShowPreview(false);
    setProcessedData([]);
  };

  if (showPreview) {
    return (
      <ExcelPreview
        processedData={processedData}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isSaving || saveOrdersMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Excel Daten Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drag & Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary">Excel-Datei hier ablegen...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Excel-Datei hier ablegen oder klicken zum Auswählen
                </p>
                <p className="text-sm text-muted-foreground">
                  Unterstützte Formate: .xlsx, .xls (automatische Verarbeitung)
                </p>
              </div>
            )}
          </div>

          {/* Alternative Upload Button */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">oder</p>
            <Button variant="outline" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Datei auswählen
              </label>
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Processing State */}
          {isProcessing && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <div>
                    <p className="font-medium">Datei wird verarbeitet...</p>
                    <p className="text-sm text-muted-foreground">
                      Excel-Daten werden analysiert und zugeordnet
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected File Display */}
          {selectedFile && !isProcessing && !showPreview && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <File className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB - Bereit für Verarbeitung
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={removeFile}
                    variant="outline"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};