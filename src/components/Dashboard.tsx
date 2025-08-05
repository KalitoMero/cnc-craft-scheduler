import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MachineBoard } from "@/components/MachineBoard";
import { MachineManager } from "@/components/MachineManager";
import { ExcelImport } from "@/components/ExcelImport";
import { SettingsPanel } from "@/components/SettingsPanel";

export type DashboardView = 'dashboard' | 'machines' | 'import' | 'settings';

export function Dashboard() {
  const [currentView, setCurrentView] = useState<DashboardView>('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <MachineBoard />;
      case 'machines':
        return <MachineManager />;
      case 'import':
        return <ExcelImport />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <MachineBoard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 flex flex-col">
          <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold text-card-foreground">
              Auftragsplanung
            </h1>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}