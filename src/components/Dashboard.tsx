import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { MachineGrid } from "./MachineGrid";
import { SettingsPanel } from "./SettingsPanel";

export const Dashboard = () => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Maschinen Dashboard</h1>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Einstellungen
          </Button>
        </div>

        {showSettings && (
          <div className="mb-8">
            <SettingsPanel />
          </div>
        )}

        <MachineGrid />
      </div>
    </div>
  );
};