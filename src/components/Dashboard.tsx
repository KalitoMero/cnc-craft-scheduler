import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Home, Upload } from "lucide-react";
import { MachineGrid } from "./MachineGrid";
import { SettingsPanel } from "./SettingsPanel";
import { UploadPanel } from "./UploadPanel";

export const Dashboard = () => {
  const [currentView, setCurrentView] = useState<"dashboard" | "settings" | "upload">("dashboard");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-card border-r p-6">
        <h2 className="text-xl font-bold mb-6">Navigation</h2>
        <div className="space-y-2">
          <Button
            onClick={() => setCurrentView("dashboard")}
            variant={currentView === "dashboard" ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button
            onClick={() => setCurrentView("upload")}
            variant={currentView === "upload" ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Upload className="w-4 h-4 mr-2" />
            Daten Upload
          </Button>
          <Button
            onClick={() => setCurrentView("settings")}
            variant={currentView === "settings" ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Settings className="w-4 h-4 mr-2" />
            Einstellungen
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Maschinen Dashboard</h1>

          {currentView === "settings" && (
            <SettingsPanel />
          )}

          {currentView === "upload" && (
            <UploadPanel />
          )}

          {currentView === "dashboard" && <MachineGrid />}
        </div>
      </div>
    </div>
  );
};