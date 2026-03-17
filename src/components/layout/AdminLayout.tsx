import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useOrganizationContext } from '@/lib/organization-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  LogOut, 
  Menu, 
  X,
  Wrench,
  HardHat,
  ChevronRight,
  CalendarDays,
  BarChart3,
  Settings,
  Bell,
  ArrowLeft
} from 'lucide-react';
import planeoLogo from '@/assets/planeo-logo-white.png';
import { cn } from '@/lib/utils';
import { ChatBot } from '@/components/ChatBot';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useOrganizationPlan } from '@/hooks/useOrganizationPlan';
import { Badge } from '@/components/ui/badge';
import { Lock, AlertTriangle } from 'lucide-react';

const navigation = [
  { name: 'Tableau de bord', href: '/admin', icon: LayoutDashboard, feature: null },
  { name: 'Calendrier', href: '/admin/calendar', icon: CalendarDays, feature: 'calendar' },
  { name: 'Interventions', href: '/admin/interventions', icon: ClipboardList, feature: 'interventions' },
  { name: 'Clients', href: '/admin/clients', icon: Users, feature: 'clients' },
  { name: 'Alertes Maintenance', href: '/admin/maintenance-alerts', icon: Bell, feature: 'maintenance_alerts' },
  { name: 'Statistiques', href: '/admin/statistics', icon: BarChart3, feature: 'statistics' },
  { name: 'Intervenants', href: '/admin/technicians', icon: Users, feature: null },
  { name: 'Paramètres', href: '/admin/settings', icon: Settings, feature: null },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const { viewAsOrgId, clearViewAsOrg } = useOrganizationContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { hasFeature, isSubscriptionBlocked, subscriptionStatus } = useOrganizationPlan();

  const isSuperAdminViewing = role === 'super_admin' && viewAsOrgId;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleReturnToSuperAdmin = () => {
    clearViewAsOrg();
    navigate('/super-admin');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Super Admin viewing banner */}
      {isSuperAdminViewing && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            Mode visualisation Super Admin
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReturnToSuperAdmin}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au portail Super Admin
          </Button>
        </div>
      )}

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "bg-sidebar",
        isSuperAdminViewing && "top-10"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-accent">
              <img src={planeoLogo} alt="PLANEO" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-sidebar-foreground">PLANEO</h1>
              <p className="text-xs text-sidebar-foreground/60">Administration</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const isLocked = item.feature !== null && !hasFeature(item.feature);
                
                if (isLocked) {
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/30 cursor-not-allowed"
                      title="Disponible avec le pack Business"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-sidebar-foreground/20 text-sidebar-foreground/30">
                        <Lock className="h-3 w-3 mr-1" />
                        Business
                      </Badge>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "nav-link",
                      isActive ? "nav-link-active" : "nav-link-inactive"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-accent-foreground">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  Admin
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("lg:pl-64", isSuperAdminViewing && "pt-10")}>
        {/* Mobile header */}
        <header className={cn(
          "sticky z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:hidden",
          isSuperAdminViewing ? "top-10" : "top-0"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={planeoLogo} alt="PLANEO" className="h-6 w-6 object-contain" />
            <span className="font-semibold">PLANEO</span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8 relative">
          {isSubscriptionBlocked && !isSuperAdminViewing && (
            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-24">
              <div className="text-center max-w-md p-8 rounded-xl border bg-card shadow-lg">
                <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold mb-2">Accès suspendu</h2>
                <p className="text-muted-foreground mb-4">
                  {subscriptionStatus === 'canceled'
                    ? "Votre abonnement a été annulé. Contactez votre administrateur pour réactiver votre compte."
                    : subscriptionStatus === 'unpaid'
                    ? "Votre abonnement est impayé. Veuillez régulariser votre situation pour continuer."
                    : "Votre paiement est en retard. Veuillez mettre à jour vos informations de paiement."
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  Contactez le support pour toute question.
                </p>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <ChatBot />
    </div>
  );
}