import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Save, X, Plus } from "lucide-react";
import { ExcelColumnSettings } from "./ExcelColumnSettings";

export const SettingsPanel = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const {
    data: machines,
    isLoading
  } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      return await api.getMachines();
    }
  });
  const createMachineMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
    }) => {
      await api.createMachine({
        name: data.name,
        description: data.description || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Maschine erstellt",
        description: "Die Maschine wurde erfolgreich erstellt."
      });
      setName("");
      setDescription("");
      queryClient.invalidateQueries({
        queryKey: ["machines"]
      });
    },
    onError: error => {
      toast({
        title: "Fehler",
        description: "Die Maschine konnte nicht erstellt werden.",
        variant: "destructive"
      });
      console.error("Error creating machine:", error);
    }
  });
  const updateMachineMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description?: string;
    }) => {
      await api.updateMachine(data.id, {
        name: data.name,
        description: data.description || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Maschine aktualisiert",
        description: "Die Maschine wurde erfolgreich aktualisiert."
      });
      setEditingId(null);
      queryClient.invalidateQueries({
        queryKey: ["machines"]
      });
    },
    onError: error => {
      toast({
        title: "Fehler",
        description: "Die Maschine konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
      console.error("Error updating machine:", error);
    }
  });
  const deleteMachineMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteMachine(id);
    },
    onSuccess: () => {
      toast({
        title: "Maschine gelöscht",
        description: "Die Maschine wurde erfolgreich gelöscht."
      });
      queryClient.invalidateQueries({
        queryKey: ["machines"]
      });
    },
    onError: error => {
      toast({
        title: "Fehler",
        description: "Die Maschine konnte nicht gelöscht werden.",
        variant: "destructive"
      });
      console.error("Error deleting machine:", error);
    }
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMachineMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined
    });
  };
  const startEdit = (machine: any) => {
    setEditingId(machine.id);
    setEditName(machine.name);
    setEditDescription(machine.description || "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };
  const saveEdit = () => {
    if (!editName.trim() || !editingId) return;
    updateMachineMutation.mutate({
      id: editingId,
      name: editName.trim(),
      description: editDescription.trim() || undefined
    });
  };
  return (
    <Tabs defaultValue="machines" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="machines">Maschinen</TabsTrigger>
        <TabsTrigger value="excel-columns">Excel-Spalten</TabsTrigger>
      </TabsList>

      <TabsContent value="machines" className="space-y-6">
        {/* Create New Machine */}
        <Card>
          <CardHeader>
            <CardTitle>Neue Maschine erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="machine-name">Name der Maschine</Label>
                <Input 
                  id="machine-name" 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Maschinen-Name eingeben" 
                  required 
                />
              </div>
              
              <div>
                <Label htmlFor="machine-description">Name Datenabruf</Label>
                <Textarea 
                  id="machine-description" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Name für Datenabruf" 
                  rows={3} 
                />
              </div>
              
              <Button type="submit" disabled={!name.trim() || createMachineMutation.isPending}>
                {createMachineMutation.isPending ? "Erstelle..." : "Maschine erstellen"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Machines */}
        <Card>
          <CardHeader>
            <CardTitle>Bestehende Maschinen</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center">Laden...</div>
            ) : !machines || machines.length === 0 ? (
              <div className="text-center text-muted-foreground">
                Keine Maschinen vorhanden.
              </div>
            ) : (
              <div className="space-y-4">
                {machines.map(machine => (
                  <div key={machine.id} className="flex items-center justify-between p-4 border rounded-lg">
                    {editingId === machine.id ? (
                      <div className="flex-1 space-y-2 mr-4">
                        <Input 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)} 
                          placeholder="Maschinen-Name" 
                        />
                        <Textarea 
                          value={editDescription} 
                          onChange={e => setEditDescription(e.target.value)} 
                          placeholder="Name für Datenabruf" 
                          rows={2} 
                        />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <h3 className="font-medium">{machine.name}</h3>
                        {machine.description && (
                          <p className="text-sm text-muted-foreground">{machine.description}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {editingId === machine.id ? (
                        <>
                          <Button 
                            size="sm" 
                            onClick={saveEdit} 
                            disabled={!editName.trim() || updateMachineMutation.isPending}
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
                            onClick={() => startEdit(machine)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => deleteMachineMutation.mutate(machine.id)} 
                            disabled={deleteMachineMutation.isPending}
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
      </TabsContent>

      <TabsContent value="excel-columns">
        <ExcelColumnSettings />
      </TabsContent>
    </Tabs>
  );
};