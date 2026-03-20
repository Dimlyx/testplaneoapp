import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { OrganizationProvider, useOrganizationContext } from "@/lib/organization-context";
import { OfflineProvider } from "@/hooks/useOfflineSync";
import { ThemeProvider } from "@/components/ThemeProvider";

// Layouts
import AdminLayout from "@/components/layout/AdminLayout";
import TechnicianLayout from "@/components/layout/TechnicianLayout";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

// Pages
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Admin pages
import Dashboard from "@/pages/admin/Dashboard";
import AdminCalendar from "@/pages/admin/Calendar";
import Interventions from "@/pages/admin/Interventions";
import InterventionForm from "@/pages/admin/InterventionForm";
import InterventionDetail from "@/pages/admin/InterventionDetail";
import InterventionTypes from "@/pages/admin/InterventionTypes";
import Statistics from "@/pages/admin/Statistics";
import MaintenanceAlerts from "@/pages/admin/MaintenanceAlerts";
import Settings from "@/pages/admin/Settings";
import Clients from "@/pages/admin/Clients";
import ClientForm from "@/pages/admin/ClientForm";
import ClientDetail from "@/pages/admin/ClientDetail";
import Technicians from "@/pages/admin/Technicians";

// Technician pages
import { TechnicianInterventionsByCategory } from "@/pages/technician/TechnicianInterventions";
import TechnicianInterventionDetail from "@/pages/technician/TechnicianInterventionDetail";
import TechnicianPlanning from "@/pages/technician/TechnicianPlanning";
import PublicIntervention from "@/pages/public/PublicIntervention";


// Super Admin pages
import SuperAdminDashboard from "@/pages/super-admin/Dashboard";
import SuperAdminOrganizations from "@/pages/super-admin/Organizations";
import SuperAdminOrganizationDetail from "@/pages/super-admin/OrganizationDetail";
import SuperAdminUsers from "@/pages/super-admin/Users";
import SuperAdminAnnouncements from "@/pages/super-admin/Announcements";
import SuperAdminEmailTemplates from "@/pages/super-admin/EmailTemplates";
import DemoSetup from "@/pages/super-admin/DemoSetup";
import SuperAdminStatistics from "@/pages/super-admin/Statistics";

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: "admin" | "technician" | "super_admin" }) => {
  const { user, role, loading } = useAuth();
  const { viewAsOrgId } = useOrganizationContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole === "admin" && role === "super_admin" && viewAsOrgId) {
    return <>{children}</>;
  }

  if (requiredRole && role !== requiredRole) {
    if (role === "super_admin") return <Navigate to="/super-admin" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "technician") return <Navigate to="/technician" replace />;
  }

  return <>{children}</>;
};

// Root redirect based on role
const RootRedirect = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (role === "super_admin") return <Navigate to="/super-admin" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "technician") return <Navigate to="/technician" replace />;
  return <Navigate to="/auth" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Super Admin routes */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute requiredRole="super_admin">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="statistics" element={<SuperAdminStatistics />} />
        <Route path="organizations" element={<SuperAdminOrganizations />} />
        <Route path="organizations/:id" element={<SuperAdminOrganizationDetail />} />
        <Route path="users" element={<SuperAdminUsers />} />
        <Route path="announcements" element={<SuperAdminAnnouncements />} />
        <Route path="email-templates" element={<SuperAdminEmailTemplates />} />
        <Route path="demo" element={<DemoSetup />} />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<AdminCalendar />} />
        <Route path="interventions" element={<Interventions />} />
        <Route path="interventions/new" element={<InterventionForm />} />
        <Route path="interventions/:id" element={<InterventionDetail />} />
        <Route path="interventions/:id/edit" element={<InterventionForm />} />
        <Route path="intervention-types" element={<InterventionTypes />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="maintenance-alerts" element={<MaintenanceAlerts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="technicians" element={<Technicians />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
      </Route>

      {/* Technician routes */}
      <Route
        path="/technician"
        element={
          <ProtectedRoute requiredRole="technician">
            <OfflineProvider>
              <TechnicianLayout />
            </OfflineProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/technician/planifie" replace />} />
        <Route path="planifie" element={<TechnicianInterventionsByCategory category="planning" />} />
        <Route path="en-cours" element={<TechnicianInterventionsByCategory category="en-cours" />} />
        <Route path="non-planifie" element={<TechnicianInterventionsByCategory category="non-planifie" />} />
        <Route path="planning" element={<TechnicianPlanning />} />
        <Route path="terminees" element={<TechnicianInterventionsByCategory category="terminees" />} />
        <Route path="interventions/:id" element={<TechnicianInterventionDetail />} />
      </Route>

      <Route path="/intervention/:token" element={<PublicIntervention />} />
      <Route path="/install" element={<InstallApp />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <ThemeProvider>
              <AppRoutes />
            </ThemeProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
