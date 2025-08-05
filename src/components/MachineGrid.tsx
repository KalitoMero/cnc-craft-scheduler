import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const MachineGrid = () => {
  const navigate = useNavigate();
  const { data: machines, isLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleMachineClick = (machineId: string) => {
    navigate(`/auftragsplanung?machine=${machineId}`);
  };

  if (isLoading) {
    return <div className="text-center">Laden...</div>;
  }

  if (!machines || machines.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        Keine Maschinen vorhanden. Erstellen Sie eine Maschine in den Einstellungen.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {machines.map((machine) => (
        <Card 
          key={machine.id} 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => handleMachineClick(machine.id)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{machine.name}</CardTitle>
          </CardHeader>
          {machine.description && (
            <CardContent>
              <p className="text-sm text-muted-foreground">{machine.description}</p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};