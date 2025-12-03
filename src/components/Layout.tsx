import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, Upload, Calendar, Package, Clock, BarChart3 } from "lucide-react";

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-card border-r p-6">
        <h2 className="text-xl font-bold mb-6">Navigation</h2>
        <div className="space-y-2">
          <Button
            onClick={() => navigate("/auftragsplanung")}
            variant={isActive("/auftragsplanung") ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Auftragsplanung
          </Button>
          <Button
            onClick={() => navigate("/upload")}
            variant={isActive("/upload") ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Upload className="w-4 h-4 mr-2" />
            Daten Upload
          </Button>
          <Button
            onClick={() => navigate("/folgeauftrag")}
            variant={isActive("/folgeauftrag") ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Package className="w-4 h-4 mr-2" />
            Teilefamilie
          </Button>
          <Button
            onClick={() => navigate("/schichtzuordnung")}
            variant={isActive("/schichtzuordnung") ? "default" : "outline"}
            className="w-full justify-start"
          >
            <Clock className="w-4 h-4 mr-2" />
            Schichtzuordnung
          </Button>
          <Button
            onClick={() => navigate("/kapazitaetsanalyse")}
            variant={isActive("/kapazitaetsanalyse") ? "default" : "outline"}
            className="w-full justify-start"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Kapazitätsanalyse
          </Button>
          <Button
            onClick={() => navigate("/settings")}
            variant={isActive("/settings") ? "default" : "outline"}
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
          <Outlet />
        </div>
      </div>
    </div>
  );
};