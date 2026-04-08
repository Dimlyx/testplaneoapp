import { useState, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  User,
  Clock,
  Calendar,
  CalendarOff,
  CheckCircle2,
  CalendarDays as CalendarIcon,
  Plus,
} from 'lucide-react';
import planeoLogoWhite from '@/assets/planeo-logo-white.png';
import planeoLogoDark from '@/assets/planeo-logo-dark.png';
import { cn } from '@/lib/utils';
import { OfflineIndicator } from '@/components/technician/OfflineIndicator';
import { NotificationBell } from '@/components/technician/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTechnicianPermissions } from '@/hooks/useTechnicianPermissions';

const TechnicianCreateInterventionDialog = lazy(() => import('@/components/technician/TechnicianCreateInterventionDialog'));

const navigation = [
  { name: 'Planifiées', href: '/technician/planifie', icon: Calendar },
  { name: 'En cours', href: '/technician/en-cours', icon: Clock },
  { name: 'À planifier', href: '/technician/non-planifie', icon: CalendarOff },
  { name: 'Planning', href: '/technician/planning', icon: CalendarIcon },
  { name: 'Terminées', href: '/technician/terminees', icon: CheckCircle2 },
];

export default function TechnicianLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: permissions } = useTechnicianPermissions();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "bg-sidebar"
      )}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-accent">
              <img src={planeoLogoWhite} alt="PLANEO" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-sidebar-foreground">PLANEO</h1>
              <p className="text-xs text-sidebar-foreground/60">Espace Technicien</p>
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

          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-5 w-5 text-sidebar-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">Technicien</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={planeoLogoDark} alt="PLANEO" className="h-7 dark:hidden" />
            <img src={planeoLogoWhite} alt="PLANEO" className="h-7 hidden dark:block" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <OfflineIndicator />
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Floating Action Button - only if permission granted */}
      {permissions?.can_create_intervention && (
        <Button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg lg:bottom-8 lg:right-8"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Create Intervention Dialog */}
      {createOpen && (
        <Suspense fallback={null}>
          <TechnicianCreateInterventionDialog open={createOpen} onOpenChange={setCreateOpen} />
        </Suspense>
      )}
    </div>
  );
}
