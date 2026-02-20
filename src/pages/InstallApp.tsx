import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Installer PLANEO</CardTitle>
          <CardDescription>
            Installez l'application sur votre appareil pour un accès rapide et un mode hors-ligne complet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600">En ligne</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600">Hors ligne</span>
              </>
            )}
          </div>

          {/* Features list */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Mode hors-ligne</p>
                <p className="text-sm text-muted-foreground">Travaillez sans connexion internet</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Synchronisation automatique</p>
                <p className="text-sm text-muted-foreground">Vos données se synchronisent au retour en ligne</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Accès rapide</p>
                <p className="text-sm text-muted-foreground">Lancez l'app depuis votre écran d'accueil</p>
              </div>
            </div>
          </div>

          {/* Install button */}
          {isInstalled ? (
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-green-700">Application installée !</p>
              <p className="text-sm text-green-600">Vous pouvez la lancer depuis votre écran d'accueil</p>
            </div>
          ) : isIOS ? (
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Installation sur iOS</p>
              <ol className="text-sm text-muted-foreground text-left space-y-2">
                <li>1. Appuyez sur le bouton <strong>Partager</strong> (icône carré avec flèche)</li>
                <li>2. Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong></li>
                <li>3. Appuyez sur <strong>Ajouter</strong></li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="h-5 w-5 mr-2" />
              Installer l'application
            </Button>
          ) : (
            <div className="text-center p-4 bg-muted rounded-lg">
              <RefreshCw className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                L'installation n'est pas disponible sur ce navigateur. 
                Essayez avec Chrome ou Edge.
              </p>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
            Retour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
