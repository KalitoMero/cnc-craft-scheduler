import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertTriangle, Save, Settings } from "lucide-react";

interface ProcessedOrder {
  id: string;
  baNumber: string;
  machineDesignation: string;
  machineId?: string;
  machineName?: string;
  rawData: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

interface ExcelPreviewProps {
  processedData: ProcessedOrder[];
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const ExcelPreview = ({ 
  processedData, 
  onSave, 
  onCancel, 
  isSaving 
}: ExcelPreviewProps) => {
  const validOrders = processedData.filter(order => order.isValid);
  const invalidOrders = processedData.filter(order => !order.isValid);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Datenvorschau
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{validOrders.length}</div>
              <div className="text-sm text-muted-foreground">Gültige Datensätze</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{invalidOrders.length}</div>
              <div className="text-sm text-muted-foreground">Fehlerhafte Datensätze</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{processedData.length}</div>
              <div className="text-sm text-muted-foreground">Gesamt</div>
            </div>
          </div>

          {invalidOrders.length > 0 && (
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {invalidOrders.length} Datensätze konnten nicht verarbeitet werden. 
                Nur gültige Datensätze werden importiert.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 mb-6">
            <Button 
              onClick={onSave} 
              disabled={isSaving || validOrders.length === 0}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Speichere..." : `${validOrders.length} Datensätze importieren`}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Abbrechen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Valid Orders */}
      {validOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Gültige Datensätze</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BA-Nummer</TableHead>
                    <TableHead>Maschine</TableHead>
                    <TableHead>Zusätzliche Daten</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.baNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          <span>{order.machineName || order.machineDesignation}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {Object.entries(order.rawData)
                            .filter(([key, value]) => value && key !== 'baNumber' && key !== 'machineDesignation')
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <div key={key} className="text-xs text-muted-foreground">
                                {key}: {String(value)}
                              </div>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Gültig
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Invalid Orders */}
      {invalidOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Fehlerhafte Datensätze</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BA-Nummer</TableHead>
                    <TableHead>Maschine</TableHead>
                    <TableHead>Fehler</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invalidOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.baNumber || "Nicht gefunden"}
                      </TableCell>
                      <TableCell>
                        {order.machineDesignation || "Nicht gefunden"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {order.errors.map((error, index) => (
                            <div key={index} className="text-xs text-red-600">
                              {error}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          Fehlerhaft
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};