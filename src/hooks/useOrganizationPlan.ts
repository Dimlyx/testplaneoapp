import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export type PlanType = 'essentiel' | 'business';

// Define which features are available per plan
const PLAN_FEATURES: Record<PlanType, Set<string>> = {
  essentiel: new Set([
    'interventions',
    'clients',
    'calendar',
    'workflow',
  ]),
  business: new Set([
    'interventions',
    'clients',
    'calendar',
    'workflow',
    'statistics',
    'maintenance_alerts',
    'csv_import',
    'equipment_loop',
    'journey_tracking',
    'chatbot',
    'export_data',
    'multi_technicians',
    'email',
    'documents_extranet',
  ]),
};

export function useOrganizationPlan() {
  const { data: organizationId } = useUserOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ['organization-plan', organizationId],
    queryFn: async () => {
      if (!organizationId) return { plan: 'essentiel' as PlanType, subscriptionStatus: 'trial' as string };
      const { data, error } = await supabase
        .from('organizations')
        .select('plan, subscription_status, trial_ends_at')
        .eq('id', organizationId)
        .single();
      if (error) throw error;
      return {
        plan: (data?.plan || 'essentiel') as PlanType,
        subscriptionStatus: (data?.subscription_status || 'trial') as string,
        trialEndsAt: data?.trial_ends_at as string | null,
      };
    },
    enabled: !!organizationId,
  });

  const currentPlan = data?.plan || 'essentiel';
  const subscriptionStatus = data?.subscriptionStatus || 'trial';
  const trialEndsAt = data?.trialEndsAt || null;

  // Check if subscription is blocked
  const isSubscriptionBlocked = ['canceled', 'past_due', 'unpaid'].includes(subscriptionStatus);

  const hasFeature = (feature: string): boolean => {
    return PLAN_FEATURES[currentPlan]?.has(feature) ?? false;
  };

  return {
    plan: currentPlan,
    isLoading,
    hasFeature,
    allFeatures: PLAN_FEATURES,
    subscriptionStatus,
    trialEndsAt,
    isSubscriptionBlocked,
  };
}

// Labels for display
export const PLAN_LABELS: Record<PlanType, string> = {
  essentiel: 'Essentiel',
  business: 'Business',
};

export const FEATURE_LABELS: Record<string, string> = {
  interventions: 'Gestion des interventions',
  clients: 'Gestion des clients',
  calendar: 'Calendrier',
  workflow: 'Workflow technicien',
  statistics: 'Statistiques avancées',
  maintenance_alerts: 'Alertes de maintenance',
  csv_import: 'Import CSV',
  equipment_loop: 'Boucle équipements',
  journey_tracking: 'Suivi de trajet',
  chatbot: 'Assistant IA',
  export_data: 'Export des données',
  multi_technicians: 'Multi-techniciens',
  documents_extranet: 'Documents & Extranet',
};
