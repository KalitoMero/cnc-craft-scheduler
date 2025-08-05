import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
      } else {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Excel (.xlsx, .xls) oder CSV-Datei aus.",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    
    try {
      // TODO: Implement Excel parsing and import logic
      toast({
        title: "Import gestartet",
        description: "Die Datei wird verarbeitet. Dies kann einen Moment dauern.",
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Import erfolgreich",
        description: `${file.name} wurde erfolgreich importiert.`,
      });
      
      setFile(null);
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
          
          {file && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? 'Importiere...' : 'Importieren'}
              </Button>
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