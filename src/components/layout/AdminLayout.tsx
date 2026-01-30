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
  ChevronRight,
  CalendarDays,
  BarChart3,
  Settings,
  Bell,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
  { name: 'Calendrier', href: '/admin/calendar', icon: CalendarDays },
  { name: 'Interventions', href: '/admin/interventions', icon: ClipboardList },
  { name: 'Clients', href: '/admin/clients', icon: Users },
  { name: 'Alertes Maintenance', href: '/admin/maintenance-alerts', icon: Bell },
  { name: 'Statistiques', href: '/admin/statistics', icon: BarChart3 },
  { name: 'Paramètres', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const { viewAsOrgId, clearViewAsOrg } = useOrganizationContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
              <Wrench className="h-5 w-5 text-sidebar-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-sidebar-foreground">Planéo</h1>
              <p className="text-xs text-sidebar-foreground/60">Administration</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
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
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-semibold">Planéo</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}