import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import OrderPlanning from "./pages/OrderPlanning";
import Upload from "./pages/Upload";
import Folgeauftrag from "./pages/Folgeauftrag";
import Settings from "./pages/Settings";
import ShiftManagement from "./pages/ShiftManagement";
import CapacityAnalysis from "./pages/CapacityAnalysis";
import ExcelExport from "./pages/ExcelExport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/auftragsplanung" replace />} />
            <Route path="auftragsplanung" element={<OrderPlanning />} />
            <Route path="upload" element={<Upload />} />
            <Route path="folgeauftrag" element={<Folgeauftrag />} />
            <Route path="schichtzuordnung" element={<ShiftManagement />} />
            <Route path="kapazitaetsanalyse" element={<CapacityAnalysis />} />
            <Route path="excel-export" element={<ExcelExport />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
