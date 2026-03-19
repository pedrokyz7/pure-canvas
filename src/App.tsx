import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import BarberDashboard from "./pages/barber/BarberDashboard";
import BarberSchedule from "./pages/barber/BarberSchedule";
import BarberServices from "./pages/barber/BarberServices";
import BarberWorkHours from "./pages/barber/BarberWorkHours";
import BarberFinances from "./pages/barber/BarberFinances";
import BarberClients from "./pages/barber/BarberClients";
import BarberManageBarbers from "./pages/barber/BarberManageBarbers";
import BarberProfile from "./pages/barber/BarberProfile";
import BarberSubscriptions from "./pages/barber/BarberSubscriptions";
import ClientBooking from "./pages/client/ClientBooking";
import ClientAppointments from "./pages/client/ClientAppointments";
import ClientSpending from "./pages/client/ClientSpending";
import ClientProfile from "./pages/client/ClientProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBilling from "./pages/admin/AdminBilling";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'dark';
    const resolved = saved === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : saved;
    document.documentElement.classList.add(resolved);
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/barber" element={<BarberDashboard />} />
            <Route path="/barber/schedule" element={<BarberSchedule />} />
            <Route path="/barber/services" element={<BarberServices />} />
            <Route path="/barber/work-hours" element={<BarberWorkHours />} />
            <Route path="/barber/finances" element={<BarberFinances />} />
            <Route path="/barber/clients" element={<BarberClients />} />
            <Route path="/barber/barbers" element={<BarberManageBarbers />} />
            <Route path="/barber/profile" element={<BarberProfile />} />
            <Route path="/barber/subscriptions" element={<BarberSubscriptions />} />
            <Route path="/client" element={<ClientBooking />} />
            <Route path="/client/appointments" element={<ClientAppointments />} />
            <Route path="/client/spending" element={<ClientSpending />} />
            <Route path="/client/profile" element={<ClientProfile />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
