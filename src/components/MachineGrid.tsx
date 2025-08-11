import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

interface SortableMachineCardProps {
  machine: any;
  onMachineClick: (machineId: string) => void;
}

const SortableMachineCard = ({ machine, onMachineClick }: SortableMachineCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: machine.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onMachineClick(machine.id)}
      >
        <CardHeader 
          className="pb-3 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <CardTitle className="text-lg">
            {machine.name}
          </CardTitle>
        </CardHeader>
        {machine.description && (
          <CardContent onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-muted-foreground">{machine.description}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export const MachineGrid = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [localMachines, setLocalMachines] = useState<any[]>([]);

  const { data: machines, isLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      return await api.getMachines();
    },
  });

  // Update local state when machines data changes
  useEffect(() => {
    if (machines) {
      setLocalMachines(machines);
    }
  }, [machines]);

  const updateDisplayOrderMutation = useMutation({
    mutationFn: async (machineUpdates: { id: string; display_order: number }[]) => {
      const promises = machineUpdates.map(update => 
        api.updateMachine(update.id, { display_order: update.display_order })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setLocalMachines((machines) => {
      const oldIndex = machines.findIndex((machine) => machine.id === active.id);
      const newIndex = machines.findIndex((machine) => machine.id === over.id);
      
      const newMachines = arrayMove(machines, oldIndex, newIndex);
      
      // Update display order in database
      const updates = newMachines.map((machine, index) => ({
        id: machine.id,
        display_order: index + 1
      }));
      
      updateDisplayOrderMutation.mutate(updates);
      
      return newMachines;
    });
  };

  const handleMachineClick = (machineId: string) => {
    navigate(`/auftragsplanung?machine=${machineId}`);
  };

  if (isLoading) {
    return <div className="text-center">Laden...</div>;
  }

  if (!localMachines || localMachines.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        Keine Maschinen vorhanden. Erstellen Sie eine Maschine in den Einstellungen.
      </div>
    );
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={localMachines.map(m => m.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {localMachines.map((machine) => (
            <SortableMachineCard
              key={machine.id}
              machine={machine}
              onMachineClick={handleMachineClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};