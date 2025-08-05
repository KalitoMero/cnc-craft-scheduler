import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MachineColumn } from "@/components/MachineColumn";
import type { Database } from "@/integrations/supabase/types";

type Machine = Database['public']['Tables']['machines']['Row'];

export function MachineBoard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Keine Maschinen verfügbar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Bitte fügen Sie zunächst Maschinen hinzu, bevor Sie Aufträge planen können.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Auftragsplanung</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {machines.map((machine) => (
          <MachineColumn key={machine.id} machine={machine} />
        ))}
      </div>
    </div>
  );
}