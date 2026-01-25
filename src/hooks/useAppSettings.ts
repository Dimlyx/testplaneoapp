import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReportSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  logoUrl: string;
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

export const defaultReportSettings: ReportSettings = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  primaryColor: "#003057",
  accentColor: "#0050A0",
  footerText: "",
  logoUrl: "",
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

export function useUpdateReportSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<ReportSettings>) => {
      // First get current settings
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
