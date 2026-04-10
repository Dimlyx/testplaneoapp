import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  getPendingMutations,
  getPendingPhotos,
  getPendingSignatures,
  markMutationSynced,
  markMutationError,
  markPhotoSynced,
  markSignatureSynced,
  getSyncStatus,
  saveInterventionOffline,
  addMutation,
  savePhotoOffline,
  saveSignatureOffline,
  OfflineMutation,
  OfflinePhoto,
  OfflineSignature,
} from '@/lib/offline-db';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: number | null;
  error: string | null;
}

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSync: null,
    error: null,
  });
  const syncingRef = useRef(false);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setSyncState(prev => ({ ...prev, isOnline: true }));
      syncAll();
    };
    
    const handleOffline = () => {
      setSyncState(prev => ({ ...prev, isOnline: false }));
      toast({
        title: 'Mode hors-ligne activé',
        description: 'Vos modifications seront synchronisées au retour de la connexion.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load initial sync status
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setSyncState(prev => ({
        ...prev,
        pendingCount: status.pendingCount,
        lastSync: status.lastSync || null,
      }));
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }, []);

  // Sync a single mutation
  const syncMutation = async (mutation: OfflineMutation): Promise<boolean> => {
    try {
      switch (mutation.type) {
        case 'update_intervention': {
          const { id, ...updateData } = mutation.payload;
          const { error } = await supabase
            .from('interventions')
            .update(updateData)
            .eq('id', id);
          
          if (error) throw error;
          break;
        }
        case 'update_equipment': {
          const { interventionId, equipmentId, ...updateData } = mutation.payload;
          const { error } = await supabase
            .from('intervention_equipment')
            .update(updateData)
            .eq('intervention_id', interventionId)
            .eq('equipment_id', equipmentId);
          
          if (error) throw error;
          break;
        }
        case 'complete_step': {
          const { interventionId, stepId, comment, photoUrl, loopIndex = 0, checklistData, multipleChoiceData } = mutation.payload;
          const { data: { user } } = await supabase.auth.getUser();

          const { data: existing } = await supabase
            .from('intervention_step_completions')
            .select('id')
            .eq('intervention_id', interventionId)
            .eq('step_id', stepId)
            .eq('loop_index', loopIndex)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('intervention_step_completions')
              .update({
                completed_at: new Date().toISOString(),
                completed_by: user?.id || null,
                comment: comment || null,
                photo_url: photoUrl || null,
                checklist_data: checklistData || null,
                multiple_choice_data: multipleChoiceData || null,
              } as any)
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('intervention_step_completions')
              .insert({
                intervention_id: interventionId,
                step_id: stepId,
                completed_at: new Date().toISOString(),
                completed_by: user?.id || null,
                comment: comment || null,
                photo_url: photoUrl || null,
                loop_index: loopIndex,
                checklist_data: checklistData || null,
                multiple_choice_data: multipleChoiceData || null,
              } as any);
            if (error) throw error;
          }
          break;
        }
        case 'save_draft_step': {
          const { interventionId, stepId, comment, photoUrl, loopIndex = 0, checklistData, multipleChoiceData } = mutation.payload;
          const { data: { user } } = await supabase.auth.getUser();

          const { data: existing } = await supabase
            .from('intervention_step_completions')
            .select('id')
            .eq('intervention_id', interventionId)
            .eq('step_id', stepId)
            .eq('loop_index', loopIndex)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('intervention_step_completions')
              .update({
                comment: comment || null,
                photo_url: photoUrl || null,
                checklist_data: checklistData || null,
                multiple_choice_data: multipleChoiceData || null,
              } as any)
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('intervention_step_completions')
              .insert({
                intervention_id: interventionId,
                step_id: stepId,
                completed_at: null,
                completed_by: user?.id || null,
                comment: comment || null,
                photo_url: photoUrl || null,
                loop_index: loopIndex,
                checklist_data: checklistData || null,
                multiple_choice_data: multipleChoiceData || null,
              } as any);
            if (error) throw error;
          }
          break;
        }
        case 'uncomplete_step': {
          const { interventionId, stepId, loopIndex } = mutation.payload;
          let query = supabase
            .from('intervention_step_completions')
            .delete()
            .eq('intervention_id', interventionId)
            .eq('step_id', stepId);
          if (loopIndex !== undefined) {
            query = query.eq('loop_index', loopIndex);
          }
          const { error } = await query;
          if (error) throw error;
          break;
        }
        default:
          console.warn('Unknown mutation type:', mutation.type);
      }
      
      await markMutationSynced(mutation.id);
      return true;
    } catch (error: any) {
      console.error('Error syncing mutation:', error);
      await markMutationError(mutation.id, error.message);
      return false;
    }
  };

  // Sync a single photo
  const syncPhoto = async (photo: OfflinePhoto): Promise<boolean> => {
    try {
      const fileName = `${photo.interventionId}/${Date.now()}_${photo.id}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, photo.blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('intervention_photos')
        .insert({
          intervention_id: photo.interventionId,
          equipment_id: photo.equipmentId || null,
          photo_type: photo.photoType,
          photo_url: urlData.publicUrl,
        });

      if (dbError) throw dbError;

      await markPhotoSynced(photo.id);
      return true;
    } catch (error: any) {
      console.error('Error syncing photo:', error);
      return false;
    }
  };

  // Sync a signature
  const syncSignature = async (signature: OfflineSignature): Promise<boolean> => {
    try {
      const fileName = `signatures/${signature.interventionId}_${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(fileName, signature.blob, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('interventions')
        .update({
          client_signature_url: urlData.publicUrl,
          client_signature_name: signature.signatureName,
        })
        .eq('id', signature.interventionId);

      if (dbError) throw dbError;

      await markSignatureSynced(signature.id);
      return true;
    } catch (error: any) {
      console.error('Error syncing signature:', error);
      return false;
    }
  };

  // Sync all pending data
  const syncAll = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    
    syncingRef.current = true;
    setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

    let successCount = 0;
    let errorCount = 0;

    try {
      const mutations = await getPendingMutations();
      for (const mutation of mutations) {
        const success = await syncMutation(mutation);
        if (success) successCount++;
        else errorCount++;
      }

      const photos = await getPendingPhotos();
      for (const photo of photos) {
        const success = await syncPhoto(photo);
        if (success) successCount++;
        else errorCount++;
      }

      const signatures = await getPendingSignatures();
      for (const signature of signatures) {
        const success = await syncSignature(signature);
        if (success) successCount++;
        else errorCount++;
      }

      await queryClient.invalidateQueries({ queryKey: ['technician-interventions'] });
      await queryClient.invalidateQueries({ queryKey: ['intervention'] });

      await loadSyncStatus();

      if (successCount > 0) {
        toast({
          title: 'Synchronisation terminée',
          description: `${successCount} élément(s) synchronisé(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}.`,
        });
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncState(prev => ({ ...prev, error: error.message }));
    } finally {
      syncingRef.current = false;
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [queryClient, toast, loadSyncStatus]);

  const cacheInterventions = useCallback(async (interventions: any[]) => {
    for (const intervention of interventions) {
      await saveInterventionOffline(intervention);
    }
  }, []);

  const queueInterventionUpdate = useCallback(async (id: string, data: any) => {
    await addMutation({
      type: 'update_intervention',
      payload: { id, ...data },
    });
    await loadSyncStatus();
    
    if (navigator.onLine) {
      syncAll();
    }
  }, [loadSyncStatus, syncAll]);

  const queuePhoto = useCallback(async (
    interventionId: string,
    blob: Blob,
    photoType: string,
    equipmentId?: string
  ) => {
    await savePhotoOffline({
      interventionId,
      equipmentId,
      photoType,
      blob,
    });
    await loadSyncStatus();
    
    if (navigator.onLine) {
      syncAll();
    }
  }, [loadSyncStatus, syncAll]);

  const queueSignature = useCallback(async (
    interventionId: string,
    blob: Blob,
    signatureName: string
  ) => {
    await saveSignatureOffline({
      interventionId,
      signatureName,
      blob,
    });
    await loadSyncStatus();
    
    if (navigator.onLine) {
      syncAll();
    }
  }, [loadSyncStatus, syncAll]);

  const queueEquipmentUpdate = useCallback(async (
    interventionId: string,
    equipmentId: string,
    data: any
  ) => {
    await addMutation({
      type: 'update_equipment',
      payload: { interventionId, equipmentId, ...data },
    });
    await loadSyncStatus();
    
    if (navigator.onLine) {
      syncAll();
    }
  }, [loadSyncStatus, syncAll]);

  return {
    ...syncState,
    syncAll,
    cacheInterventions,
    queueInterventionUpdate,
    queuePhoto,
    queueSignature,
    queueEquipmentUpdate,
    loadSyncStatus,
  };
}

// Context for sharing offline state
interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: number | null;
  syncAll: () => Promise<void>;
  cacheInterventions: (interventions: any[]) => Promise<void>;
  queueInterventionUpdate: (id: string, data: any) => Promise<void>;
  queuePhoto: (interventionId: string, blob: Blob, photoType: string, equipmentId?: string) => Promise<void>;
  queueSignature: (interventionId: string, blob: Blob, signatureName: string) => Promise<void>;
  queueEquipmentUpdate: (interventionId: string, equipmentId: string, data: any) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const offline = useOfflineSync();
  
  return (
    <OfflineContext.Provider value={offline}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
