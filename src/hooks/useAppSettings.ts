import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export interface CompanySettings {
  name: string;
  legalName: string;
  siret: string;
  tvaNumber: string;
  rcsNumber: string;
  capitalSocial: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
}

export interface ReportSettings {
  primaryColor: string;
  accentColor: string;
  footerText: string;
}

export interface ExtranetSettings {
  showClientInfo: boolean;
  showInterventionAddress: boolean;
  showScheduledDateTime: boolean;
  showDescription: boolean;
  showEquipmentDetails: boolean;
  showEquipmentPhotos: boolean;
  showReport: boolean;
  showSignature: boolean;
  welcomeMessage: string;
  customFooterText: string;
}

export interface DocumentSettings {
  showClientInfo: boolean;
  showInterventionAddress: boolean;
  showScheduledDateTime: boolean;
  showDescription: boolean;
  showEquipmentDetails: boolean;
  showEquipmentPhotos: boolean;
  showWorkflowSteps: boolean;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  welcomeMessage: string;
}

export interface InterfaceSettings {
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
}

export const defaultCompanySettings: CompanySettings = {
  name: "",
  legalName: "",
  siret: "",
  tvaNumber: "",
  rcsNumber: "",
  capitalSocial: "",
  address: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
  website: "",
  logoUrl: "",
};

export const defaultReportSettings: ReportSettings = {
  primaryColor: "#003057",
  accentColor: "#0050A0",
  footerText: "",
};

export const defaultExtranetSettings: ExtranetSettings = {
  showClientInfo: true,
  showInterventionAddress: true,
  showScheduledDateTime: true,
  showDescription: true,
  showEquipmentDetails: true,
  showEquipmentPhotos: true,
  showReport: true,
  showSignature: true,
  welcomeMessage: "",
  customFooterText: "",
};

export const defaultInterfaceSettings: InterfaceSettings = {
  primaryColor: "#003057",
  accentColor: "#0050A0",
  sidebarColor: "#0a1628",
};

export const defaultDocumentSettings: DocumentSettings = {
  showClientInfo: true,
  showInterventionAddress: true,
  showScheduledDateTime: true,
  showDescription: true,
  showEquipmentDetails: true,
  showEquipmentPhotos: true,
  showWorkflowSteps: true,
  primaryColor: "#003057",
  accentColor: "#0050A0",
  footerText: "",
  welcomeMessage: "",
};

export function useCompanySettings() {
  const { data: organizationId } = useUserOrganization();
  
  return useQuery({
    queryKey: ['app-settings', 'company', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company')
        .eq('organization_id', organizationId!)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultCompanySettings, ...(data.value as object) } as CompanySettings;
      }
      return defaultCompanySettings;
    },
    enabled: !!organizationId,
  });
}

export function useReportSettings() {
  const { data: organizationId } = useUserOrganization();
  
  return useQuery({
    queryKey: ['app-settings', 'report', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'report')
        .eq('organization_id', organizationId!)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultReportSettings, ...(data.value as object) } as ReportSettings;
      }
      return defaultReportSettings;
    },
    enabled: !!organizationId,
  });
}

export function useExtranetSettings() {
  const { data: organizationId } = useUserOrganization();
  
  return useQuery({
    queryKey: ['app-settings', 'extranet', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'extranet')
        .eq('organization_id', organizationId!)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultExtranetSettings, ...(data.value as object) } as ExtranetSettings;
      }
      return defaultExtranetSettings;
    },
    enabled: !!organizationId,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (settings: Partial<CompanySettings>) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company')
        .eq('organization_id', organizationId)
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultCompanySettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'company', 
          value: newValue,
          organization_id: organizationId
        }, { 
          onConflict: 'key,organization_id' 
        });

      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'company'] });
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les informations de la société ont été mises à jour.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateReportSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (settings: Partial<ReportSettings>) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'report')
        .eq('organization_id', organizationId)
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultReportSettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'report', 
          value: newValue,
          organization_id: organizationId
        }, { 
          onConflict: 'key,organization_id' 
        });

      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'report'] });
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres du rapport ont été mis à jour.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateExtranetSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (settings: Partial<ExtranetSettings>) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'extranet')
        .eq('organization_id', organizationId)
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultExtranetSettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'extranet', 
          value: newValue,
          organization_id: organizationId
        }, { 
          onConflict: 'key,organization_id' 
        });

      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'extranet'] });
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres de l\'extranet ont été mis à jour.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useInterfaceSettings() {
  const { data: organizationId } = useUserOrganization();
  
  return useQuery({
    queryKey: ['app-settings', 'interface', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'interface')
        .eq('organization_id', organizationId!)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultInterfaceSettings, ...(data.value as object) } as InterfaceSettings;
      }
      return defaultInterfaceSettings;
    },
    enabled: !!organizationId,
  });
}

export function useUpdateInterfaceSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (settings: Partial<InterfaceSettings>) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'interface')
        .eq('organization_id', organizationId)
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultInterfaceSettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'interface', 
          value: newValue,
          organization_id: organizationId
        }, { 
          onConflict: 'key,organization_id' 
        });

      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'interface'] });
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres d\'interface ont été mis à jour.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDocumentSettings() {
  const { data: organizationId } = useUserOrganization();
  
  return useQuery({
    queryKey: ['app-settings', 'documents', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'documents')
        .eq('organization_id', organizationId!)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultDocumentSettings, ...(data.value as object) } as DocumentSettings;
      }
      return defaultDocumentSettings;
    },
    enabled: !!organizationId,
  });
}

export function useUpdateDocumentSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async (settings: Partial<DocumentSettings>) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'documents')
        .eq('organization_id', organizationId)
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultDocumentSettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'documents', 
          value: newValue,
          organization_id: organizationId
        }, { 
          onConflict: 'key,organization_id' 
        });

      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'documents'] });
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres des documents ont été mis à jour.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres: ' + error.message,
        variant: 'destructive',
      });
    },
  });
}
