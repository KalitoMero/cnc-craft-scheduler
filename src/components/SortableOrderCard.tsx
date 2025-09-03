
import { useState, useEffect } from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GripVertical, ChevronDown, ChevronRight, MapPin, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface SortableOrderCardProps {
  order: any;
  index: number;
  expandedOrders: Set<string>;
  onToggleExpanded: (orderId: string, isOpen: boolean) => void;
  onPositionChange?: (orderId: string, newPosition: number) => void;
  totalOrders: number;
  followUpOrders?: any[];
  sameArticleOrders?: any[];
}

export const SortableOrderCard = ({ 
  order, 
  index, 
  expandedOrders, 
  onToggleExpanded,
  onPositionChange,
  totalOrders,
  followUpOrders = [],
  sameArticleOrders = []
}: SortableOrderCardProps) => {
  const [positionInputValue, setPositionInputValue] = useState((index + 1).toString());
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const [isPriority, setIsPriority] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const handleQuickPosition = (position: number) => {
    const clamped = Math.max(1, Math.min(totalOrders, position));
    setPositionInputValue(clamped.toString());
    onPositionChange?.(order.id, clamped);
    setQuickSelectOpen(false);
  };

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: () => api.deleteOrder(order.id),
    onSuccess: () => {
      toast({
        title: "Auftrag gelöscht",
        description: `Auftrag ${order.order_number || order.id.slice(0, 8)} wurde erfolgreich gelöscht.`,
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => {
      toast({
        title: "Fehler beim Löschen",
        description: "Der Auftrag konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteOrderMutation.mutate();
    setShowDeleteDialog(false);
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
          className="p-4"
        >
          <div className="flex items-start gap-3">
            {/* Position Number with Quick Selection */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <Input
                value={positionInputValue}
                onChange={(e) => setPositionInputValue(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={handlePositionSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePositionSubmit();
                    e.currentTarget.blur();
                  }
                }}
                className="w-12 h-8 text-center text-sm font-bold p-1 cursor-pointer [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                type="number"
                min="1"
                max={totalOrders}
              />
              {/* Quick Position Selector */}
              <Popover open={quickSelectOpen} onOpenChange={setQuickSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 rounded-full hover:bg-muted"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Schnellauswahl Position"
                  >
                    <MapPin className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-12 p-1" 
                  align="center"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="flex flex-col gap-1">
                    {[1, 2, 3, 4, 5].map((pos) => (
                      <Button
                        key={pos}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-8 text-xs p-0 hover:bg-muted"
                        onClick={() => {
                          handleQuickPosition(pos);
                        }}
                      >
                        {pos}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Drag Handle Visual Indicator */}
            <div 
              className="flex-shrink-0 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
              aria-label="Reihenfolge ändern"
              role="button"
            >
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
                        {isPriority && (
                          <Badge variant="destructive" className="h-6 px-2 py-0">PRIO</Badge>
                        )}
                        {Array.isArray(followUpOrders) && followUpOrders.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Aufträge in gleicher Teilefamilie anzeigen"
                              >
                                <Badge variant="outline" className="h-6 px-2 py-0 cursor-pointer inline-flex items-center text-primary border-primary bg-primary/10 hover:bg-primary/15">
                                  Teilefamilie ({followUpOrders.length})
                                </Badge>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent align="start" side="right" className="w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
                              <div className="text-sm font-medium mb-2">Aufträge in gleicher Teilefamilie</div>
                              <div className="space-y-1 max-h-64 overflow-auto">
                                {followUpOrders.map((fo: any) => (
                                  <div key={fo.id} className="text-sm">
                                    <span className="font-medium">{fo.order_number || `Auftrag ${fo.id.slice(0, 8)}`}</span>
                                    {fo.part_number && <span className="text-muted-foreground"> · Artikel: {fo.part_number}</span>}
                                  </div>
                                ))}
                              </div>
</PopoverContent>
                          </Popover>
                        )}
                        {Array.isArray(sameArticleOrders) && sameArticleOrders.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Aufträge mit gleicher Artikelnummer anzeigen"
                              >
                                <Badge variant="outline" className="h-6 px-2 py-0 cursor-pointer inline-flex items-center text-primary border-primary bg-primary/10 hover:bg-primary/15">
                                  Folge ({sameArticleOrders.length})
                                </Badge>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent align="start" side="right" className="w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
                              <div className="text-sm font-medium mb-2">Aufträge mit gleicher Artikelnummer</div>
                              <div className="space-y-1 max-h-64 overflow-auto">
                                {sameArticleOrders.map((fo: any) => (
                                  <div key={fo.id} className="text-sm">
                                    <span className="font-medium">{fo.order_number || `Auftrag ${fo.id.slice(0, 8)}`}</span>
                                    {fo.part_number && <span className="text-muted-foreground"> · Artikel: {fo.part_number}</span>}
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
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
                            {isPriority && (
                              <Badge variant="destructive" className="ml-2 h-5 px-2 py-0 align-middle">PRIO</Badge>
                            )}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Weitere Aktionen"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4} onCloseAutoFocus={(e) => e.preventDefault()}>
                        {!isPriority ? (
                          <DropdownMenuItem onSelect={() => setIsPriority(true)}>
                            Prio benennen
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setIsPriority(false)}>
                            Prio aufheben
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onSelect={() => setShowDeleteDialog(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Auftrag "{order.order_number || order.id.slice(0, 8)}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
