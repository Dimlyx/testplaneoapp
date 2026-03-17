import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type PhotoType = 'serial_number' | 'during' | 'after';

export interface InterventionPhoto {
  id: string;
  intervention_id: string;
  equipment_id: string | null;
  photo_type: PhotoType;
  photo_url: string;
  created_at: string;
}

export function useInterventionPhotos(interventionId: string) {
  return useQuery({
    queryKey: ['intervention-photos', interventionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_photos')
        .select('*')
        .eq('intervention_id', interventionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InterventionPhoto[];
    },
    enabled: !!interventionId,
  });
}

export function useUploadInterventionPhoto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      interventionId, 
      photoType, 
      file,
      equipmentId,
    }: { 
      interventionId: string; 
      photoType: PhotoType; 
      file: File;
      equipmentId?: string;
    }) => {
      // Upload to storage
      const fileName = `${interventionId}/${equipmentId || 'general'}/${photoType}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, file, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);

      // Save to database
      const { data, error } = await supabase
        .from('intervention_photos')
        .insert({
          intervention_id: interventionId,
          photo_type: photoType,
          photo_url: publicUrl,
          equipment_id: equipmentId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-photos', variables.interventionId] });
      toast({
        title: 'Photo ajoutée',
        description: 'La photo a été enregistrée avec succès.',
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

export function useDeleteInterventionPhoto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, photoUrl, interventionId }: { id: string; photoUrl: string; interventionId: string }) => {
      // Extract file path from URL
      const urlParts = photoUrl.split('/intervention-photos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('intervention-photos').remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('intervention_photos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return interventionId;
    },
    onSuccess: (interventionId) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-photos', interventionId] });
      toast({
        title: 'Photo supprimée',
        description: 'La photo a été supprimée avec succès.',
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
