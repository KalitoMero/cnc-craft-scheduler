import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { api } from "@/lib/api";
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Calendar, Clock } from "lucide-react";
import { SortableOrderCard } from "@/components/SortableOrderCard";
import { useProductionSchedule, type ScheduledOrder } from "@/hooks/useProductionSchedule";

interface MachineOrdersListProps {
  machineId: string;
  machineOrders: any[];
  fullMachineOrders: any[];
  positionMap: Map<string, number>;
  expandedOrders: Set<string>;
  sensors: any;
  productionStartDateTime: Date | null;
  excelColumnMappings: any[] | undefined;
  orders: any[] | undefined;
  familyByPart: Record<string, string>;
  machineEfficiency: number;
  getEffectivePartNumber: (order: any) => string | undefined;
  getBaseOrderNumber: (orderNumber: string) => string;
  onToggleExpanded: (orderId: string, isOpen: boolean) => void;
  onPositionChange: (orderId: string, newPosition: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export const MachineOrdersList = ({
  machineId,
  machineOrders,
  fullMachineOrders,
  positionMap,
  expandedOrders,
  sensors,
  productionStartDateTime,
  excelColumnMappings,
  orders,
  familyByPart,
  machineEfficiency,
  getEffectivePartNumber,
  getBaseOrderNumber,
  onToggleExpanded,
  onPositionChange,
  onDragEnd,
}: MachineOrdersListProps) => {
  // Fetch shifts for this machine
  const { data: machineShifts } = useQuery({
    queryKey: ["machine_shifts", machineId],
    queryFn: () => api.getMachineShifts(machineId),
  });

  // Fetch custom workdays
  const { data: customWorkdays = [] } = useQuery({
    queryKey: ["customWorkdays"],
    queryFn: () => api.getCustomWorkdays(),
  });

  // Calculate production schedule with efficiency factor and custom workdays
  const schedule = useProductionSchedule(
    fullMachineOrders,
    machineShifts || [],
    productionStartDateTime,
    excelColumnMappings,
    machineEfficiency,
    customWorkdays
  );

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <Calendar className="h-4 w-4" />
        <span className="text-sm font-medium">Sortierung: Manuell (Drag & Drop)</span>
        <span className="text-xs text-muted-foreground">
          Ziehen Sie die Aufträge per Drag & Drop, um die Reihenfolge zu ändern
        </span>
      </div>

      {/* Orders List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={machineOrders.map(order => order.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {machineOrders.map((order, index) => {
              const currentPart = getEffectivePartNumber(order);
              const currentFamily = currentPart ? familyByPart[currentPart] : undefined;
              const base = order.order_number ? getBaseOrderNumber(order.order_number) : '';
              
              const followUpOrders = currentFamily
                ? (orders || []).filter((o) => {
                    if (o.id === order.id) return false;
                    const part = getEffectivePartNumber(o);
                    if (!part) return false;
                    if (familyByPart[part] !== currentFamily) return false;
                    const otherBase = o.order_number ? getBaseOrderNumber(o.order_number) : '';
                    if (otherBase && base && otherBase === base) return false;
                    return true;
                  })
                : [];
              
              const sameArticleOrders = currentPart
                ? (orders || []).filter((o) => {
                    if (o.id === order.id) return false;
                    const part = getEffectivePartNumber(o);
                    if (!part) return false;
                    if (String(part) !== String(currentPart)) return false;
                    const otherBase = o.order_number ? getBaseOrderNumber(o.order_number) : '';
                    if (otherBase && base && otherBase === base) return false;
                    return true;
                  })
                : [];
              
              const scheduledInfo = schedule.get(order.id);
              
              return (
                <SortableOrderCard
                  key={order.id}
                  order={order}
                  index={(positionMap.get(order.id) ?? (index + 1)) - 1}
                  totalOrders={fullMachineOrders.length}
                  expandedOrders={expandedOrders}
                  followUpOrders={followUpOrders}
                  sameArticleOrders={sameArticleOrders}
                  scheduledEndTime={scheduledInfo?.endTime}
                  scheduledDuration={scheduledInfo?.durationMinutes}
                  onToggleExpanded={onToggleExpanded}
                  onPositionChange={onPositionChange}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
