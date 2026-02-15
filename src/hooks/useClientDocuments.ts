import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export interface ClientDocument {
  id: string;
  client_id: string;
  organization_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useClientDocuments(clientId: string) {
  return useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientDocument[];
    },
    enabled: !!clientId,
  });
}

export function useUploadClientDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: organizationId } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ clientId, file }: { clientId: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `${clientId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      const { data: result, error } = await supabase
        .from('client_documents')
        .insert({
          client_id: clientId,
          organization_id: organizationId || null,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-documents', result.client_id] });
      toast({ title: 'Document ajouté' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteClientDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, clientId, fileUrl }: { id: string; clientId: string; fileUrl: string }) => {
      // Extract path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/client-documents/');
      if (pathParts.length > 1) {
        await supabase.storage.from('client-documents').remove([decodeURIComponent(pathParts[1])]);
      }
      const { error } = await supabase.from('client_documents').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
      toast({ title: 'Document supprimé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}
