import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isReallyOnline, shouldSkipNetwork } from "@/lib/network-status";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { OrganizationProvider, useOrganizationContext } from "@/lib/organization-context";
import { OfflineProvider } from "@/hooks/useOfflineSync";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useVersionCheck } from "@/hooks/useVersionCheck";

// Layouts
import AdminLayout from "@/components/layout/AdminLayout";
import TechnicianLayout from "@/components/layout/TechnicianLayout";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

// Pages (eagerly loaded - small/critical)
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Admin pages - lazy loaded (heavy)
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminCalendar = lazy(() => import("@/pages/admin/Calendar"));
const Interventions = lazy(() => import("@/pages/admin/Interventions"));
const InterventionForm = lazy(() => import("@/pages/admin/InterventionForm"));
const InterventionDetail = lazy(() => import("@/pages/admin/InterventionDetail"));
const InterventionTypes = lazy(() => import("@/pages/admin/InterventionTypes"));
const Statistics = lazy(() => import("@/pages/admin/Statistics"));
const MaintenanceAlerts = lazy(() => import("@/pages/admin/MaintenanceAlerts"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const Clients = lazy(() => import("@/pages/admin/Clients"));
const ClientForm = lazy(() => import("@/pages/admin/ClientForm"));
const ClientDetail = lazy(() => import("@/pages/admin/ClientDetail"));
const Technicians = lazy(() => import("@/pages/admin/Technicians"));

// Technician pages - lazy loaded
const TechnicianInterventionsByCategory = lazy(() => import("@/pages/technician/TechnicianInterventions").then(m => ({ default: m.TechnicianInterventionsByCategory })));
const TechnicianInterventionDetail = lazy(() => import("@/pages/technician/TechnicianInterventionDetail"));
const TechnicianPlanning = lazy(() => import("@/pages/technician/TechnicianPlanning"));
const PublicIntervention = lazy(() => import("@/pages/public/PublicIntervention"));

// Super Admin pages - lazy loaded
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin/Dashboard"));
const SuperAdminOrganizations = lazy(() => import("@/pages/super-admin/Organizations"));
const SuperAdminOrganizationDetail = lazy(() => import("@/pages/super-admin/OrganizationDetail"));
const SuperAdminUsers = lazy(() => import("@/pages/super-admin/Users"));
const SuperAdminAnnouncements = lazy(() => import("@/pages/super-admin/Announcements"));
const SuperAdminEmailTemplates = lazy(() => import("@/pages/super-admin/EmailTemplates"));
const DemoSetup = lazy(() => import("@/pages/super-admin/DemoSetup"));
const SuperAdminStatistics = lazy(() => import("@/pages/super-admin/Statistics"));
const Laboratory = lazy(() => import("@/pages/super-admin/Laboratory"));

// Suspense fallback
const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min default
      gcTime: 10 * 60 * 1000, // 10 min garbage collection
      retry: (failureCount, error) => {
        // Never retry when offline (or booted offline) — serve cached data instead.
        // This avoids the 3–10s NetworkFirst wait before falling back to cache.
        if (shouldSkipNetwork()) return false;
        return failureCount < 1;
      },
      retryDelay: 1000,
      networkMode: 'offlineFirst', // Serve cached data when offline, don't block
      // Force refetch every time the tab regains focus, even if data is still
      // within staleTime. This ensures admins always see fresh data when they
      // come back to the tab without needing to hit F5.
      refetchOnWindowFocus: 'always',
      // Same behavior when the browser regains network connectivity.
      refetchOnReconnect: 'always',
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: false, // Never retry mutations — they go through offline queue
    },
  },
});

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
  useVersionCheck();
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="lab" element={<Laboratory />} />
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
      
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
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
