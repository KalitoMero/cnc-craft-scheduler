import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getBavarianHolidays } from "@/lib/bavarianWorkdays";
import { useToast } from "@/hooks/use-toast";

interface CustomWorkday {
  id: string;
  date: string;
  is_working_day: boolean;
  note: string | null;
}

export const WorkdayCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customWorkdays = [] } = useQuery({
    queryKey: ["customWorkdays"],
    queryFn: () => api.getCustomWorkdays(),
  });

  const toggleWorkdayMutation = useMutation({
    mutationFn: async ({ date, isWorkingDay }: { date: string; isWorkingDay: boolean }) => {
      return api.upsertCustomWorkday({ date, is_working_day: isWorkingDay });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customWorkdays"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Arbeitstag konnte nicht geändert werden.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const resetMonthMutation = useMutation({
    mutationFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      return api.deleteCustomWorkdaysInRange(
        format(start, "yyyy-MM-dd"),
        format(end, "yyyy-MM-dd")
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customWorkdays"] });
      toast({
        title: "Zurückgesetzt",
        description: "Monat wurde auf Standard-Arbeitstage zurückgesetzt.",
      });
    },
  });

  const year = currentMonth.getFullYear();
  const bavarianHolidays = useMemo(() => getBavarianHolidays(year), [year]);

  const customWorkdayMap = useMemo(() => {
    const map = new Map<string, boolean>();
    customWorkdays.forEach((cw: CustomWorkday) => {
      map.set(cw.date, cw.is_working_day);
    });
    return map;
  }, [customWorkdays]);

  const isHoliday = (date: Date) => {
    return bavarianHolidays.some(
      (h) => format(h, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
  };

  const isDefaultWorkingDay = (date: Date) => {
    return !isWeekend(date) && !isHoliday(date);
  };

  const isWorkingDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (customWorkdayMap.has(dateStr)) {
      return customWorkdayMap.get(dateStr)!;
    }
    return isDefaultWorkingDay(date);
  };

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get day of week for padding (Monday = 0)
  const firstDayOfWeek = (startOfMonth(currentMonth).getDay() + 6) % 7;

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const currentlyWorking = isWorkingDay(date);
    toggleWorkdayMutation.mutate({ date: dateStr, isWorkingDay: !currentlyWorking });
  };

  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Arbeitstage Kalender</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMonthMutation.mutate()}
              disabled={resetMonthMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Monat zurücksetzen
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-lg">
            {format(currentMonth, "MMMM yyyy", { locale: de })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for padding */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {days.map((day) => {
            const working = isWorkingDay(day);
            const holiday = isHoliday(day);
            const weekend = isWeekend(day);
            const hasCustom = customWorkdayMap.has(format(day, "yyyy-MM-dd"));
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                disabled={toggleWorkdayMutation.isPending}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-md text-sm transition-colors",
                  "hover:ring-2 hover:ring-primary/50",
                  working
                    ? "bg-green-500/20 text-green-700 dark:text-green-400"
                    : "bg-red-500/20 text-red-700 dark:text-red-400",
                  holiday && !hasCustom && "ring-1 ring-orange-400",
                  weekend && !hasCustom && "opacity-60",
                  hasCustom && "ring-2 ring-primary",
                  !isSameMonth(day, currentMonth) && "opacity-30"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
        
        <div className="flex flex-wrap gap-4 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20" />
            <span>Arbeitstag</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20" />
            <span>Kein Arbeitstag</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded ring-1 ring-orange-400" />
            <span>Feiertag (Bayern)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded ring-2 ring-primary" />
            <span>Manuell geändert</span>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">
          Klicken Sie auf einen Tag, um ihn als Arbeitstag oder Nicht-Arbeitstag zu markieren. 
          Standardmäßig werden bayerische Feiertage und Wochenenden als Nicht-Arbeitstage angezeigt.
        </p>
      </CardContent>
    </Card>
  );
};
