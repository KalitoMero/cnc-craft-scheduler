import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Save, X, Plus } from "lucide-react";

export const ExcelColumnSettings = () => {
  const [columnName, setColumnName] = useState("");
  const [columnNumber, setColumnNumber] = useState("");
  const [isBaNumber, setIsBaNumber] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColumnName, setEditColumnName] = useState("");
  const [editColumnNumber, setEditColumnNumber] = useState("");
  const [editIsBaNumber, setEditIsBaNumber] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: columnMappings, isLoading } = useQuery({
    queryKey: ["excel-column-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excel_column_mappings")
        .select("*")
        .order("column_number");
      if (error) throw error;
      return data;
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async (data: {
      column_name: string;
      column_number: number;
      is_ba_number: boolean;
    }) => {
      const { error } = await supabase
        .from("excel_column_mappings")
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Spalten-Zuordnung erstellt",
        description: "Die Spalten-Zuordnung wurde erfolgreich erstellt.",
      });
      setColumnName("");
      setColumnNumber("");
      setIsBaNumber(false);
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
    }) => {
      const { error } = await supabase
        .from("excel_column_mappings")
        .update({
          column_name: data.column_name,
          column_number: data.column_number,
          is_ba_number: data.is_ba_number,
        })
        .eq("id", data.id);
      if (error) throw error;
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
      const { error } = await supabase
        .from("excel_column_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
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
    });
  };

  const startEdit = (mapping: any) => {
    setEditingId(mapping.id);
    setEditColumnName(mapping.column_name);
    setEditColumnNumber(mapping.column_number.toString());
    setEditIsBaNumber(mapping.is_ba_number);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditColumnName("");
    setEditColumnNumber("");
    setEditIsBaNumber(false);
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
    </div>
  );
};
