import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Clock, Edit2, Copy, ClipboardPaste } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Machine {
  id: string;
  name: string;
  description: string | null;
  efficiency_percent: number;
}

interface Shift {
  id: string;
  machine_id: string;
  day_of_week: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  hours: number;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 0, label: "Sonntag" },
];

const ShiftManagement = () => {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [efficiencyInput, setEfficiencyInput] = useState<string>("100");
  const [savingEfficiency, setSavingEfficiency] = useState(false);
  const [copiedShifts, setCopiedShifts] = useState<{
    shifts: Shift[];
    sourceMachineName: string;
  } | null>(null);
  
  // Form state
  const [shiftName, setShiftName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [hours, setHours] = useState<number>(8);

  // Calculate hours from start and end time
  const calculateHours = (start: string, end: string): number => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Handle overnight shifts
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    const diffMinutes = endMinutes - startMinutes;
    return Math.round((diffMinutes / 60) * 100) / 100; // Round to 2 decimals
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setHours(calculateHours(value, endTime));
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    setHours(calculateHours(startTime, value));
  };

  useEffect(() => {
    loadMachines();
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      loadShifts(selectedMachine.id);
      setEfficiencyInput(String(selectedMachine.efficiency_percent || 100));
    }
  }, [selectedMachine]);

  const loadMachines = async () => {
    try {
      const data = await api.getMachines();
      setMachines(data);
      setLoading(false);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Maschinen konnten nicht geladen werden",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const loadShifts = async (machineId: string) => {
    try {
      const data = await api.getMachineShifts(machineId);
      setShifts(data);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Schichten konnten nicht geladen werden",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setShiftName("");
    setDayOfWeek(1);
    setStartTime("06:00");
    setEndTime("14:00");
    setHours(8);
    setEditingShift(null);
  };

  const openEditDialog = (shift: Shift) => {
    setEditingShift(shift);
    setShiftName(shift.shift_name);
    setDayOfWeek(shift.day_of_week);
    setStartTime(shift.start_time.slice(0, 5));
    setEndTime(shift.end_time.slice(0, 5));
    setHours(shift.hours);
    setDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!selectedMachine || !shiftName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte einen Schichtnamen eingeben",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingShift) {
        await api.updateMachineShift(editingShift.id, {
          shift_name: shiftName,
          start_time: startTime,
          end_time: endTime,
          hours: hours,
        });
        toast({
          title: "Erfolg",
          description: "Schicht wurde aktualisiert",
        });
      } else {
        await api.createMachineShift({
          machine_id: selectedMachine.id,
          day_of_week: dayOfWeek,
          shift_name: shiftName,
          start_time: startTime,
          end_time: endTime,
          hours: hours,
        });
        toast({
          title: "Erfolg",
          description: "Schicht wurde erstellt",
        });
      }
      
      setDialogOpen(false);
      resetForm();
      loadShifts(selectedMachine.id);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Schicht konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm("Schicht wirklich löschen?")) return;
    
    try {
      await api.deleteMachineShift(shiftId);
      toast({
        title: "Erfolg",
        description: "Schicht wurde gelöscht",
      });
      if (selectedMachine) {
        loadShifts(selectedMachine.id);
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Schicht konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const handleSaveEfficiency = async () => {
    if (!selectedMachine) return;
    
    const value = parseInt(efficiencyInput);
    if (isNaN(value) || value < 1 || value > 100) {
      toast({
        title: "Fehler",
        description: "Wirkungsgrad muss zwischen 1 und 100 liegen",
        variant: "destructive",
      });
      return;
    }

    setSavingEfficiency(true);
    try {
      await api.updateMachine(selectedMachine.id, { efficiency_percent: value });
      
      // Update local state
      setMachines(prev => prev.map(m => 
        m.id === selectedMachine.id ? { ...m, efficiency_percent: value } : m
      ));
      setSelectedMachine(prev => prev ? { ...prev, efficiency_percent: value } : null);
      
      toast({
        title: "Erfolg",
        description: "Wirkungsgrad wurde gespeichert",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Wirkungsgrad konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
    setSavingEfficiency(false);
  };

  const getShiftsForDay = (day: number) => {
    return shifts.filter(s => s.day_of_week === day);
  };

  const handleCopyShifts = async (machine: Machine) => {
    try {
      const machineShifts = await api.getMachineShifts(machine.id);
      setCopiedShifts({
        shifts: machineShifts,
        sourceMachineName: machine.name,
      });
      toast({
        title: "Kopiert",
        description: `${machineShifts.length} Schichten von "${machine.name}" kopiert`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Schichten konnten nicht kopiert werden",
        variant: "destructive",
      });
    }
  };

  const handlePasteShifts = async (targetMachine: Machine) => {
    if (!copiedShifts) return;
    
    try {
      for (const shift of copiedShifts.shifts) {
        await api.createMachineShift({
          machine_id: targetMachine.id,
          day_of_week: shift.day_of_week,
          shift_name: shift.shift_name,
          start_time: shift.start_time,
          end_time: shift.end_time,
          hours: shift.hours,
        });
      }
      
      toast({
        title: "Eingefügt",
        description: `${copiedShifts.shifts.length} Schichten in "${targetMachine.name}" eingefügt`,
      });
      
      if (selectedMachine?.id === targetMachine.id) {
        loadShifts(targetMachine.id);
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Schichten konnten nicht eingefügt werden",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Lade Daten...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schichtzuordnung</h1>
        <p className="text-muted-foreground">
          Verwalten Sie die Schichten für jede Maschine
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Machine List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Maschinen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {machines.map((machine) => (
                <Button
                  key={machine.id}
                  variant={selectedMachine?.id === machine.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedMachine(machine)}
                >
                  {machine.name}
                </Button>
              ))}
              {machines.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine Maschinen vorhanden
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shift Configuration */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {selectedMachine ? `Schichten: ${selectedMachine.name}` : "Maschine auswählen"}
            </CardTitle>
            {selectedMachine && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyShifts(selectedMachine)}
                  title="Schichtplan kopieren"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Kopieren
                </Button>
                {copiedShifts && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePasteShifts(selectedMachine)}
                    title={`Schichtplan von "${copiedShifts.sourceMachineName}" einfügen`}
                  >
                    <ClipboardPaste className="w-4 h-4 mr-2" />
                    Einfügen
                  </Button>
                )}
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Schicht hinzufügen
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingShift ? "Schicht bearbeiten" : "Neue Schicht erstellen"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Wochentag</Label>
                      <Select
                        value={String(dayOfWeek)}
                        onValueChange={(v) => setDayOfWeek(Number(v))}
                        disabled={!!editingShift}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day.value} value={String(day.value)}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Schichtname</Label>
                      <Input
                        value={shiftName}
                        onChange={(e) => setShiftName(e.target.value)}
                        placeholder="z.B. Frühschicht, Spätschicht"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Startzeit</Label>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => handleStartTimeChange(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Endzeit</Label>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => handleEndTimeChange(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Arbeitsstunden (automatisch berechnet)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={hours}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => {
                        setDialogOpen(false);
                        resetForm();
                      }}>
                        Abbrechen
                      </Button>
                      <Button onClick={handleSaveShift}>
                        {editingShift ? "Speichern" : "Erstellen"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedMachine ? (
              <p className="text-muted-foreground text-center py-8">
                Bitte wählen Sie eine Maschine aus der Liste aus
              </p>
            ) : (
              <div className="space-y-4">
                {/* Efficiency Setting */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium whitespace-nowrap">Wirkungsgrad:</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={efficiencyInput}
                        onChange={(e) => setEfficiencyInput(e.target.value)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <Button 
                        size="sm" 
                        onClick={handleSaveEfficiency}
                        disabled={savingEfficiency}
                      >
                        {savingEfficiency ? "..." : "Speichern"}
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      (z.B. 50% = aus 8h Schicht werden 4h effektive Maschinenlaufzeit)
                    </span>
                  </div>
                </div>

                {DAYS_OF_WEEK.map((day) => {
                  const dayShifts = getShiftsForDay(day.value);
                  return (
                    <div key={day.value} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-3">{day.label}</h3>
                      {dayShifts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Keine Schichten konfiguriert
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dayShifts.map((shift) => (
                            <div
                              key={shift.id}
                              className="flex items-center justify-between bg-muted/50 rounded-md p-3"
                            >
                              <div className="flex items-center gap-4">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <span className="font-medium">{shift.shift_name}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                  </span>
                                </div>
                                <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                                  {shift.hours}h
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditDialog(shift)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteShift(shift.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ShiftManagement;
