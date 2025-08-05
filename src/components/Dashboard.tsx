import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Home, Upload } from "lucide-react";
import { MachineGrid } from "./MachineGrid";
import { SettingsPanel } from "./SettingsPanel";

export const Dashboard = () => {
  const [currentView, setCurrentView] = useState<"dashboard" | "settings" | "upload">("dashboard");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Maschinen Dashboard</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => setCurrentView("dashboard")}
              variant={currentView === "dashboard" ? "default" : "outline"}
              size="sm"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button
              onClick={() => setCurrentView("upload")}
              variant={currentView === "upload" ? "default" : "outline"}
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Daten Upload
            </Button>
            <Button
              onClick={() => setCurrentView("settings")}
              variant={currentView === "settings" ? "default" : "outline"}
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Einstellungen
            </Button>
          </div>
        </div>

        {currentView === "settings" && (
          <div className="mb-8">
            <SettingsPanel />
          </div>
        )}

        {currentView === "upload" && (
          <div className="mb-8">
            <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground">Daten Upload Bereich - wird implementiert</p>
            </div>
          </div>
        )}

        {currentView === "dashboard" && <MachineGrid />}
      </div>
    </div>
  );
};