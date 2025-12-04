import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
import { Trash2, Calendar, Search, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { MachineOrdersList } from "@/components/MachineOrdersList";
import { groupOrdersByBase, getBaseOrderNumber, getAfoNumber, type GroupedOrder } from "@/lib/orderUtils";

export const OrderPlanning = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMachineId = searchParams.get("machine");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [sortType, setSortType] = useState<'manual'>('manual');
  const [orderSequences, setOrderSequences] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [manualPositions, setManualPositions] = useState<Record<string, number>>({});
  const [productionStartDate, setProductionStartDate] = useState<Date | undefined>(undefined);
  const [productionStartTime, setProductionStartTime] = useState<string>("08:00");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved production start setting
  const { data: productionStartSetting } = useQuery({
    queryKey: ["setting", "production_start"],
    queryFn: async () => {
      return await api.getSetting("production_start");
    },
  });

  // Initialize from saved setting
  useEffect(() => {
    if (productionStartSetting?.setting_value) {
      const saved = productionStartSetting.setting_value as { date?: string; time?: string };
      if (saved.date) {
        setProductionStartDate(new Date(saved.date));
      }
      if (saved.time) {
        setProductionStartTime(saved.time);
      }
    }
  }, [productionStartSetting]);

  // Save production start setting
  const saveProductionStartMutation = useMutation({
    mutationFn: async (value: { date: string | null; time: string }) => {
      await api.putSetting({
        setting_key: "production_start",
        setting_value: value,
        description: "Produktionsstart Datum und Uhrzeit",
      });
    },
  });

  // Update handlers to save
  const handleProductionDateChange = (date: Date | undefined) => {
    setProductionStartDate(date);
    saveProductionStartMutation.mutate({
      date: date ? date.toISOString() : null,
      time: productionStartTime,
    });
  };

  const handleProductionTimeChange = (time: string) => {
    setProductionStartTime(time);
    saveProductionStartMutation.mutate({
      date: productionStartDate ? productionStartDate.toISOString() : null,
      time: time,
    });
  };

  const handleResetProductionStart = () => {
    setProductionStartDate(undefined);
    setProductionStartTime("08:00");
    saveProductionStartMutation.mutate({
      date: null,
      time: "08:00",
    });
  };

  const { data: machines, isLoading: machinesLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      return await api.getMachines();
    },
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await api.getOrders();
    },
  });

  const { data: partFamilyItems } = useQuery({
    queryKey: ["part_family_items"],
    queryFn: async () => {
      return await api.getPartFamilyItems();
    },
  });

  const { data: excelColumnMappings } = useQuery({
    queryKey: ["excel_column_mappings"],
    queryFn: async () => {
      return await api.getExcelColumnMappings();
    },
  });

  // Fetch shifts for the selected machine
  const activeMachineId = selectedMachineId || machines?.[0]?.id;
  const { data: machineShifts } = useQuery({
    queryKey: ["machine_shifts", activeMachineId],
    queryFn: async () => {
      if (!activeMachineId) return [];
      return await api.getMachineShifts(activeMachineId);
    },
    enabled: !!activeMachineId,
  });

  // Compute production start datetime
  const productionStartDateTime = useMemo(() => {
    if (!productionStartDate) return null;
    const [hours, minutes] = productionStartTime.split(':').map(Number);
    const dt = new Date(productionStartDate);
    dt.setHours(hours || 0, minutes || 0, 0, 0);
    return dt;
  }, [productionStartDate, productionStartTime]);

  const articleColumns = useMemo(() => {
    return (excelColumnMappings || [])
      .filter((c: any) => c?.is_article_number)
      .map((c: any) => String(c.column_name));
  }, [excelColumnMappings]);

  const familyByPart = useMemo(() => {
    const map: Record<string, string> = {};
    (partFamilyItems || []).forEach((item: any) => {
      const key = String(item?.part_value ?? "").trim();
      if (key) map[key] = item.family_id;
    });
    return map;
  }, [partFamilyItems]);

  const getEffectivePartNumber = (ord: any): string | undefined => {
    const direct = ord?.part_number ? String(ord.part_number).trim() : "";
    if (direct) return direct;

    // 1) Try explicitly mapped article number columns
    if (ord?.excel_data && articleColumns.length) {
      for (const col of articleColumns) {
        const val = (ord.excel_data as Record<string, any>)[col];
        const text = val !== undefined && val !== null ? String(val).trim() : "";
        if (text) return text;
      }
    }

    // 2) Heuristic fallback: scan common key names if no mapping or no value found
    if (ord?.excel_data && typeof ord.excel_data === 'object') {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const candidates = new Set([
        "artikelnr",
        "artikelnummer",
        "artikelnr", // duplicate safe
        "artnr",
        "artnr", // duplicate safe
        "artnr",
        "artnr",
        "artnr",
        "artnummer",
        "artikel",
        "teilenummer",
        "teilnummer",
        "partnumber",
        "partnr",
        "partno",
        "part",
        "materialnummer",
        "materialnr",
      ]);

      for (const [key, value] of Object.entries(ord.excel_data as Record<string, any>)) {
        const nk = normalize(key);
        if (candidates.has(nk) || nk.includes("artikelnummer") || nk.includes("teilenummer") || (nk.includes("artikel") && (nk.includes("nr") || nk.includes("nummer"))) ) {
          const text = value !== undefined && value !== null ? String(value).trim() : "";
          if (text) return text;
        }
      }
    }

    return undefined;
  };
  const deleteOrdersMutation = useMutation({
    mutationFn: async (machineId: string) => {
      await api.deleteOrdersByMachine(machineId);
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

  const reorderOrdersMutation = useMutation({
    mutationFn: async (updates: { id: string; sequence_order: number }[]) => {
      await api.reorderOrders(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Speichern",
        description: "Die Sortierung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      console.error("Error reordering orders:", error);
    },
  });

  const handleDeleteAllOrders = (machineId: string) => {
    deleteOrdersMutation.mutate(machineId);
  };

  // Import grouping functions from shared utility
  // Using imported functions: groupOrdersByBase, getBaseOrderNumber, getAfoNumber from @/lib/orderUtils

  // Extract date from order for sorting
  const getOrderDate = (order: any): Date | null => {
    if (!order.excel_data) return null;
    
    // Find the column marked as internal completion date
    const internalCompletionDateColumn = excelColumnMappings?.find(
      (c: any) => c?.is_internal_completion_date
    );
    
    if (internalCompletionDateColumn) {
      const columnName = internalCompletionDateColumn.column_name;
      const value = (order.excel_data as Record<string, any>)[columnName];
      
      if (typeof value === 'number' && value > 40000) {
        // Excel date serial number
        return new Date((value - 25569) * 86400 * 1000);
      } else if (typeof value === 'string') {
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }
    
    return null;
  };

  // Search function to filter orders
  const searchOrders = (ordersList: GroupedOrder[]): GroupedOrder[] => {
    if (!searchTerm.trim()) return ordersList;
    
    const lowercaseSearch = searchTerm.toLowerCase();
    
    return ordersList.filter(order => {
      // Search in order number
      if (order.order_number?.toLowerCase().includes(lowercaseSearch)) return true;
      
      // Search in part number
      if (order.part_number?.toLowerCase().includes(lowercaseSearch)) return true;
      
      // Search in description
      if (order.description?.toLowerCase().includes(lowercaseSearch)) return true;
      
      // Search in excel data
      if (order.excel_data && typeof order.excel_data === 'object') {
        for (const [key, value] of Object.entries(order.excel_data as Record<string, any>)) {
          if (value && String(value).toLowerCase().includes(lowercaseSearch)) return true;
        }
      }
      
      // Search in sub orders
      if (order.subOrders && Array.isArray(order.subOrders)) {
        return order.subOrders.some((subOrder: any) => 
          subOrder.order_number?.toLowerCase().includes(lowercaseSearch) ||
          subOrder.part_number?.toLowerCase().includes(lowercaseSearch) ||
          subOrder.description?.toLowerCase().includes(lowercaseSearch) ||
          (subOrder.excel_data && typeof subOrder.excel_data === 'object' && 
            Object.values(subOrder.excel_data as Record<string, any>).some(val => 
              val && String(val).toLowerCase().includes(lowercaseSearch)
            )
          )
        );
      }
      
      return false;
    });
  };

  // Handle manual position change
  const handlePositionChange = (orderId: string, newPosition: number, machineId: string) => {
    const machineOrders = getMachineOrders(machineId, false);
    const currentIndex = machineOrders.findIndex(order => order.id === orderId);
    
    if (currentIndex === -1 || newPosition < 1 || newPosition > machineOrders.length) return;
    
    const newIndex = newPosition - 1;
    if (currentIndex === newIndex) return;
    
    const newOrder = arrayMove(machineOrders, currentIndex, newIndex);
    const newSequence = newOrder.map(order => order.id);
    
    setOrderSequences(prev => ({
      ...prev,
      [machineId]: newSequence
    }));
    
    setManualPositions(prev => ({
      ...prev,
      [orderId]: newPosition
    }));

    // Save to database - include suborders with same sequence_order
    const updates: { id: string; sequence_order: number }[] = [];
    newOrder.forEach((order, index) => {
      updates.push({ id: order.id, sequence_order: index });
      // Also update suborders with the same sequence_order
      if (order.subOrders && Array.isArray(order.subOrders)) {
        order.subOrders.forEach((subOrder: any) => {
          updates.push({ id: subOrder.id, sequence_order: index });
        });
      }
    });
    reorderOrdersMutation.mutate(updates);
  };

  // Get orders for a specific machine
  const getMachineOrders = (machineId: string, applySearch: boolean = true): GroupedOrder[] => {
    const machineOrders = orders?.filter(order => order.machine_id === machineId) || [];
    
    // First, sort by database sequence_order
    machineOrders.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
    
    let groupedOrders = groupOrdersByBase(machineOrders);
    
    if (applySearch) {
      // Apply search filter first
      groupedOrders = searchOrders(groupedOrders);
    }
    
    if (orderSequences[machineId]) {
      // Sort by manual order (overrides database order)
      const sequence = orderSequences[machineId];
      groupedOrders.sort((a, b) => {
        const indexA = sequence.indexOf(a.id);
        const indexB = sequence.indexOf(b.id);
        
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });
    }
    
    return groupedOrders;
  };

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent, machineId: string) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const machineOrders = getMachineOrders(machineId, false);
      const oldIndex = machineOrders.findIndex(order => order.id === active.id);
      const newIndex = machineOrders.findIndex(order => order.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(machineOrders, oldIndex, newIndex);
        const newSequence = newOrder.map(order => order.id);
        
        setOrderSequences(prev => ({
          ...prev,
          [machineId]: newSequence
        }));

        // Save to database - include suborders with same sequence_order
        const updates: { id: string; sequence_order: number }[] = [];
        newOrder.forEach((order, index) => {
          updates.push({ id: order.id, sequence_order: index });
          // Also update suborders with the same sequence_order
          if (order.subOrders && Array.isArray(order.subOrders)) {
            order.subOrders.forEach((subOrder: any) => {
              updates.push({ id: subOrder.id, sequence_order: index });
            });
          }
        });
        reorderOrdersMutation.mutate(updates);
      }
    }
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Auftragsplanung</h1>

      {/* Production Start Input */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Produktionsstart:</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !productionStartDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {productionStartDate ? format(productionStartDate, "PPP", { locale: de }) : "Datum wählen"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={productionStartDate}
                onSelect={handleProductionDateChange}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={productionStartTime}
            onChange={(e) => handleProductionTimeChange(e.target.value)}
            className="w-[120px]"
          />
          {productionStartDate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetProductionStart}
            >
              Zurücksetzen
            </Button>
          )}
          {!productionStartDate && (
            <span className="text-xs text-muted-foreground">
              Wählen Sie Datum und Uhrzeit, um die Fertigstellungszeiten zu berechnen
            </span>
          )}
        </div>
      </Card>

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
          const fullMachineOrders = getMachineOrders(machine.id, false);
          const positionMap = new Map<string, number>(fullMachineOrders.map((o, i) => [o.id, i + 1] as [string, number]));
          
          return (
            <TabsContent key={machine.id} value={machine.id} className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div>
                        <CardTitle className="text-2xl">Aufträge für {machine.name}</CardTitle>
                        {machine.description && (
                          <p className="text-sm text-muted-foreground">{machine.description}</p>
                        )}
                      </div>
                      {/* Compact Search Field and Sort Button */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5">
                          <Search className="h-3 w-3 text-muted-foreground" />
                          <Input
                            placeholder="Suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-48 h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
                          />
                          {searchTerm && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchTerm('')}
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              Nach Fertigungsende
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Nach Fertigungsende sortieren?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Möchten Sie die Aufträge nach dem Fertigungsende sortieren? 
                                Die aktuelle manuelle Reihenfolge geht dabei verloren und kann nicht wiederhergestellt werden.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  const machineOrders = orders?.filter(order => order.machine_id === machine.id) || [];
                                  let groupedOrders = groupOrdersByBase(machineOrders);
                                  groupedOrders = searchOrders(groupedOrders);
                                  
                                  // Sort by date
                                  groupedOrders.sort((a, b) => {
                                    const dateA = getOrderDate(a);
                                    const dateB = getOrderDate(b);
                                    
                                    if (!dateA && !dateB) return 0;
                                    if (!dateA) return 1;
                                    if (!dateB) return -1;
                                    
                                    return dateA.getTime() - dateB.getTime();
                                  });
                                  
                                  // Set new sequence and clear manual positions
                                  const newSequence = groupedOrders.map(order => order.id);
                                  setOrderSequences(prev => ({
                                    ...prev,
                                    [machine.id]: newSequence
                                  }));
                                  setManualPositions({});

                                  // Save to database - include suborders with same sequence_order
                                  const updates: { id: string; sequence_order: number }[] = [];
                                  groupedOrders.forEach((order, index) => {
                                    updates.push({ id: order.id, sequence_order: index });
                                    // Also update suborders with the same sequence_order
                                    if (order.subOrders && Array.isArray(order.subOrders)) {
                                      order.subOrders.forEach((subOrder: any) => {
                                        updates.push({ id: subOrder.id, sequence_order: index });
                                      });
                                    }
                                  });
                                  reorderOrdersMutation.mutate(updates);
                                }}
                              >
                                Sortieren
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
                    <MachineOrdersList
                      machineId={machine.id}
                      machineOrders={machineOrders}
                      fullMachineOrders={fullMachineOrders}
                      positionMap={positionMap}
                      expandedOrders={expandedOrders}
                      sensors={sensors}
                      productionStartDateTime={productionStartDateTime}
                      excelColumnMappings={excelColumnMappings}
                      orders={orders}
                      familyByPart={familyByPart}
                      machineEfficiency={(machine as any).efficiency_percent || 100}
                      getEffectivePartNumber={getEffectivePartNumber}
                      getBaseOrderNumber={getBaseOrderNumber}
                      onToggleExpanded={(orderId, isOpen) => {
                        const newExpanded = new Set(expandedOrders);
                        if (isOpen) {
                          newExpanded.add(orderId);
                        } else {
                          newExpanded.delete(orderId);
                        }
                        setExpandedOrders(newExpanded);
                      }}
                      onPositionChange={(orderId, newPosition) => 
                        handlePositionChange(orderId, newPosition, machine.id)
                      }
                      onDragEnd={(event) => handleDragEnd(event, machine.id)}
                    />
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