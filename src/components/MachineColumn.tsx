import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { OrderCard } from "@/components/OrderCard";
import type { Database } from "@/integrations/supabase/types";

type Machine = Database['public']['Tables']['machines']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

interface MachineColumnProps {
  machine: Machine;
}

export function MachineColumn({ machine }: MachineColumnProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [machine.id]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('machine_id', machine.id)
        .order('sequence_order');

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    pending: 'bg-secondary',
    in_progress: 'bg-accent',
    completed: 'bg-primary',
    on_hold: 'bg-destructive',
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>{machine.name}</span>
          <Badge variant="outline">
            {orders.length} Aufträge
          </Badge>
        </CardTitle>
        {machine.description && (
          <p className="text-sm text-muted-foreground">{machine.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground py-4">
            Laden...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border-2 border-dashed border-border rounded-lg">
            Keine Aufträge
          </div>
        ) : (
          orders.map((order, index) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              index={index}
              onUpdate={fetchOrders}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}