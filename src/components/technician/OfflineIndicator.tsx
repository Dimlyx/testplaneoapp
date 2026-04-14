import { useOffline } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wifi, WifiOff, RefreshCw, CloudOff, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSync, syncAll } = useOffline();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative",
            !isOnline && "text-amber-500"
          )}
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          {pendingCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium">En ligne</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-600 dark:text-amber-400">Hors ligne</span>
              </>
            )}
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CloudOff className="h-4 w-4" />
              <span>{pendingCount} modification(s) en attente</span>
            </div>
          )}

          {pendingCount === 0 && isOnline && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Tout est synchronisé</span>
            </div>
          )}

          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Dernière sync: {formatDistanceToNow(lastSync, { addSuffix: true, locale: fr })}
            </p>
          )}

          {!isOnline && (
            <div className="p-2 bg-amber-50 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Vos modifications sont enregistrées localement et seront synchronisées automatiquement au retour de la connexion.
                </p>
              </div>
            </div>
          )}

          {isOnline && pendingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Synchronisation automatique en cours...</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
