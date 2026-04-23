/**
 * Blocking dialog shown when the technician tries to close an intervention
 * while items are still waiting to sync.
 *
 * Per project decision (Phase 3): NO "Close anyway" escape — the user must
 * either wait for sync or trigger it manually. This guarantees no
 * intervention is ever marked completed with missing data.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Cloud, Wifi, WifiOff, X, ShieldCheck, Info } from 'lucide-react';
import { useOffline } from '@/hooks/useOfflineSync';
import type { PendingBreakdown } from '@/hooks/usePendingForIntervention';

interface PreCloseGuardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: PendingBreakdown;
}

const PreCloseGuardDialog = ({ open, onOpenChange, pending }: PreCloseGuardDialogProps) => {
  const { isOnline, isSyncing, forceSync } = useOffline();
  const [isForcing, setIsForcing] = useState(false);

  const handleForceSync = async () => {
    setIsForcing(true);
    try {
      await forceSync();
    } finally {
      setIsForcing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Clôture impossible pour le moment
          </DialogTitle>
          <DialogDescription>
            Certaines données de cette intervention ne sont pas encore arrivées sur le serveur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Pédagogie : pourquoi on bloque */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Pourquoi cette étape est bloquée&nbsp;?
                </p>
                <p className="text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
                  Si on clôturait maintenant, l'intervention apparaîtrait comme
                  «&nbsp;terminée&nbsp;» côté bureau, mais certaines photos, signatures ou
                  modifications seraient encore en train d'être envoyées — et pourraient
                  être <strong>perdues</strong> si vous fermez l'application ou perdez le réseau.
                </p>
                <p className="flex items-start gap-1.5 text-amber-900 dark:text-amber-100 pt-1">
                  <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Dès que tout est synchronisé, le bouton de clôture redevient utilisable
                    automatiquement.
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Cloud className="h-4 w-4" />
              {pending.total} élément{pending.total > 1 ? 's' : ''} en attente
            </div>
            {pending.stepPhotos > 0 && (
              <p className="text-sm text-muted-foreground pl-6">
                • {pending.stepPhotos} photo{pending.stepPhotos > 1 ? 's' : ''} d'étape
              </p>
            )}
            {pending.photos > 0 && (
              <p className="text-sm text-muted-foreground pl-6">
                • {pending.photos} photo{pending.photos > 1 ? 's' : ''} d'intervention
              </p>
            )}
            {pending.signatures > 0 && (
              <p className="text-sm text-muted-foreground pl-6">
                • {pending.signatures} signature{pending.signatures > 1 ? 's' : ''}
              </p>
            )}
            {pending.mutations > 0 && (
              <p className="text-sm text-muted-foreground pl-6">
                • {pending.mutations} modification{pending.mutations > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">Connexion détectée</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-600 dark:text-amber-400">
                  Hors ligne — reconnectez-vous pour synchroniser
                </span>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleForceSync}
            disabled={!isOnline || isForcing || isSyncing}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isForcing || isSyncing ? 'animate-spin' : ''}`} />
            {isForcing || isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreCloseGuardDialog;
