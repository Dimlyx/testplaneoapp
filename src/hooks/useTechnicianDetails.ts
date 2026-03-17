import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useUserOrganization';

export interface TechnicianDetail {
  id: string;
  user_id: string;
  organization_id: string | null;
  technician_type: 'internal' | 'subcontractor';
  address: string | null;
  city: string | null;
  postal_code: string | null;
  hire_date: string | null;
  contract_type: string | null;
  contract_end_date: string | null;
  notes: string | null;
  birth_date: string | null;
  position: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  social_security_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  kbis_url: string | null;
  contract_link: string | null;
  collaboration_start_date: string | null;
  collaboration_end_date: string | null;
  specialties: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicianDocument {
  id: string;
  user_id: string;
  organization_id: string | null;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicianWithDetails {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  details: TechnicianDetail | null;
  documents: TechnicianDocument[];
}

export function useTechnicianDetails() {
  const { data: organizationId } = useUserOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['technician-details', organizationId],
    queryFn: async (): Promise<TechnicianWithDetails[]> => {
      if (!organizationId) return [];

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'technician')
        .eq('organization_id', organizationId);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const techIds = roles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', techIds);

      if (profilesError) throw profilesError;

      const { data: details } = await (supabase as any)
        .from('technician_details')
        .select('*')
        .eq('organization_id', organizationId);

      const { data: documents } = await (supabase as any)
        .from('technician_documents')
        .select('*')
        .eq('organization_id', organizationId);

      const detailsMap = new Map((details || []).map((d: any) => [d.user_id, d]));
      const docsMap = new Map<string, TechnicianDocument[]>();
      (documents || []).forEach((d: any) => {
        const existing = docsMap.get(d.user_id) || [];
        existing.push(d);
        docsMap.set(d.user_id, existing);
      });

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        details: (detailsMap.get(p.id) as TechnicianDetail) || null,
        documents: docsMap.get(p.id) || [],
      }));
    },
    enabled: !!organizationId,
  });

  const upsertDetails = useMutation({
    mutationFn: async (data: Partial<TechnicianDetail> & { user_id: string; technician_type: 'internal' | 'subcontractor' }) => {
      // Convert empty strings to null for date and nullable fields
      const cleanData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])
      );

      const { error } = await (supabase as any)
        .from('technician_details')
        .upsert({
          ...cleanData,
          organization_id: organizationId!,
        }, { onConflict: 'user_id,organization_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-details'] });
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async (data: {
      user_id: string;
      document_type: string;
      file: File;
      expiration_date?: string | null;
    }) => {
      const filePath = `technician-docs/${organizationId}/${data.user_id}/${Date.now()}_${data.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(filePath);

      const { error } = await (supabase as any)
        .from('technician_documents')
        .insert({
          user_id: data.user_id,
          organization_id: organizationId!,
          document_type: data.document_type,
          file_name: data.file.name,
          file_url: urlData.publicUrl,
          file_size: data.file.size,
          expiration_date: data.expiration_date || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-details'] });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await (supabase as any)
        .from('technician_documents')
        .delete()
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-details'] });
    },
  });

  return { ...query, upsertDetails, uploadDocument, deleteDocument };
}
