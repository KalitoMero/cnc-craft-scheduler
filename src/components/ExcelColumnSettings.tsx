import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Save, X, Plus, Settings } from "lucide-react";

export const ExcelColumnSettings = () => {
  const [columnName, setColumnName] = useState("");
  const [columnNumber, setColumnNumber] = useState("");
  const [isBaNumber, setIsBaNumber] = useState(false);
  const [isArticleNumber, setIsArticleNumber] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColumnName, setEditColumnName] = useState("");
  const [editColumnNumber, setEditColumnNumber] = useState("");
  const [editIsBaNumber, setEditIsBaNumber] = useState(false);
  const [editIsArticleNumber, setEditIsArticleNumber] = useState(false);
  
  // Machine designation column state
  const [machineDesignationColumn, setMachineDesignationColumn] = useState("");
  
  // Machine mapping states
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [editExcelDesignation, setEditExcelDesignation] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: columnMappings, isLoading } = useQuery({
    queryKey: ["excel-column-mappings"],
    queryFn: async () => {
      return await api.getExcelColumnMappings();
    },
  });

  // Query for machines
  const { data: machines, isLoading: machinesLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      return await api.getMachines();
    },
  });

  const { data: machineMappings, isLoading: machineMappingsLoading } = useQuery({
    queryKey: ["machine-excel-mappings"],
    queryFn: async () => {
      return await api.getMachineExcelMappings();
    },
  });

  const { data: machineDesignationSetting } = useQuery({
    queryKey: ["machine-designation-column"],
    queryFn: async () => {
      const setting = await api.getSetting('machine_designation_column');
      return setting?.setting_value as string;
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async (data: {
      column_name: string;
      column_number: number;
      is_ba_number: boolean;
      is_article_number: boolean;
    }) => {
      const current = await api.getExcelColumnMappings();
      await api.putExcelColumnMappings([...(current || []), data]);
    },
    onSuccess: () => {
      toast({
        title: "Spalten-Zuordnung erstellt",
        description: "Die Spalten-Zuordnung wurde erfolgreich erstellt.",
      });
      setColumnName("");
      setColumnNumber("");
      setIsBaNumber(false);
      setIsArticleNumber(false);
      queryClient.invalidateQueries({ queryKey: ["excel-column-mappings"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Spalten-Zuordnung konnte nicht erstellt werden.",
        variant: "destructive",
      });
      console.error("Error creating column mapping:", error);
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      column_name: string;
      column_number: number;
      is_ba_number: boolean;
      is_article_number: boolean;
    }) => {
      const current = await api.getExcelColumnMappings();
      const next = (current || []).map((m: any) =>
        m.id === data.id
          ? { ...m, column_name: data.column_name, column_number: data.column_number, is_ba_number: data.is_ba_number, is_article_number: data.is_article_number }
          : m
      );
      await api.putExcelColumnMappings(next);
    },
    onSuccess: () => {
      toast({
        title: "Spalten-Zuordnung aktualisiert",
        description: "Die Spalten-Zuordnung wurde erfolgreich aktualisiert.",
      });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["excel-column-mappings"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Spalten-Zuordnung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      console.error("Error updating column mapping:", error);
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = await api.getExcelColumnMappings();
      const next = (current || []).filter((m: any) => m.id !== id);
      await api.putExcelColumnMappings(next);
    },
    onSuccess: () => {
      toast({
        title: "Spalten-Zuordnung gelöscht",
        description: "Die Spalten-Zuordnung wurde erfolgreich gelöscht.",
      });
      queryClient.invalidateQueries({ queryKey: ["excel-column-mappings"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Spalten-Zuordnung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      console.error("Error deleting column mapping:", error);
    },
  });

  const updateMachineDesignationColumnMutation = useMutation({
    mutationFn: async (columnNumber: number) => {
      await api.putSetting({
        setting_key: 'machine_designation_column',
        setting_value: String(columnNumber),
      });
    },
    onSuccess: () => {
      toast({
        title: "Maschinenbezeichnung-Spalte aktualisiert",
        description: "Die Spalte für Maschinenbezeichnungen wurde erfolgreich aktualisiert.",
      });
      queryClient.invalidateQueries({ queryKey: ["machine-designation-column"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Maschinenbezeichnung-Spalte konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      console.error("Error updating machine designation column:", error);
    },
  });

  // Mutation for creating/updating machine Excel mapping
  const upsertMachineMappingMutation = useMutation({
    mutationFn: async (data: { machine_id: string; excel_designation: string; }) => {
      const current = await api.getMachineExcelMappings();
      const rest = (current || []).filter((m: any) => m.machine_id !== data.machine_id);
      await api.putMachineExcelMappings([
        ...rest,
        { machine_id: data.machine_id, excel_designation: data.excel_designation, column_numbers: [] },
      ]);
    },
    onSuccess: () => {
      toast({
        title: "Maschinenzuordnung gespeichert",
        description: "Die Maschinenzuordnung wurde erfolgreich gespeichert.",
      });
      setEditingMachineId(null);
      queryClient.invalidateQueries({ queryKey: ["machine-excel-mappings"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Maschinenzuordnung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      console.error("Error saving machine mapping:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnName.trim() || !columnNumber.trim()) return;

    const colNum = parseInt(columnNumber);
    if (isNaN(colNum) || colNum < 1) {
      toast({
        title: "Ungültige Spaltennummer",
        description: "Die Spaltennummer muss eine positive Zahl sein.",
        variant: "destructive",
      });
      return;
    }

  createColumnMutation.mutate({
    column_name: columnName.trim(),
    column_number: colNum,
    is_ba_number: isBaNumber,
    is_article_number: isArticleNumber,
  });
  };

  const startEdit = (mapping: any) => {
    setEditingId(mapping.id);
    setEditColumnName(mapping.column_name);
    setEditColumnNumber(mapping.column_number.toString());
    setEditIsBaNumber(mapping.is_ba_number);
    setEditIsArticleNumber(!!mapping.is_article_number);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditColumnName("");
    setEditColumnNumber("");
    setEditIsBaNumber(false);
    setEditIsArticleNumber(false);
  };

  const saveEdit = () => {
    if (!editColumnName.trim() || !editColumnNumber.trim() || !editingId) return;

    const colNum = parseInt(editColumnNumber);
    if (isNaN(colNum) || colNum < 1) {
      toast({
        title: "Ungültige Spaltennummer",
        description: "Die Spaltennummer muss eine positive Zahl sein.",
        variant: "destructive",
      });
      return;
    }

  updateColumnMutation.mutate({
    id: editingId,
    column_name: editColumnName.trim(),
    column_number: colNum,
    is_ba_number: editIsBaNumber,
    is_article_number: editIsArticleNumber,
  });
  };

  // Machine designation column handlers
  const handleSaveMachineDesignationColumn = () => {
    const colNum = parseInt(machineDesignationColumn);
    if (isNaN(colNum) || colNum < 1) {
      toast({
        title: "Ungültige Spaltennummer",
        description: "Die Spaltennummer muss eine positive Zahl sein.",
        variant: "destructive",
      });
      return;
    }
    updateMachineDesignationColumnMutation.mutate(colNum);
  };

  // Machine mapping handlers
  const startMachineEdit = (machine: any) => {
    const existingMapping = machineMappings?.find(m => m.machine_id === machine.id);
    setEditingMachineId(machine.id);
    setEditExcelDesignation(existingMapping?.excel_designation || "");
  };

  const cancelMachineEdit = () => {
    setEditingMachineId(null);
    setEditExcelDesignation("");
  };

  const saveMachineMapping = () => {
    if (!editingMachineId || !editExcelDesignation.trim()) return;

    upsertMachineMappingMutation.mutate({
      machine_id: editingMachineId,
      excel_designation: editExcelDesignation.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Create New Column Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Neue Spalten-Zuordnung erstellen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="column-name">Spalten-Name</Label>
              <Input
                id="column-name"
                type="text"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="z.B. Betriebsauftragsnummer"
                required
              />
            </div>

            <div>
              <Label htmlFor="column-number">Spaltennummer</Label>
              <Input
                id="column-number"
                type="number"
                min="1"
                value={columnNumber}
                onChange={(e) => setColumnNumber(e.target.value)}
                placeholder="z.B. 1 für Spalte A, 2 für Spalte B"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-ba-number"
                checked={isBaNumber}
                onChange={(e) => setIsBaNumber(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="is-ba-number">
                Dies ist die Ba-Nummer (Betriebsauftragsnummer)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-article-number"
                checked={isArticleNumber}
                onChange={(e) => setIsArticleNumber(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="is-article-number">
                Dies ist die Artikelnummer
              </Label>
            </div>

            <Button
              type="submit"
              disabled={
                !columnName.trim() ||
                !columnNumber.trim() ||
                createColumnMutation.isPending
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              {createColumnMutation.isPending
                ? "Erstelle..."
                : "Spalten-Zuordnung erstellen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Column Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Bestehende Spalten-Zuordnungen</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center">Laden...</div>
          ) : !columnMappings || columnMappings.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Keine Spalten-Zuordnungen vorhanden.
            </div>
          ) : (
            <div className="space-y-4">
              {columnMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  {editingId === mapping.id ? (
                    <div className="flex-1 space-y-2 mr-4">
                      <Input
                        value={editColumnName}
                        onChange={(e) => setEditColumnName(e.target.value)}
                        placeholder="Spalten-Name"
                      />
                      <Input
                        type="number"
                        min="1"
                        value={editColumnNumber}
                        onChange={(e) => setEditColumnNumber(e.target.value)}
                        placeholder="Spaltennummer"
                      />
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`edit-is-ba-${mapping.id}`}
                          checked={editIsBaNumber}
                          onChange={(e) => setEditIsBaNumber(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor={`edit-is-ba-${mapping.id}`}>
                          Ba-Nummer
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`edit-is-article-${mapping.id}`}
                          checked={editIsArticleNumber}
                          onChange={(e) => setEditIsArticleNumber(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor={`edit-is-article-${mapping.id}`}>
                          Artikelnummer
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <h3 className="font-medium">
                        {mapping.column_name}
                        {mapping.is_ba_number && (
                          <span className="ml-2 px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                            Ba-Nummer
                          </span>
                        )}
                        {mapping.is_article_number && (
                          <span className="ml-2 px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                            Artikelnummer
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Spalte #{mapping.column_number}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {editingId === mapping.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={saveEdit}
                          disabled={
                            !editColumnName.trim() ||
                            !editColumnNumber.trim() ||
                            updateColumnMutation.isPending
                          }
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(mapping)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteColumnMutation.mutate(mapping.id)}
                          disabled={deleteColumnMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Machine Designation Column Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Spalte für Maschinenbezeichnungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Legen Sie fest, in welcher Spalte die Maschinenbezeichnungen in Excel zu finden sind.
            </p>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="machine-designation-column">Spaltennummer</Label>
                <Input
                  id="machine-designation-column"
                  type="number"
                  min="1"
                  value={machineDesignationColumn || machineDesignationSetting || ""}
                  onChange={(e) => setMachineDesignationColumn(e.target.value)}
                  placeholder="z.B. 1 für Spalte A, 2 für Spalte B"
                />
              </div>
              <Button
                onClick={handleSaveMachineDesignationColumn}
                disabled={
                  !machineDesignationColumn.trim() ||
                  updateMachineDesignationColumnMutation.isPending
                }
              >
                {updateMachineDesignationColumnMutation.isPending ? "Speichere..." : "Speichern"}
              </Button>
            </div>
            {machineDesignationSetting && (
              <p className="text-xs text-muted-foreground">
                Aktuell: Spalte #{machineDesignationSetting}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Machine Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Maschinenzuordnung</CardTitle>
        </CardHeader>
        <CardContent>
          {machinesLoading ? (
            <div className="text-center">Maschinen werden geladen...</div>
          ) : !machines || machines.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Keine Maschinen vorhanden. Erstellen Sie zunächst Maschinen in den Maschinensettings.
            </div>
          ) : (
            <div className="space-y-4">
              {machines.map((machine) => {
                const existingMapping = machineMappings?.find(m => m.machine_id === machine.id);
                const isEditing = editingMachineId === machine.id;
                
                return (
                  <div
                    key={machine.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{machine.name}</h3>
                      {machine.description && (
                        <p className="text-sm text-muted-foreground">{machine.description}</p>
                      )}
                      
                       {isEditing ? (
                        <div className="mt-3">
                          <div>
                            <Label htmlFor={`excel-designation-${machine.id}`}>
                              Excel-Bezeichnung
                            </Label>
                            <Input
                              id={`excel-designation-${machine.id}`}
                              value={editExcelDesignation}
                              onChange={(e) => setEditExcelDesignation(e.target.value)}
                              placeholder="Wie diese Maschine in Excel bezeichnet wird"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Geben Sie an, wie diese Maschine in der definierten Spalte für Maschinenbezeichnungen erscheint.
                            </p>
                          </div>
                        </div>
                      ) : existingMapping ? (
                        <div className="mt-2">
                          <p className="text-sm">
                            <span className="font-medium">Excel-Bezeichnung:</span> {existingMapping.excel_designation}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2">
                          Noch nicht konfiguriert
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={saveMachineMapping}
                            disabled={
                              !editExcelDesignation.trim() ||
                              upsertMachineMappingMutation.isPending
                            }
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelMachineEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startMachineEdit(machine)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
