import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { OfflineProvider } from "@/hooks/useOfflineSync";

// Layouts
import AdminLayout from "@/components/layout/AdminLayout";
import TechnicianLayout from "@/components/layout/TechnicianLayout";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

// Pages
import Auth from "@/pages/Auth";
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

// Technician pages
import TechnicianInterventions from "@/pages/technician/TechnicianInterventions";
import TechnicianInterventionDetail from "@/pages/technician/TechnicianInterventionDetail";
import TechnicianHistory from "@/pages/technician/TechnicianHistory";
import PublicIntervention from "@/pages/public/PublicIntervention";
import InstallApp from "@/pages/InstallApp";

// Super Admin pages
import SuperAdminDashboard from "@/pages/super-admin/Dashboard";
import SuperAdminOrganizations from "@/pages/super-admin/Organizations";
import SuperAdminOrganizationDetail from "@/pages/super-admin/OrganizationDetail";
import SuperAdminUsers from "@/pages/super-admin/Users";

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: "admin" | "technician" | "super_admin" }) => {
  const { user, role, loading } = useAuth();

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

  if (requiredRole && role !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    if (role === "super_admin") {
      return <Navigate to="/super-admin" replace />;
    } else if (role === "admin") {
      return <Navigate to="/admin" replace />;
    } else if (role === "technician") {
      return <Navigate to="/technician" replace />;
    }
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

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role === "super_admin") {
    return <Navigate to="/super-admin" replace />;
  } else if (role === "admin") {
    return <Navigate to="/admin" replace />;
  } else if (role === "technician") {
    return <Navigate to="/technician" replace />;
  }

  return <Navigate to="/auth" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/auth" element={<Auth />} />

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
        <Route path="organizations" element={<SuperAdminOrganizations />} />
        <Route path="organizations/:id" element={<SuperAdminOrganizationDetail />} />
        <Route path="users" element={<SuperAdminUsers />} />
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
        <Route path="clients" element={<Clients />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
      </Route>

      {/* Technician routes - wrapped with OfflineProvider */}
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
        <Route index element={<TechnicianInterventions />} />
        <Route path="history" element={<TechnicianHistory />} />
        <Route path="interventions/:id" element={<TechnicianInterventionDetail />} />
      </Route>

      {/* Public intervention page (no auth required) */}
      <Route path="/intervention/:token" element={<PublicIntervention />} />
      
      {/* Install PWA page */}
      <Route path="/install" element={<InstallApp />} />

      {/* 404 */}
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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
