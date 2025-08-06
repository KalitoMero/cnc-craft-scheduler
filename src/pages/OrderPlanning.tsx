import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const OrderPlanning = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMachineId = searchParams.get("machine");
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const deleteOrdersMutation = useMutation({
    mutationFn: async (machineId: string) => {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("machine_id", machineId);
      
      if (error) throw error;
    },
    onSuccess: (_, machineId) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const machineName = machines?.find(m => m.id === machineId)?.name || "Maschine";
      toast({
        title: "Aufträge gelöscht",
        description: `Alle Aufträge für ${machineName} wurden erfolgreich gelöscht.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Löschen",
        description: "Die Aufträge konnten nicht gelöscht werden. Versuchen Sie es erneut.",
        variant: "destructive",
      });
      console.error("Error deleting orders:", error);
    },
  });

  const handleDeleteAllOrders = (machineId: string) => {
    deleteOrdersMutation.mutate(machineId);
  };

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
    return orders?.filter(order => 
      order.machine_id === machineId
    ) || [];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Auftragsplanung</h1>

      <Tabs 
        value={selectedMachineId || machines[0]?.id} 
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${machines.length}, 1fr)` }}>
          {machines.map((machine) => (
            <TabsTrigger key={machine.id} value={machine.id}>
              {machine.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {machines.map((machine) => {
          const machineOrders = getMachineOrders(machine.id);
          
          return (
            <TabsContent key={machine.id} value={machine.id} className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">Aufträge für {machine.name}</CardTitle>
                      {machine.description && (
                        <p className="text-sm text-muted-foreground">{machine.description}</p>
                      )}
                    </div>
                    {machineOrders.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            disabled={deleteOrdersMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Alle Aufträge löschen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Alle Aufträge löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sind Sie sicher, dass Sie alle Aufträge für die Maschine "{machine.name}" löschen möchten? 
                              Diese Aktion kann nicht rückgängig gemacht werden und wird {machineOrders.length} Auftrag{machineOrders.length !== 1 ? 'e' : ''} unwiderruflich löschen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAllOrders(machine.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Alle löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
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
                            <div className="space-y-2">
                              <h3 className="font-medium text-lg mb-3">
                                {order.order_number || `Auftrag ${order.id.slice(0, 8)}`}
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                                {/* Standard order fields */}
                                {order.part_number && (
                                  <div className="text-sm">
                                    <span className="font-medium">Teilenummer:</span> {order.part_number}
                                  </div>
                                )}
                                {order.description && (
                                  <div className="text-sm">
                                    <span className="font-medium">Beschreibung:</span> {order.description}
                                  </div>
                                )}
                                {order.quantity && (
                                  <div className="text-sm">
                                    <span className="font-medium">Menge:</span> {order.quantity}
                                  </div>
                                )}
                                {order.priority && (
                                  <div className="text-sm">
                                    <span className="font-medium">Priorität:</span> {order.priority}
                                  </div>
                                )}
                                
                                {/* Excel data fields */}
                                {order.excel_data && typeof order.excel_data === 'object' && 
                                  Object.entries(order.excel_data as Record<string, any>).map(([key, value]) => {
                                    // Skip null, undefined, empty string, and "null" string values
                                    if (value === null || value === undefined || value === '' || value === 'null') {
                                      return null;
                                    }
                                    
                                    let displayValue = value;
                                    
                                    // Format dates for "interne Fertigungsende" or similar date fields
                                    if (key.toLowerCase().includes('fertigungsende') || key.toLowerCase().includes('ende')) {
                                      // Try to parse as date if it's a number (Excel date serial)
                                      if (typeof value === 'number' && value > 40000) {
                                        // Excel date serial number (days since 1900-01-01)
                                        const excelDate = new Date((value - 25569) * 86400 * 1000);
                                        displayValue = excelDate.toLocaleDateString('de-DE');
                                      } else if (typeof value === 'string') {
                                        // Try to parse as ISO date string
                                        const parsedDate = new Date(value);
                                        if (!isNaN(parsedDate.getTime())) {
                                          displayValue = parsedDate.toLocaleDateString('de-DE');
                                        }
                                      }
                                    } else if (typeof value === 'number' && value > 1000000) {
                                      // Handle scientific notation for large numbers
                                      displayValue = Math.round(value).toString();
                                    } else {
                                      displayValue = String(value);
                                    }
                                    
                                    return (
                                      <div key={key} className="text-sm">
                                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {displayValue}
                                      </div>
                                    );
                                  })
                                }
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default OrderPlanning;