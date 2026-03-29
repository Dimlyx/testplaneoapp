import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/lib/organization-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FlaskConical, 
  Building2, 
  Eye, 
  ExternalLink, 
  ClipboardList, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  Wrench,
  Palette,
  Layout,
  Smartphone,
  Monitor,
  Bell,
  FileText,
  MapPin,
  Shield
} from 'lucide-react';

export default function Laboratory() {
  const navigate = useNavigate();
  const { setViewAsOrgId, viewAsOrgId, clearViewAsOrg } = useOrganizationContext();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(viewAsOrgId || '');

  const { data: organizations = [] } = useQuery({
    queryKey: ['lab-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, plan, status, slug')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleEnterSandbox = () => {
    if (selectedOrgId) {
      setViewAsOrgId(selectedOrgId);
      navigate('/admin');
    }
  };

  const handleExitSandbox = () => {
    clearViewAsOrg();
    setSelectedOrgId('');
  };

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  const adminFeatures = [
    { name: 'Tableau de bord', icon: Layout, path: '/admin', desc: 'Vue d\'ensemble et KPIs' },
    { name: 'Interventions', icon: ClipboardList, path: '/admin/interventions', desc: 'Liste et gestion des interventions' },
    { name: 'Nouvelle intervention', icon: Wrench, path: '/admin/interventions/new', desc: 'Créer une intervention test' },
    { name: 'Calendrier', icon: Calendar, path: '/admin/calendar', desc: 'Planning des interventions' },
    { name: 'Clients', icon: Users, path: '/admin/clients', desc: 'Gestion des clients' },
    { name: 'Techniciens', icon: Users, path: '/admin/technicians', desc: 'Gestion des techniciens' },
    { name: 'Types d\'intervention', icon: FileText, path: '/admin/intervention-types', desc: 'Workflows et modèles' },
    { name: 'Statistiques', icon: BarChart3, path: '/admin/statistics', desc: 'Analyses et graphiques' },
    { name: 'Alertes maintenance', icon: Bell, path: '/admin/maintenance-alerts', desc: 'Alertes programmées' },
    { name: 'Paramètres', icon: Settings, path: '/admin/settings', desc: 'Configuration de l\'entreprise' },
  ];

  const uiComponents = [
    { name: 'Formulaire intervention', category: 'Formulaires', status: 'stable' },
    { name: 'Workflow Builder', category: 'Éditeur', status: 'stable' },
    { name: 'Carte intervention', category: 'Cartes', status: 'stable' },
    { name: 'Calendrier planning', category: 'Planning', status: 'stable' },
    { name: 'Statistiques / Charts', category: 'Graphiques', status: 'stable' },
    { name: 'Extranet client', category: 'Public', status: 'stable' },
    { name: 'Notifications push', category: 'Notifications', status: 'stable' },
    { name: 'Signature pad', category: 'Saisie', status: 'stable' },
    { name: 'Import CSV', category: 'Import/Export', status: 'stable' },
    { name: 'PDF Generator', category: 'Export', status: 'stable' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Laboratoire</h1>
          <p className="text-sm text-muted-foreground">
            Espace de test et prototypage — testez les fonctionnalités avant de les déployer
          </p>
        </div>
      </div>

      {/* Active sandbox indicator */}
      {viewAsOrgId && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">
                  Mode sandbox actif — {organizations.find(o => o.id === viewAsOrgId)?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vous naviguez en tant qu'admin de cette entreprise
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExitSandbox}>
              Quitter le sandbox
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sandbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sandbox" className="gap-2">
            <Building2 className="h-4 w-4" />
            Sandbox Entreprise
          </TabsTrigger>
          <TabsTrigger value="components" className="gap-2">
            <Palette className="h-4 w-4" />
            Composants UI
          </TabsTrigger>
          <TabsTrigger value="responsive" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Tests Responsive
          </TabsTrigger>
        </TabsList>

        {/* Sandbox Tab */}
        <TabsContent value="sandbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Tester en tant qu'entreprise
              </CardTitle>
              <CardDescription>
                Sélectionnez une entreprise pour naviguer dans son interface admin et tester les fonctionnalités
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choisir une entreprise..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        <span className="flex items-center gap-2">
                          {org.name}
                          <Badge variant="outline" className="text-xs">
                            {org.plan}
                          </Badge>
                          {org.status !== 'active' && (
                            <Badge variant="secondary" className="text-xs">
                              {org.status}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleEnterSandbox} 
                  disabled={!selectedOrgId}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Entrer dans le sandbox
                </Button>
              </div>

              {selectedOrg && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p><strong>Entreprise :</strong> {selectedOrg.name}</p>
                  <p><strong>Plan :</strong> {selectedOrg.plan}</p>
                  <p><strong>Statut :</strong> {selectedOrg.status}</p>
                  <p><strong>Slug :</strong> {selectedOrg.slug}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick access to admin pages */}
          <Card>
            <CardHeader>
              <CardTitle>Accès rapide aux fonctionnalités</CardTitle>
              <CardDescription>
                {viewAsOrgId 
                  ? 'Cliquez pour accéder directement à une section de l\'espace admin'
                  : 'Sélectionnez d\'abord une entreprise pour activer les liens'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {adminFeatures.map((feature) => (
                  <button
                    key={feature.path}
                    onClick={() => {
                      if (viewAsOrgId) navigate(feature.path);
                    }}
                    disabled={!viewAsOrgId}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-center"
                  >
                    <feature.icon className="h-6 w-6 text-primary" />
                    <span className="text-sm font-medium">{feature.name}</span>
                    <span className="text-xs text-muted-foreground">{feature.desc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Inventaire des composants
              </CardTitle>
              <CardDescription>
                Liste des composants et fonctionnalités disponibles dans Planeo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {uiComponents.map((comp) => (
                  <div
                    key={comp.name}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="text-sm font-medium">{comp.name}</p>
                      <p className="text-xs text-muted-foreground">{comp.category}</p>
                    </div>
                    <Badge 
                      variant={comp.status === 'stable' ? 'default' : 'secondary'}
                      className={comp.status === 'stable' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}
                    >
                      {comp.status === 'stable' ? '✓ Stable' : comp.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes de développement</CardTitle>
              <CardDescription>
                Utilisez cet espace pour suivre les idées de fonctionnalités à tester
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 text-center text-muted-foreground">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  Sélectionnez une entreprise dans l'onglet Sandbox pour tester les composants en conditions réelles
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responsive Tab */}
        <TabsContent value="responsive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Tests Responsive
              </CardTitle>
              <CardDescription>
                Vérifiez le rendu de l'application sur différents appareils
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-card text-center space-y-2">
                  <Smartphone className="h-8 w-8 mx-auto text-primary" />
                  <p className="font-medium">Mobile</p>
                  <p className="text-xs text-muted-foreground">375 × 812 px</p>
                  <p className="text-xs text-muted-foreground">Interface technicien optimisée</p>
                </div>
                <div className="p-4 rounded-xl border bg-card text-center space-y-2">
                  <Monitor className="h-8 w-8 mx-auto text-primary" />
                  <p className="font-medium">Tablette</p>
                  <p className="text-xs text-muted-foreground">768 × 1024 px</p>
                  <p className="text-xs text-muted-foreground">Navigation hybride</p>
                </div>
                <div className="p-4 rounded-xl border bg-card text-center space-y-2">
                  <Monitor className="h-8 w-8 mx-auto text-primary" />
                  <p className="font-medium">Desktop</p>
                  <p className="text-xs text-muted-foreground">1920 × 1080 px</p>
                  <p className="text-xs text-muted-foreground">Interface admin complète</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
