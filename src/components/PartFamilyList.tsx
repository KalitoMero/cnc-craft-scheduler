import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

interface PartFamilyListProps {
  refreshKey?: number;
}

interface FamilyRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  family_id: string;
  part_value: string;
  position: number;
}

const PartFamilyList: React.FC<PartFamilyListProps> = ({ refreshKey = 0 }) => {
  const queryClient = useQueryClient();
  const [editingFamily, setEditingFamily] = useState<FamilyRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["part-families", refreshKey],
    queryFn: async () => {
      const families = await api.getPartFamilies();
      const items = await api.getPartFamilyItems();
      const grouped = (families || []).map((f: any) => ({
        family: f as FamilyRow,
        items: (items || []).filter((it: any) => it.family_id === f.id) as ItemRow[],
      }));
      return grouped;
    },
  });

  const openEdit = (family: FamilyRow, items: ItemRow[]) => {
    setEditingFamily(family);
    setEditName(family.name);
    const values = items.map((i) => i.part_value);
    setEditItems(values.length > 0 ? values : [""]);
  };

  const closeEdit = () => {
    setEditingFamily(null);
    setEditName("");
    setEditItems([]);
    setSaving(false);
  };

  const addItem = () => setEditItems((p) => [...p, ""]);
  const changeItem = (idx: number, val: string) => setEditItems((p) => p.map((v, i) => (i === idx ? val : v)));
  const removeItem = (idx: number) => setEditItems((p) => p.filter((_, i) => i !== idx));

  const saveEdit = async () => {
    if (!editingFamily) return;
    const trimmedName = editName.trim();
    const cleanParts = editItems.map((p) => p.trim()).filter(Boolean);

    if (!trimmedName) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }

    setSaving(true);
    try {
      await api.updatePartFamily(editingFamily.id, { name: trimmedName });
      await api.replaceFamilyItems(editingFamily.id, cleanParts);

      toast.success("Teilefamilie aktualisiert.");
      closeEdit();
      queryClient.invalidateQueries({ queryKey: ["part-families"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Fehler beim Speichern.");
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bestehende Teilefamilien</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Lade Teilefamilien…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bestehende Teilefamilien</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Fehler beim Laden.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bestehende Teilefamilien</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Noch keine Teilefamilien vorhanden.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map(({ family, items }) => (
          <Card key={family.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{family.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{items.length} Artikelnummern</Badge>
                  <Button size="sm" variant="outline" onClick={() => openEdit(family, items)} aria-label="Bearbeiten">
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {family.description && (
                <p className="mb-3 text-sm text-muted-foreground">{family.description}</p>
              )}
              <ul className="list-disc pl-5">
                {items.map((it) => (
                  <li key={it.id} className="text-sm">
                    {it.part_value}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingFamily} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teilefamilie bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name der Teilefamilie"
              />
            </div>

            <div className="space-y-3">
              <Label>Artikelnummern</Label>
              <div className="space-y-3">
                {editItems.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder={`Artikelnummer ${idx + 1}`}
                      value={val}
                      onChange={(e) => changeItem(idx, e.target.value)}
                    />
                    {editItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeItem(idx)}
                        aria-label="Artikelnummer entfernen"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" onClick={addItem}>
                <Plus className="w-4 h-4" /> Weitere Artikelnummer
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PartFamilyList;
