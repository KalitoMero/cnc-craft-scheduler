import { useState, useEffect } from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GripVertical, ChevronDown, ChevronRight } from "lucide-react";

interface SortableOrderCardProps {
  order: any;
  index: number;
  expandedOrders: Set<string>;
  onToggleExpanded: (orderId: string, isOpen: boolean) => void;
  onPositionChange?: (orderId: string, newPosition: number) => void;
  totalOrders: number;
}

export const SortableOrderCard = ({ 
  order, 
  index, 
  expandedOrders, 
  onToggleExpanded,
  onPositionChange,
  totalOrders
}: SortableOrderCardProps) => {
  const [positionInputValue, setPositionInputValue] = useState((index + 1).toString());

  // Update position input when index changes
  useEffect(() => {
    setPositionInputValue((index + 1).toString());
  }, [index]);

  const handlePositionSubmit = () => {
    const newPosition = parseInt(positionInputValue);
    if (!isNaN(newPosition) && newPosition >= 1 && newPosition <= totalOrders && onPositionChange) {
      onPositionChange(order.id, newPosition);
    } else {
      // Reset to current position if invalid
      setPositionInputValue((index + 1).toString());
    }
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className="border-l-4 border-l-primary">
        <CardContent 
          {...attributes} 
          {...listeners}
          className="p-4 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-start gap-3">
            {/* Editable Position Number */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <Input
                value={positionInputValue}
                onChange={(e) => setPositionInputValue(e.target.value)}
                onBlur={handlePositionSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePositionSubmit();
                    e.currentTarget.blur();
                  }
                }}
                className="w-12 h-8 text-center text-sm font-bold p-1 cursor-pointer"
                type="number"
                min="1"
                max={totalOrders}
              />
            </div>
            
            {/* Drag Handle Visual Indicator */}
            <div className="flex-shrink-0 p-1 hover:bg-muted rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Order Content */}
            <div className="flex-1">
              <Collapsible
                open={expandedOrders.has(order.id)}
                onOpenChange={(open) => onToggleExpanded(order.id, open)}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-lg font-medium mb-3 flex items-center gap-2">
                        <span>{order.order_number || `Auftrag ${order.id.slice(0, 8)}`}</span>
                        {order.hasSubOrders && (
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 cursor-pointer"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {expandedOrders.has(order.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                      
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
                       
                        {/* Excel data fields */}
                        {order.excel_data && typeof order.excel_data === 'object' && 
                          Object.entries(order.excel_data as Record<string, any>).map(([key, value]) => {
                            // Skip null, undefined, empty string, and "null" string values
                            if (value === null || value === undefined || value === '' || value === 'null') {
                              return null;
                            }
                            
                            // Skip "Ba Nummer" field since it's already shown as header
                            if (key.toLowerCase().includes('ba nummer') || key.toLowerCase().includes('banummer')) {
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
                  </div>

                  {/* Sub-orders (other AFOs) */}
                  {order.hasSubOrders && (
                    <CollapsibleContent className="space-y-2">
                      <div className="border-t pt-4 mt-4">
                        <div className="text-sm font-medium text-muted-foreground mb-3">
                          Weitere Arbeitsfolgen:
                        </div>
                        <div className="space-y-3">
                          {order.subOrders.map((subOrder: any) => (
                            <div key={subOrder.id} className="pl-4 border-l-2 border-muted bg-muted/20 rounded-r p-3">
                              <div className="text-sm font-medium mb-2">
                                AFO: {subOrder.order_number}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                                {subOrder.description && (
                                  <div>
                                    <span className="font-medium">Beschreibung:</span> {subOrder.description}
                                  </div>
                                )}
                                {subOrder.quantity && (
                                  <div>
                                    <span className="font-medium">Menge:</span> {subOrder.quantity}
                                  </div>
                                )}
                                {/* Excel data for sub orders */}
                                {subOrder.excel_data && typeof subOrder.excel_data === 'object' && 
                                  Object.entries(subOrder.excel_data as Record<string, any>).map(([key, value]) => {
                                    if (value === null || value === undefined || value === '' || value === 'null') {
                                      return null;
                                    }
                                    
                                    let displayValue = value;
                                    
                                    if (key.toLowerCase().includes('fertigungsende') || key.toLowerCase().includes('ende')) {
                                      if (typeof value === 'number' && value > 40000) {
                                        const excelDate = new Date((value - 25569) * 86400 * 1000);
                                        displayValue = excelDate.toLocaleDateString('de-DE');
                                      } else if (typeof value === 'string') {
                                        const parsedDate = new Date(value);
                                        if (!isNaN(parsedDate.getTime())) {
                                          displayValue = parsedDate.toLocaleDateString('de-DE');
                                        }
                                      }
                                    } else if (typeof value === 'number' && value > 1000000) {
                                      displayValue = Math.round(value).toString();
                                    } else {
                                      displayValue = String(value);
                                    }
                                    
                                    return (
                                      <div key={key}>
                                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {displayValue}
                                      </div>
                                    );
                                  })
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};