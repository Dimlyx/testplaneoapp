import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InterventionAttachment {
  id: string;
  intervention_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

export function useInterventionAttachments(interventionId: string) {
  return useQuery({
    queryKey: ['intervention-attachments', interventionId],
    queryFn: async () => {
      if (!interventionId) return [];
      
      const { data, error } = await supabase
        .from('intervention_attachments')
        .select('*')
        .eq('intervention_id', interventionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as InterventionAttachment[];
    },
    enabled: !!interventionId,
  });
}

export function useAddInterventionAttachment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      interventionId,
      file,
    }: {
      interventionId: string;
      file: File;
    }) => {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${interventionId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);

      // Save attachment record
      const { data, error } = await supabase
        .from('intervention_attachments')
        .insert({
          intervention_id: interventionId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type || `application/${fileExt}`,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-attachments', variables.interventionId] });
      toast({
        title: 'Pièce jointe ajoutée',
        description: 'Le fichier a été ajouté avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteInterventionAttachment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      interventionId,
      fileUrl,
    }: {
      attachmentId: string;
      interventionId: string;
      fileUrl: string;
    }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split('/intervention-photos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage
          .from('intervention-photos')
          .remove([filePath]);
      }

      // Delete record
      const { error } = await supabase
        .from('intervention_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-attachments', variables.interventionId] });
      toast({
        title: 'Pièce jointe supprimée',
        description: 'Le fichier a été supprimé.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
