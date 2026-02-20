import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  CheckCircle2, 
  Copy, 
  Loader2,
  Building2,
  UserCircle,
  Wrench,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DemoCredentials {
  admin: { email: string; password: string };
  technician: { email: string; password: string };
  organization: { name: string; id: string };
}

export default function DemoSetup() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleCreateDemo = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const { data, error: fnError } = await supabase.functions.invoke('setup-demo', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult(data);
      toast({ title: 'Compte démo créé avec succès !' });
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copié !` });
  };

  const copyAll = () => {
    if (!result) return;
    const text = `=== COMPTE DÉMO PLANEO ===

🏢 Entreprise : ${result.organization.name}

👤 Administrateur :
Email : ${result.admin.email}
Mot de passe : ${result.admin.password}

🔧 Technicien :
Email : ${result.technician.email}
Mot de passe : ${result.technician.password}

🔗 Accès : https://testplaneoapp.lovable.app`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Tous les identifiants copiés !' });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compte démo</h1>
        <p className="text-muted-foreground">
          Générez un compte de démonstration complet avec données fictives pour vos présentations.
        </p>
      </div>

      {/* What will be created */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ce qui sera créé</CardTitle>
          <CardDescription>Un environnement complet prêt à présenter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            {[
              { icon: Building2, label: 'Entreprise démo', desc: 'Entreprise Démo avec coordonnées fictives' },
              { icon: UserCircle, label: 'Compte Admin', desc: 'Sophie Dupont — accès tableau de bord complet' },
              { icon: Wrench, label: 'Compte Technicien', desc: 'Marc Lefevre — accès interventions assignées' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-md bg-primary/10">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✓ 3 clients fictifs (particuliers et professionnel)</p>
            <p>✓ 3 équipements (chauffe-eau, climatisation, chaudière)</p>
            <p>✓ 4 interventions dans différents statuts (planifiée, en cours, terminée, à planifier)</p>
            <p>✓ 3 types d'intervention configurés</p>
          </div>
        </CardContent>
      </Card>

      {/* Action */}
      {!result && (
        <Button onClick={handleCreateDemo} disabled={loading} size="lg" className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Créer le compte démo
            </>
          )}
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {result && (
        <Card className="border-emerald-500/30 bg-emerald-50/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">Compte démo créé !</CardTitle>
            </div>
            <CardDescription>Partagez ces identifiants pour votre présentation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Admin credentials */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Administrateur</span>
                <Badge variant="default" className="text-xs">Admin</Badge>
              </div>
              <div className="rounded-lg border bg-background p-3 space-y-2">
                <CredentialRow label="Email" value={result.admin.email} onCopy={copyToClipboard} showPassword={true} />
                <CredentialRow label="Mot de passe" value={result.admin.password} onCopy={copyToClipboard} showPassword={showPasswords} isPassword />
              </div>
            </div>

            <Separator />

            {/* Technician credentials */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Technicien</span>
                <Badge variant="secondary" className="text-xs">Technicien</Badge>
              </div>
              <div className="rounded-lg border bg-background p-3 space-y-2">
                <CredentialRow label="Email" value={result.technician.email} onCopy={copyToClipboard} showPassword={true} />
                <CredentialRow label="Mot de passe" value={result.technician.password} onCopy={copyToClipboard} showPassword={showPasswords} isPassword />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex-1"
              >
                {showPasswords ? <EyeOff className="mr-2 h-3 w-3" /> : <Eye className="mr-2 h-3 w-3" />}
                {showPasswords ? 'Masquer' : 'Afficher'} les mots de passe
              </Button>
              <Button size="sm" onClick={copyAll} className="flex-1">
                <Copy className="mr-2 h-3 w-3" />
                Tout copier
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                URL de connexion : <span className="font-mono font-semibold">https://testplaneoapp.lovable.app</span>
              </AlertDescription>
            </Alert>

            <Button variant="outline" onClick={handleCreateDemo} disabled={loading} className="w-full" size="sm">
              Créer un nouveau compte démo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CredentialRow({ label, value, onCopy, showPassword, isPassword }: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
  showPassword: boolean;
  isPassword?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-sm font-mono flex-1 truncate">
        {isPassword && !showPassword ? '••••••••••••' : value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onCopy(value, label)}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
