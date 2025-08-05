import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const OrderPlanning = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMachineId = searchParams.get("machine");

  const { data: machines, isLoading: machinesLoading } = useQuery({
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

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("priority", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  if (machinesLoading || ordersLoading) {
    return <div className="text-center p-8">Laden...</div>;
  }

  if (!machines || machines.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Keine Maschinen vorhanden. Erstellen Sie zuerst Maschinen in den Einstellungen.
      </div>
    );
  }

  const handleTabChange = (machineId: string) => {
    setSearchParams({ machine: machineId });
  };

  const getMachineOrders = (machineId: string) => {
    return orders?.filter(order => order.machine_id === machineId) || [];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Auftragsplanung</h1>

      <div className="flex gap-6">
        {/* Maschinen Navigation */}
        <div className="w-64 space-y-2">
          {machines.map((machine) => (
            <Button
              key={machine.id}
              onClick={() => handleTabChange(machine.id)}
              variant={selectedMachineId === machine.id || (!selectedMachineId && machine.id === machines[0]?.id) ? "default" : "outline"}
              className="w-full justify-start"
            >
              {machine.name}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {machines.map((machine) => {
            const isActive = selectedMachineId === machine.id || (!selectedMachineId && machine.id === machines[0]?.id);
            const machineOrders = getMachineOrders(machine.id);
            
            if (!isActive) return null;
            
            return (
              <Card key={machine.id}>
                <CardHeader>
                  <CardTitle>Aufträge für {machine.name}</CardTitle>
                  {machine.description && (
                    <p className="text-sm text-muted-foreground">{machine.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {machineOrders.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      Keine Aufträge für diese Maschine vorhanden.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {machineOrders.map((order) => (
                        <Card key={order.id} className="border-l-4 border-l-primary">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium">
                                  {order.order_number || `Auftrag ${order.id.slice(0, 8)}`}
                                </h3>
                                {order.part_number && (
                                  <p className="text-sm text-muted-foreground">
                                    Teilenummer: {order.part_number}
                                  </p>
                                )}
                                {order.description && (
                                  <p className="text-sm mt-1">{order.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  Priorität: {order.priority}
                                </div>
                                {order.quantity && (
                                  <div className="text-sm text-muted-foreground">
                                    Menge: {order.quantity}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                  Status: {order.status}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderPlanning;