import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/image-compression';
import {
  savePhotoOffline,
  getPhotosForIntervention,
  deletePhotoOffline,
  getPhotoBlobOffline,
  type OfflinePhoto,
} from '@/lib/offline-db';
import { isReallyOnline } from '@/lib/network-status';
import { withTimeout, isTimeoutError } from '@/lib/supabase-with-timeout';

export type PhotoType = 'serial_number' | 'during' | 'after';

export interface InterventionPhoto {
  id: string;
  intervention_id: string;
  equipment_id: string | null;
  photo_type: PhotoType;
  photo_url: string;
  created_at: string;
  /** True if the photo is still pending upload (URL is a local blob URL). */
  _local?: boolean;
}

// Cache of blob URLs for offline photos so previews don't disappear
// across renders / step changes.
const blobUrlCache = new Map<string, string>();

function getOrCreateBlobUrl(id: string, blob: Blob): string {
  const existing = blobUrlCache.get(id);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  blobUrlCache.set(id, url);
  return url;
}

function revokeBlobUrl(id: string) {
  const url = blobUrlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlCache.delete(id);
  }
}

function offlineToInterventionPhoto(p: OfflinePhoto): InterventionPhoto {
  return {
    id: `local_${p.id}`,
    intervention_id: p.interventionId,
    equipment_id: p.equipmentId || null,
    photo_type: p.photoType as PhotoType,
    photo_url: getOrCreateBlobUrl(p.id, p.blob),
    created_at: new Date(p.createdAt).toISOString(),
    _local: true,
  };
}

export function useInterventionPhotos(interventionId: string) {
  return useQuery({
    queryKey: ['intervention-photos', interventionId],
    queryFn: async () => {
      // Always read local pending photos first so previews survive offline.
      const localPending = (await getPhotosForIntervention(interventionId))
        .filter(p => !p.synced)
        .map(offlineToInterventionPhoto);

      let serverPhotos: InterventionPhoto[] = [];
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('intervention_photos')
            .select('*')
            .eq('intervention_id', interventionId)
            .order('created_at', { ascending: true }),
          8000,
        );
        if (error) throw error;
        serverPhotos = (data as InterventionPhoto[]) || [];
      } catch (err) {
        if (isTimeoutError(err)) {
          console.warn('Photos fetch timed out, using local cache only');
        } else {
          console.warn('Photos fetch failed, using local cache only', err);
        }
      }

      // Merge: server first, then unsynced local at the end.
      return [...serverPhotos, ...localPending];
    },
    enabled: !!interventionId,
    // Keep showing previous data on refetch to avoid flicker / loops
    placeholderData: (prev) => prev,
    staleTime: 5_000,
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
      // 1. Compress locally (works offline)
      const compressed = await compressImage(file);

      // 2. Save to IndexedDB immediately so the preview survives
      //    step changes / refresh / app close.
      const localId = await savePhotoOffline({
        interventionId,
        equipmentId,
        photoType,
        blob: compressed,
      });

      // 3. Optimistic update — show preview right away via blob URL
      const optimistic: InterventionPhoto = {
        id: `local_${localId}`,
        intervention_id: interventionId,
        equipment_id: equipmentId || null,
        photo_type: photoType,
        photo_url: getOrCreateBlobUrl(localId, compressed),
        created_at: new Date().toISOString(),
        _local: true,
      };
      queryClient.setQueryData<InterventionPhoto[]>(
        ['intervention-photos', interventionId],
        (old = []) => [...old, optimistic],
      );

      // 4. Try to upload immediately if online; otherwise the offline sync
      //    loop will pick it up later.
      if (isReallyOnline()) {
        try {
          const fileName = `${interventionId}/${equipmentId || 'general'}/${photoType}_${Date.now()}.jpg`;
          const { error: uploadError } = await withTimeout(
            supabase.storage
              .from('intervention-photos')
              .upload(fileName, compressed, {
                contentType: 'image/jpeg',
                upsert: false,
              }),
            30_000,
          );

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('intervention-photos')
            .getPublicUrl(fileName);

          const { data, error } = await withTimeout(
            supabase
              .from('intervention_photos')
              .insert({
                intervention_id: interventionId,
                photo_type: photoType,
                photo_url: publicUrl,
                equipment_id: equipmentId || null,
              })
              .select()
              .single(),
            8000,
          );

          if (error) throw error;

          // Upload succeeded — remove the local copy and refresh.
          await deletePhotoOffline(localId);
          revokeBlobUrl(localId);
          return data;
        } catch (err) {
          // Upload failed (network, timeout, etc.) — keep the local copy.
          // The offline sync queue will retry automatically.
          console.warn('Immediate photo upload failed, queued for retry', err);
          return optimistic;
        }
      }

      return optimistic;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intervention-photos', variables.interventionId] });
      toast({
        title: 'Photo ajoutée',
        description: isReallyOnline()
          ? 'La photo a été enregistrée.'
          : 'La photo sera envoyée au retour de la connexion.',
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
    mutationFn: async ({
      id,
      photoUrl,
      interventionId,
    }: {
      id: string;
      photoUrl: string;
      interventionId: string;
    }) => {
      // Local-only photo (still pending upload)
      if (id.startsWith('local_')) {
        const localId = id.replace(/^local_/, '');
        const stored = await getPhotoBlobOffline(localId);
        if (stored) {
          await deletePhotoOffline(localId);
        }
        revokeBlobUrl(localId);
        return interventionId;
      }

      // Remote photo — try to delete the storage object then the row.
      const urlParts = photoUrl.split('/intervention-photos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        try {
          await withTimeout(
            supabase.storage.from('intervention-photos').remove([filePath]),
            8000,
          );
        } catch (err) {
          console.warn('Storage delete failed (will keep DB cleanup):', err);
        }
      }

      const { error } = await withTimeout(
        supabase
          .from('intervention_photos')
          .delete()
          .eq('id', id),
        8000,
      );

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
