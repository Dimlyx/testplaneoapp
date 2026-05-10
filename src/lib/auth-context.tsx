import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'technician' | 'super_admin' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      setRole(data.role as AppRole);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
          // Register with OneSignal via Median JS Bridge
          registerOneSignal(session.user.id);
        } else {
          setRole(null);
          // Unregister from OneSignal via Median JS Bridge
          unregisterOneSignal();
        }
        setLoading(false);

        // If user signed in and "remember me" is off, mark session as temporary
        if (event === 'SIGNED_IN') {
          const rememberMe = localStorage.getItem('rememberMe') === 'true';
          if (!rememberMe) {
            sessionStorage.setItem('tempSession', 'true');
          } else {
            sessionStorage.removeItem('tempSession');
          }
        }
      }
    );

    // Safety net: if offline at boot, never let the app stay on the loading
    // spinner waiting for getSession() to resolve. Median WebView can stall
    // network calls indefinitely on a dead connection, leaving a white screen.
    // We release `loading` after a short delay so the UI (including offline
    // pages backed by IndexedDB) can render. The auth listener above will
    // still update state if/when Supabase eventually responds.
    const offlineAtBoot = typeof navigator !== 'undefined' && navigator.onLine === false;
    const bootTimeoutMs = offlineAtBoot ? 800 : 6000;
    const bootTimeout = window.setTimeout(() => {
      setLoading(prev => (prev ? false : prev));
    }, bootTimeoutMs);

    supabase.auth.getSession().then(({ data: { session } }) => {
      window.clearTimeout(bootTimeout);
      // If session is temporary and page was reloaded (sessionStorage cleared), sign out
      const isTempSession = sessionStorage.getItem('tempSession') === 'true';
      const rememberMe = localStorage.getItem('rememberMe') === 'true';

      if (session && !rememberMe && !isTempSession) {
        // Session exists but not remembered and no sessionStorage flag = new browser session
        // Skip the network signOut when offline to avoid hanging — the local
        // session will be cleared on next online boot.
        if (navigator.onLine) {
          supabase.auth.signOut();
        }
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
        registerOneSignal(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      window.clearTimeout(bootTimeout);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}