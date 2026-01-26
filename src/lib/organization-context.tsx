import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

interface OrganizationContextType {
  viewAsOrgId: string | null;
  setViewAsOrgId: (orgId: string | null) => void;
  clearViewAsOrg: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [viewAsOrgId, setViewAsOrgIdState] = useState<string | null>(() => {
    // Only restore from sessionStorage if user is super_admin
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('viewAsOrgId');
    }
    return null;
  });

  const setViewAsOrgId = (orgId: string | null) => {
    setViewAsOrgIdState(orgId);
    if (orgId) {
      sessionStorage.setItem('viewAsOrgId', orgId);
    } else {
      sessionStorage.removeItem('viewAsOrgId');
    }
  };

  const clearViewAsOrg = () => {
    setViewAsOrgIdState(null);
    sessionStorage.removeItem('viewAsOrgId');
  };

  // Clear viewAsOrgId if user is not super_admin
  useEffect(() => {
    if (role !== 'super_admin') {
      clearViewAsOrg();
    }
  }, [role]);

  return (
    <OrganizationContext.Provider value={{ viewAsOrgId, setViewAsOrgId, clearViewAsOrg }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
}
