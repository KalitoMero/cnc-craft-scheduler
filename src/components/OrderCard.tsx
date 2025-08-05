import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Order = Database['public']['Tables']['orders']['Row'];

interface OrderCardProps {
  order: Order;
  index: number;
  onUpdate: () => void;
}

export function OrderCard({ order, index, onUpdate }: OrderCardProps) {
  const { toast } = useToast();

  const statusLabels = {
    pending: 'Wartend',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    on_hold: 'Pausiert',
  };

  const statusColors = {
    pending: 'secondary',
    in_progress: 'default',
    completed: 'outline',
    on_hold: 'destructive',
  } as const;

  const updateOrderSequence = async (newSequence: number) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ sequence_order: newSequence })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Reihenfolge aktualisiert",
        description: "Die Auftragsreihenfolge wurde erfolgreich geändert.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating sequence:', error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const updateOrderStatus = async (status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Status aktualisiert",
        description: `Auftrag auf "${statusLabels[status as keyof typeof statusLabels]}" gesetzt.`,
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Fehler",
        description: "Der Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="relative group">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                #{index + 1}
              </span>
              <Badge variant={statusColors[order.status as keyof typeof statusColors]} className="text-xs">
                {statusLabels[order.status as keyof typeof statusLabels]}
              </Badge>
            </div>
            
            {order.order_number && (
              <div className="font-medium text-sm truncate">
                {order.order_number}
              </div>
            )}
            
            {order.part_number && (
              <div className="text-xs text-muted-foreground truncate">
                Teil: {order.part_number}
              </div>
            )}
            
            {order.quantity && (
              <div className="text-xs text-muted-foreground">
                Menge: {order.quantity}
              </div>
            )}
            
            {order.priority > 0 && (
              <div className="text-xs font-medium text-primary">
                Priorität: {order.priority}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => updateOrderSequence(Math.max(0, order.sequence_order - 1))}
                disabled={index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => updateOrderSequence(order.sequence_order + 1)}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => updateOrderStatus('pending')}>
                  Wartend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateOrderStatus('in_progress')}>
                  In Bearbeitung
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateOrderStatus('completed')}>
                  Abgeschlossen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateOrderStatus('on_hold')}>
                  Pausiert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}