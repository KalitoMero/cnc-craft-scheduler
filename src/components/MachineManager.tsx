import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Machine = Database['public']['Tables']['machines']['Row'];

export function MachineManager() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('name');

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
      toast({
        title: "Fehler",
        description: "Maschinen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Maschinennamen ein.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('machines')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: "Erfolgreich",
          description: "Maschine wurde aktualisiert.",
        });
      } else {
        const { error } = await supabase
          .from('machines')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          });

        if (error) throw error;

        toast({
          title: "Erfolgreich",
          description: "Maschine wurde erstellt.",
        });
      }

      setFormData({ name: '', description: '' });
      setIsCreating(false);
      setEditingId(null);
      fetchMachines();
    } catch (error) {
      console.error('Error saving machine:', error);
      toast({
        title: "Fehler",
        description: "Maschine konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (machine: Machine) => {
    setFormData({
      name: machine.name,
      description: machine.description || '',
    });
    setEditingId(machine.id);
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Maschine löschen möchten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('machines')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Maschine wurde deaktiviert.",
      });

      fetchMachines();
    } catch (error) {
      console.error('Error deleting machine:', error);
      toast({
        title: "Fehler",
        description: "Maschine konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '' });
    setIsCreating(false);
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Maschinen verwalten</h2>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Maschine
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? 'Maschine bearbeiten' : 'Neue Maschine erstellen'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Maschinenname eingeben"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optionale Beschreibung"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? 'Aktualisieren' : 'Erstellen'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {machines.map((machine) => (
          <Card key={machine.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{machine.name}</h3>
                  <Badge variant={machine.is_active ? "default" : "secondary"}>
                    {machine.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
                {machine.description && (
                  <p className="text-sm text-muted-foreground">{machine.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Erstellt: {new Date(machine.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(machine)}
                  disabled={isCreating}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(machine.id)}
                  disabled={!machine.is_active}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {machines.length === 0 && !isCreating && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Noch keine Maschinen vorhanden.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Erste Maschine erstellen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}