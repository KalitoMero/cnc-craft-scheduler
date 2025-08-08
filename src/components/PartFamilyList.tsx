import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["part-families", refreshKey],
    queryFn: async () => {
      const { data: families, error: famError } = await supabase
        .from("part_families")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });
      if (famError) throw famError;

      const { data: items, error: itemsError } = await supabase
        .from("part_family_items")
        .select("id, family_id, part_value, position")
        .order("position", { ascending: true });
      if (itemsError) throw itemsError;

      const grouped = (families || []).map((f) => ({
        family: f as FamilyRow,
        items: (items || []).filter((it) => it.family_id === f.id) as ItemRow[],
      }));
      return grouped;
    },
  });

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
    <div className="grid gap-4 md:grid-cols-2">
      {data.map(({ family, items }) => (
        <Card key={family.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{family.name}</span>
              <Badge variant="secondary">{items.length} Bauteile</Badge>
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
  );
};

export default PartFamilyList;
