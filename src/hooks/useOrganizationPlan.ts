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

  const { data: plan, isLoading } = useQuery({
    queryKey: ['organization-plan', organizationId],
    queryFn: async () => {
      if (!organizationId) return 'essentiel' as PlanType;
      const { data, error } = await supabase
        .from('organizations')
        .select('plan')
        .eq('id', organizationId)
        .single();
      if (error) throw error;
      return (data?.plan || 'essentiel') as PlanType;
    },
    enabled: !!organizationId,
  });

  const currentPlan = plan || 'essentiel';

  const hasFeature = (feature: string): boolean => {
    return PLAN_FEATURES[currentPlan]?.has(feature) ?? false;
  };

  return {
    plan: currentPlan,
    isLoading,
    hasFeature,
    allFeatures: PLAN_FEATURES,
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
