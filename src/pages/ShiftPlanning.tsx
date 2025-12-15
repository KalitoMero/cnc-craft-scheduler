import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plus, Trash2, UserPlus, CalendarDays, AlertCircle, Users, Palmtree, LayoutGrid } from "lucide-react";
import { format, parseISO, getISOWeek, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
  shift_model: number | null;
}


interface EmployeeSickDay {
  id: string;
  employee_id: string;
  date: string;
  note: string | null;
}

interface EmployeeVacationDay {
  id: string;
  employee_id: string;
  date: string;
  note: string | null;
}

const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// Helper to determine if an employee has early or late shift in a given week
const getShiftTypeForWeek = (shiftModel: number | null, weekNumber: number): "early" | "late" | null => {
  if (!shiftModel) return null;
  // Schicht 1: odd weeks = early, even weeks = late
  // Schicht 2: odd weeks = late, even weeks = early
  const isOddWeek = weekNumber % 2 === 1;
  if (shiftModel === 1) {
    return isOddWeek ? "early" : "late";
  } else {
    return isOddWeek ? "late" : "early";
  }
};

export default function ShiftPlanning() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sickDays, setSickDays] = useState<EmployeeSickDay[]>([]);
  const [vacationDays, setVacationDays] = useState<EmployeeVacationDay[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showSickDayDialog, setShowSickDayDialog] = useState(false);
  const [showVacationDayDialog, setShowVacationDayDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeShiftModel, setEmployeeShiftModel] = useState<string>("none");
  const [sickDate, setSickDate] = useState<Date | undefined>(undefined);
  const [sickNote, setSickNote] = useState("");
  const [vacationDate, setVacationDate] = useState<Date | undefined>(undefined);
  const [vacationNote, setVacationNote] = useState("");
  const [overviewMonth, setOverviewMonth] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesData, sickDaysData, vacationDaysData] = await Promise.all([
        api.getEmployees(),
        api.getEmployeeSickDays(),
        api.getEmployeeVacationDays(),
      ]);
      setEmployees(employeesData);
      setSickDays(sickDaysData);
      setVacationDays(vacationDaysData);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEmployee = async () => {
    if (!employeeName.trim()) {
      toast({ title: "Fehler", description: "Name ist erforderlich.", variant: "destructive" });
      return;
    }

    const shiftModelValue = employeeShiftModel === "none" ? null : parseInt(employeeShiftModel);

    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, { name: employeeName.trim(), shift_model: shiftModelValue });
        toast({ title: "Erfolg", description: "Mitarbeiter aktualisiert." });
      } else {
        await api.createEmployee({ name: employeeName.trim(), shift_model: shiftModelValue });
        toast({ title: "Erfolg", description: "Mitarbeiter angelegt." });
      }
      setShowEmployeeDialog(false);
      setEmployeeName("");
      setEmployeeShiftModel("none");
      setEditingEmployee(null);
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Mitarbeiter wirklich löschen?")) return;
    try {
      await api.deleteEmployee(id);
      if (selectedEmployee?.id === id) setSelectedEmployee(null);
      toast({ title: "Erfolg", description: "Mitarbeiter gelöscht." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };


  const handleAddSickDay = async () => {
    if (!selectedEmployee || !sickDate) return;

    try {
      await api.createEmployeeSickDay({
        employee_id: selectedEmployee.id,
        date: format(sickDate, "yyyy-MM-dd"),
        note: sickNote || undefined,
      });
      toast({ title: "Erfolg", description: "Krankheitstag eingetragen." });
      setShowSickDayDialog(false);
      setSickDate(undefined);
      setSickNote("");
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Eintragen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteSickDay = async (id: string) => {
    try {
      await api.deleteEmployeeSickDay(id);
      toast({ title: "Erfolg", description: "Krankheitstag entfernt." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleAddVacationDay = async () => {
    if (!selectedEmployee || !vacationDate) return;

    try {
      await api.createEmployeeVacationDay({
        employee_id: selectedEmployee.id,
        date: format(vacationDate, "yyyy-MM-dd"),
        note: vacationNote || undefined,
      });
      toast({ title: "Erfolg", description: "Urlaubstag eingetragen." });
      setShowVacationDayDialog(false);
      setVacationDate(undefined);
      setVacationNote("");
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Eintragen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDeleteVacationDay = async (id: string) => {
    try {
      await api.deleteEmployeeVacationDay(id);
      toast({ title: "Erfolg", description: "Urlaubstag entfernt." });
      loadData();
    } catch (error) {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };


  const getEmployeeSickDays = (employeeId: string) => {
    return sickDays.filter(sd => sd.employee_id === employeeId);
  };

  const getEmployeeVacationDays = (employeeId: string) => {
    return vacationDays.filter(vd => vd.employee_id === employeeId);
  };


  const getShiftModelLabel = (model: number | null) => {
    if (model === 1) return "Schicht 1";
    if (model === 2) return "Schicht 2";
    return "Keine";
  };


  // Overview data calculation
  const overviewStart = startOfMonth(overviewMonth);
  const overviewEnd = endOfMonth(overviewMonth);
  const overviewDays = eachDayOfInterval({ start: overviewStart, end: overviewEnd });

  const getStatusForDay = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const isSick = sickDays.some(sd => sd.employee_id === employeeId && sd.date === dateStr);
    const isVacation = vacationDays.some(vd => vd.employee_id === employeeId && vd.date === dateStr);
    return { isSick, isVacation };
  };

  const getDayStats = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const sickCount = sickDays.filter(sd => sd.date === dateStr).length;
    const vacationCount = vacationDays.filter(vd => vd.date === dateStr).length;
    return { sickCount, vacationCount };
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <h1 className="text-2xl font-bold truncate">Schichtplanung</h1>
        <Button
          onClick={() => {
            setEditingEmployee(null);
            setEmployeeName("");
            setEmployeeShiftModel("none");
            setShowEmployeeDialog(true);
          }}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Mitarbeiter anlegen
        </Button>
      </div>

      <Tabs defaultValue="employees" className="w-full min-w-0">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mitarbeiter
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Übersicht
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Employee List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Mitarbeiter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {employees.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Keine Mitarbeiter vorhanden.</p>
                ) : (
                  employees.map((emp) => {
                    const currentWeek = getISOWeek(new Date());
                    const shiftType = getShiftTypeForWeek(emp.shift_model, currentWeek);
                    return (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                          selectedEmployee?.id === emp.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        )}
                        onClick={() => setSelectedEmployee(emp)}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{emp.name}</span>
                            {emp.shift_model && (
                              <Badge variant={selectedEmployee?.id === emp.id ? "secondary" : "outline"} className="text-xs">
                                {getShiftModelLabel(emp.shift_model)}
                              </Badge>
                            )}
                          </div>
                          {shiftType && (
                            <span className={cn("text-xs", selectedEmployee?.id === emp.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                              Diese Woche: {shiftType === "early" ? "Frühschicht" : "Spätschicht"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEmployee(emp);
                              setEmployeeName(emp.name);
                              setEmployeeShiftModel(emp.shift_model?.toString() || "none");
                              setShowEmployeeDialog(true);
                            }}
                          >
                            ✏️
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmployee(emp.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Shift Assignment */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedEmployee ? `Details für ${selectedEmployee.name}` : "Mitarbeiter auswählen"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedEmployee ? (
                  <p className="text-muted-foreground">Wählen Sie links einen Mitarbeiter aus.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Shift Model Info */}
                    {selectedEmployee.shift_model && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">Schichtenmodell: {getShiftModelLabel(selectedEmployee.shift_model)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedEmployee.shift_model === 1 
                            ? "Ungerade Wochen: Frühschicht, Gerade Wochen: Spätschicht"
                            : "Ungerade Wochen: Spätschicht, Gerade Wochen: Frühschicht"}
                        </p>
                      </div>
                    )}

                    {/* Sick Days Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          Krankheitstage
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setShowSickDayDialog(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Krank eintragen
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getEmployeeSickDays(selectedEmployee.id).length === 0 ? (
                          <span className="text-sm text-muted-foreground">Keine Krankheitstage eingetragen.</span>
                        ) : (
                          getEmployeeSickDays(selectedEmployee.id).map((sd) => (
                            <Badge key={sd.id} variant="destructive" className="flex items-center gap-1">
                              {format(parseISO(sd.date), "dd.MM.yyyy", { locale: de })}
                              {sd.note && <span className="ml-1">({sd.note})</span>}
                              <button
                                className="ml-1 hover:bg-destructive-foreground/20 rounded-full p-0.5"
                                onClick={() => handleDeleteSickDay(sd.id)}
                              >
                                ✕
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Vacation Days Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Palmtree className="h-4 w-4 text-green-600" />
                          Urlaubstage
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => setShowVacationDayDialog(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Urlaub eintragen
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getEmployeeVacationDays(selectedEmployee.id).length === 0 ? (
                          <span className="text-sm text-muted-foreground">Keine Urlaubstage eingetragen.</span>
                        ) : (
                          getEmployeeVacationDays(selectedEmployee.id).map((vd) => (
                            <Badge key={vd.id} className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                              {format(parseISO(vd.date), "dd.MM.yyyy", { locale: de })}
                              {vd.note && <span className="ml-1">({vd.note})</span>}
                              <button
                                className="ml-1 hover:bg-green-800/50 rounded-full p-0.5"
                                onClick={() => handleDeleteVacationDay(vd.id)}
                              >
                                ✕
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-4 min-w-0">
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center min-w-0">
                <CardTitle className="sm:flex-1 min-w-0">Mitarbeiter-Übersicht</CardTitle>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOverviewMonth((prev) => addWeeks(prev, -4))}
                  >
                    ← Vorheriger Monat
                  </Button>
                  <span className="font-medium min-w-[120px] text-center">
                    {format(overviewMonth, "MMMM yyyy", { locale: de })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOverviewMonth((prev) => addWeeks(prev, 4))}
                  >
                    Nächster Monat →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="max-w-full overflow-x-auto pb-2">
                <table className="w-max min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sticky left-0 bg-background min-w-[150px]">Mitarbeiter</th>
                      {overviewDays.map(day => (
                        <th key={day.toISOString()} className="p-1 text-center min-w-[40px]">
                          <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: de })}</div>
                          <div>{format(day, "d")}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b">
                        <td className="p-2 sticky left-0 bg-background font-medium">
                          <div className="flex items-center gap-2">
                            {emp.name}
                            {emp.shift_model && (
                              <Badge variant="outline" className="text-xs">S{emp.shift_model}</Badge>
                            )}
                          </div>
                        </td>
                        {overviewDays.map(day => {
                          const { isSick, isVacation } = getStatusForDay(emp.id, day);
                          const weekNum = getISOWeek(day);
                          const shiftType = getShiftTypeForWeek(emp.shift_model, weekNum);
                          
                          return (
                            <td key={day.toISOString()} className="p-1 text-center">
                              {isSick ? (
                                <div className="w-6 h-6 mx-auto rounded bg-destructive text-destructive-foreground text-xs flex items-center justify-center" title="Krank">
                                  K
                                </div>
                              ) : isVacation ? (
                                <div className="w-6 h-6 mx-auto rounded bg-green-600 text-white text-xs flex items-center justify-center" title="Urlaub">
                                  U
                                </div>
                              ) : shiftType ? (
                                <div 
                                  className={cn(
                                    "w-6 h-6 mx-auto rounded text-xs flex items-center justify-center",
                                    shiftType === "early" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                                  )} 
                                  title={shiftType === "early" ? "Frühschicht" : "Spätschicht"}
                                >
                                  {shiftType === "early" ? "F" : "S"}
                                </div>
                              ) : (
                                <div className="w-6 h-6 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Summary row */}
                    <tr className="bg-muted/50 font-medium">
                      <td className="p-2 sticky left-0 bg-muted/50">Zusammenfassung</td>
                      {overviewDays.map(day => {
                        const { sickCount, vacationCount } = getDayStats(day);
                        return (
                          <td key={day.toISOString()} className="p-1 text-center text-xs">
                            {(sickCount > 0 || vacationCount > 0) && (
                              <div className="flex flex-col gap-0.5">
                                {sickCount > 0 && <span className="text-destructive">{sickCount}K</span>}
                                {vacationCount > 0 && <span className="text-green-600">{vacationCount}U</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-destructive"></div>
                  <span>K = Krank</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-600"></div>
                  <span>U = Urlaub</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100"></div>
                  <span>F = Frühschicht</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-100"></div>
                  <span>S = Spätschicht</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Name des Mitarbeiters"
              />
            </div>
            <div>
              <Label>Schichtenmodell</Label>
              <Select value={employeeShiftModel} onValueChange={setEmployeeShiftModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Schichtenmodell wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Modell</SelectItem>
                  <SelectItem value="1">Schicht 1 (KW1: Früh, KW2: Spät, ...)</SelectItem>
                  <SelectItem value="2">Schicht 2 (KW1: Spät, KW2: Früh, ...)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Schicht 1 und 2 wechseln sich wöchentlich zwischen Früh- und Spätschicht ab.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveEmployee}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sick Day Dialog */}
      <Dialog open={showSickDayDialog} onOpenChange={setShowSickDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Krankheitstag eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {sickDate ? format(sickDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={sickDate}
                    onSelect={setSickDate}
                    locale={de}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Input
                value={sickNote}
                onChange={(e) => setSickNote(e.target.value)}
                placeholder="z.B. Erkältung"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSickDayDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddSickDay} disabled={!sickDate}>
              Eintragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vacation Day Dialog */}
      <Dialog open={showVacationDayDialog} onOpenChange={setShowVacationDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Urlaubstag eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {vacationDate ? format(vacationDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={vacationDate}
                    onSelect={setVacationDate}
                    locale={de}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Input
                value={vacationNote}
                onChange={(e) => setVacationNote(e.target.value)}
                placeholder="z.B. Sommerurlaub"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVacationDayDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddVacationDay} disabled={!vacationDate}>
              Eintragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
