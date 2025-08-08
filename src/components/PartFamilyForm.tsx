import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PartFamilyFormProps {
  onCreated?: () => void;
}

const PartFamilyForm: React.FC<PartFamilyFormProps> = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parts, setParts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setParts([""]);
    setSaving(false);
  };

  const handleAddPart = () => setParts((p) => [...p, ""]);

  const handleChangePart = (idx: number, value: string) => {
    setParts((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const handleRemovePart = (idx: number) => {
    setParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStart = () => {
    setOpen(true);
    if (parts.length === 0) setParts([""]);
  };

  const handleCancel = () => {
    resetForm();
    setOpen(false);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const cleanParts = parts.map((p) => p.trim()).filter(Boolean);

    if (!trimmedName) {
      toast.error("Bitte einen Namen für die Teilefamilie eingeben.");
      return;
    }
    if (cleanParts.length === 0) {
      toast.error("Bitte mindestens ein Bauteil angeben.");
      return;
    }

    setSaving(true);
    try {
      const { data: family, error: familyError } = await supabase
        .from("part_families")
        .insert({ name: trimmedName })
        .select("id")
        .maybeSingle();

      if (familyError || !family?.id) {
        throw familyError || new Error("Konnte Teilefamilie nicht anlegen.");
      }

      const items = cleanParts.map((value, index) => ({
        family_id: family.id,
        part_value: value,
        position: index,
      }));

      const { error: itemsError } = await supabase
        .from("part_family_items")
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success("Teilefamilie wurde erstellt.");
      onCreated?.();
      resetForm();
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teilefamilie anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Legen Sie eine neue Teilefamilie an und fügen Sie Bauteile hinzu.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStart}>
            <Plus /> Neue Teilefamilie
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neue Teilefamilie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="family-name">Name der Teilefamilie</Label>
          <Input
            id="family-name"
            placeholder="z. B. Gehäuse-Variante A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label>Bauteile</Label>
          <div className="space-y-3">
            {parts.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder={`Bauteil ${idx + 1}`}
                  value={val}
                  onChange={(e) => handleChangePart(idx, e.target.value)}
                />
                {parts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleRemovePart(idx)}
                    aria-label="Bauteil entfernen"
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={handleAddPart}>
            <Plus /> Weiteres Bauteil
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          <Check /> Abschließen
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PartFamilyForm;
