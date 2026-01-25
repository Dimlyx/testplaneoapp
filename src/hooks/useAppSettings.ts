import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export function useCompanySettings() {
  return useQuery({
    queryKey: ['app-settings', 'company'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultCompanySettings, ...(data.value as object) } as CompanySettings;
      }
      return defaultCompanySettings;
    },
  });
}

export function useReportSettings() {
  return useQuery({
    queryKey: ['app-settings', 'report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'report')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultReportSettings, ...(data.value as object) } as ReportSettings;
      }
      return defaultReportSettings;
    },
  });
}

export function useExtranetSettings() {
  return useQuery({
    queryKey: ['app-settings', 'extranet'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'extranet')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.value) {
        return { ...defaultExtranetSettings, ...(data.value as object) } as ExtranetSettings;
      }
      return defaultExtranetSettings;
    },
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<CompanySettings>) => {
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company')
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultCompanySettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'company', 
          value: newValue 
        }, { 
          onConflict: 'key' 
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

  return useMutation({
    mutationFn: async (settings: Partial<ReportSettings>) => {
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'report')
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultReportSettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'report', 
          value: newValue 
        }, { 
          onConflict: 'key' 
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

  return useMutation({
    mutationFn: async (settings: Partial<ExtranetSettings>) => {
      // First get current settings
      const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'extranet')
        .maybeSingle();

      const currentValue = current?.value as object || {};
      const newValue = { ...defaultExtranetSettings, ...currentValue, ...settings };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'extranet', 
          value: newValue 
        }, { 
          onConflict: 'key' 
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
