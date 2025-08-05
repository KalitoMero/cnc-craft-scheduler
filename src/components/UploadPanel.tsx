import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, File, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const UploadPanel = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Check if it's an Excel file
      const isExcelFile = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                          file.type === 'application/vnd.ms-excel' ||
                          file.name.endsWith('.xlsx') ||
                          file.name.endsWith('.xls');
      
      if (isExcelFile) {
        setSelectedFile(file);
        toast({
          title: "Datei ausgewählt",
          description: `${file.name} wurde ausgewählt`,
        });
      } else {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Excel-Datei (.xlsx oder .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast({
        title: "Datei ausgewählt",
        description: `${file.name} wurde ausgewählt`,
      });
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const processFile = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      // TODO: Implement Excel processing logic
      toast({
        title: "Verarbeitung gestartet",
        description: "Die Excel-Datei wird verarbeitet...",
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Erfolgreich verarbeitet",
        description: "Die Excel-Datei wurde erfolgreich importiert",
      });
      
      setSelectedFile(null);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Die Datei konnte nicht verarbeitet werden",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

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
                  Unterstützte Formate: .xlsx, .xls
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

          {/* Selected File Display */}
          {selectedFile && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <File className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={processFile}
                      disabled={isProcessing}
                      size="sm"
                    >
                      {isProcessing ? "Verarbeite..." : "Importieren"}
                    </Button>
                    <Button
                      onClick={removeFile}
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};