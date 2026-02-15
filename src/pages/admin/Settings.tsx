import { useState, useRef, useEffect } from "react";
import { Settings as SettingsIcon, FileText, Palette, Save, Upload, X, Image, Eye, EyeOff, Building2, RotateCcw, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import InterventionTypesSettings from "@/components/settings/InterventionTypesSettings";
import WorkflowStepsSettings from "@/components/settings/WorkflowStepsSettings";
import { supabase } from "@/integrations/supabase/client";
import { 
  useCompanySettings,
  useInterfaceSettings,
  useDocumentSettings,
  useUpdateCompanySettings,
  useUpdateInterfaceSettings,
  useUpdateDocumentSettings,
  CompanySettings,
  InterfaceSettings,
  DocumentSettings,
  defaultCompanySettings,
  defaultInterfaceSettings,
  defaultDocumentSettings
} from "@/hooks/useAppSettings";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: dbCompanySettings, isLoading: loadingCompany } = useCompanySettings();
  const { data: dbInterfaceSettings, isLoading: loadingInterface } = useInterfaceSettings();
  const { data: dbDocumentSettings, isLoading: loadingDocuments } = useDocumentSettings();
  const updateCompanySettingsMutation = useUpdateCompanySettings();
  const updateInterfaceSettingsMutation = useUpdateInterfaceSettings();
  const updateDocumentSettingsMutation = useUpdateDocumentSettings();
  
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [interfaceSettings, setInterfaceSettings] = useState<InterfaceSettings>(defaultInterfaceSettings);
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>(defaultDocumentSettings);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dbCompanySettings) setCompanySettings(dbCompanySettings);
  }, [dbCompanySettings]);

  useEffect(() => {
    if (dbInterfaceSettings) setInterfaceSettings(dbInterfaceSettings);
  }, [dbInterfaceSettings]);

  useEffect(() => {
    if (dbDocumentSettings) setDocumentSettings(dbDocumentSettings);
  }, [dbDocumentSettings]);

  const handleSaveCompanySettings = async () => {
    await updateCompanySettingsMutation.mutateAsync(companySettings);
  };

  const handleSaveInterfaceSettings = async () => {
    await updateInterfaceSettingsMutation.mutateAsync(interfaceSettings);
  };

  const handleSaveDocumentSettings = async () => {
    await updateDocumentSettingsMutation.mutateAsync(documentSettings);
  };

  const handleResetInterfaceSettings = () => {
    setInterfaceSettings(defaultInterfaceSettings);
    toast({
      title: "Couleurs réinitialisées",
      description: "Les couleurs par défaut ont été restaurées. N'oubliez pas d'enregistrer.",
    });
  };

  const updateInterfaceSetting = <K extends keyof InterfaceSettings>(key: K, value: InterfaceSettings[K]) => {
    setInterfaceSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateCompanySetting = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setCompanySettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateDocumentSetting = <K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) => {
    setDocumentSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une image (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erreur", description: "L'image ne doit pas dépasser 2 Mo", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileName = `company-logo-${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(filePath);

      const newSettings = { ...companySettings, logoUrl: urlData.publicUrl };
      setCompanySettings(newSettings);
      await updateCompanySettingsMutation.mutateAsync({ logoUrl: urlData.publicUrl });
      
      toast({ title: "Logo uploadé", description: "Le logo a été enregistré avec succès." });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: "Erreur", description: "Impossible d'uploader le logo.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setCompanySettings(prev => ({ ...prev, logoUrl: "" }));
    await updateCompanySettingsMutation.mutateAsync({ logoUrl: "" });
    toast({ title: "Logo supprimé", description: "Le logo a été retiré des paramètres." });
  };

  if (loadingCompany || loadingInterface || loadingDocuments) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration de l'application</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={[]} className="space-y-4">
        {/* Section: Société */}
        <AccordionItem value="company" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Société</p>
                <p className="text-sm text-muted-foreground font-normal">Informations légales et coordonnées</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            {/* Identity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Identité de l'entreprise
                </CardTitle>
                <CardDescription>
                  Ces informations apparaîtront sur tous les documents officiels et rapports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo */}
                <div className="space-y-2">
                  <Label>Logo de l'entreprise</Label>
                  <div className="flex items-center gap-4">
                    {companySettings.logoUrl ? (
                      <div className="relative">
                        <img 
                          src={companySettings.logoUrl} 
                          alt="Logo entreprise" 
                          className="h-20 w-auto object-contain border rounded-lg p-2 bg-white"
                        />
                        <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={handleRemoveLogo}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-20 w-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingLogo ? "Upload..." : "Choisir un logo"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG. Max 2 Mo.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nom commercial</Label>
                    <Input id="companyName" value={companySettings.name} onChange={(e) => updateCompanySetting("name", e.target.value)} placeholder="Mon Entreprise" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Raison sociale</Label>
                    <Input id="legalName" value={companySettings.legalName} onChange={(e) => updateCompanySetting("legalName", e.target.value)} placeholder="Mon Entreprise SARL" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legal Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informations légales</CardTitle>
                <CardDescription>Mentions obligatoires pour les documents commerciaux</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="siret">N° SIRET</Label>
                    <Input id="siret" value={companySettings.siret} onChange={(e) => updateCompanySetting("siret", e.target.value)} placeholder="123 456 789 00012" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tvaNumber">N° TVA Intracommunautaire</Label>
                    <Input id="tvaNumber" value={companySettings.tvaNumber} onChange={(e) => updateCompanySetting("tvaNumber", e.target.value)} placeholder="FR12345678901" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rcsNumber">N° RCS</Label>
                    <Input id="rcsNumber" value={companySettings.rcsNumber} onChange={(e) => updateCompanySetting("rcsNumber", e.target.value)} placeholder="Paris B 123 456 789" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capitalSocial">Capital social</Label>
                    <Input id="capitalSocial" value={companySettings.capitalSocial} onChange={(e) => updateCompanySetting("capitalSocial", e.target.value)} placeholder="10 000 €" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées</CardTitle>
                <CardDescription>Adresse et moyens de contact</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input id="address" value={companySettings.address} onChange={(e) => updateCompanySetting("address", e.target.value)} placeholder="123 Rue de l'Exemple" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Code postal</Label>
                    <Input id="postalCode" value={companySettings.postalCode} onChange={(e) => updateCompanySetting("postalCode", e.target.value)} placeholder="75001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input id="city" value={companySettings.city} onChange={(e) => updateCompanySetting("city", e.target.value)} placeholder="Paris" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input id="phone" value={companySettings.phone} onChange={(e) => updateCompanySetting("phone", e.target.value)} placeholder="01 23 45 67 89" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={companySettings.email} onChange={(e) => updateCompanySetting("email", e.target.value)} placeholder="contact@entreprise.fr" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input id="website" value={companySettings.website} onChange={(e) => updateCompanySetting("website", e.target.value)} placeholder="www.entreprise.fr" />
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Aperçu en-tête rapport</CardTitle>
                <CardDescription>Prévisualisation de l'en-tête des rapports PDF</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden max-w-lg bg-white">
                  <div className="p-4 text-white" style={{ backgroundColor: documentSettings.primaryColor }}>
                    <div className="flex items-start gap-4">
                      {companySettings.logoUrl && (
                        <img src={companySettings.logoUrl} alt="Logo" className="h-12 w-auto object-contain bg-white rounded p-1" />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-lg">{companySettings.name || "Nom de l'entreprise"}</p>
                        <p className="text-sm opacity-80">RAPPORT D'INTERVENTION</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 text-xs text-muted-foreground border-t space-y-1">
                    {(companySettings.address || companySettings.postalCode || companySettings.city) && (
                      <p>{[companySettings.address, companySettings.postalCode, companySettings.city].filter(Boolean).join(', ')}</p>
                    )}
                    <div className="flex gap-4">
                      {companySettings.phone && <span>Tél: {companySettings.phone}</span>}
                      {companySettings.email && <span>Email: {companySettings.email}</span>}
                    </div>
                    {companySettings.siret && <p>SIRET: {companySettings.siret}</p>}
                    {companySettings.tvaNumber && <p>TVA: {companySettings.tvaNumber}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveCompanySettings} disabled={updateCompanySettingsMutation.isPending} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {updateCompanySettingsMutation.isPending ? "Enregistrement..." : "Enregistrer les informations société"}
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Section: Interface */}
        <AccordionItem value="interface" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Interface</p>
                <p className="text-sm text-muted-foreground font-normal">Personnalisation des couleurs</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Personnalisation de l'interface
                </CardTitle>
                <CardDescription>Modifiez les couleurs pour adapter l'application à votre identité visuelle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="interfacePrimaryColor">Couleur principale</Label>
                    <div className="flex gap-2">
                      <Input id="interfacePrimaryColor" type="color" value={interfaceSettings.primaryColor} onChange={(e) => updateInterfaceSetting("primaryColor", e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                      <Input value={interfaceSettings.primaryColor} onChange={(e) => updateInterfaceSetting("primaryColor", e.target.value)} placeholder="#003057" className="flex-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Boutons, liens et accents</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interfaceAccentColor">Couleur d'accent</Label>
                    <div className="flex gap-2">
                      <Input id="interfaceAccentColor" type="color" value={interfaceSettings.accentColor} onChange={(e) => updateInterfaceSetting("accentColor", e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                      <Input value={interfaceSettings.accentColor} onChange={(e) => updateInterfaceSetting("accentColor", e.target.value)} placeholder="#0050A0" className="flex-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Éléments secondaires</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sidebarColor">Couleur de la barre latérale</Label>
                    <div className="flex gap-2">
                      <Input id="sidebarColor" type="color" value={interfaceSettings.sidebarColor} onChange={(e) => updateInterfaceSetting("sidebarColor", e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                      <Input value={interfaceSettings.sidebarColor} onChange={(e) => updateInterfaceSetting("sidebarColor", e.target.value)} placeholder="#0a1628" className="flex-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Menu de navigation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aperçu</CardTitle>
                <CardDescription>Prévisualisation des couleurs sélectionnées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-48 h-48 rounded-lg p-4 text-white" style={{ backgroundColor: interfaceSettings.sidebarColor }}>
                    <p className="text-sm font-semibold mb-4">Menu latéral</p>
                    <div className="space-y-2">
                      <div className="px-3 py-2 rounded text-sm" style={{ backgroundColor: interfaceSettings.primaryColor }}>Tableau de bord</div>
                      <div className="px-3 py-2 rounded text-sm opacity-70">Interventions</div>
                      <div className="px-3 py-2 rounded text-sm opacity-70">Clients</div>
                    </div>
                  </div>
                  <div className="flex-1 p-4 border rounded-lg space-y-4">
                    <p className="text-sm font-medium text-muted-foreground mb-4">Éléments d'interface</p>
                    <div className="flex flex-wrap gap-2">
                      <button className="px-4 py-2 rounded-md text-white text-sm font-medium" style={{ backgroundColor: interfaceSettings.primaryColor }}>Bouton principal</button>
                      <button className="px-4 py-2 rounded-md text-white text-sm font-medium" style={{ backgroundColor: interfaceSettings.accentColor }}>Bouton secondaire</button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium cursor-pointer" style={{ color: interfaceSettings.primaryColor }}>Lien hypertexte</span>
                      <div className="px-3 py-1 rounded-full text-xs text-white" style={{ backgroundColor: interfaceSettings.accentColor }}>Badge</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleSaveInterfaceSettings} disabled={updateInterfaceSettingsMutation.isPending} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                {updateInterfaceSettingsMutation.isPending ? "Enregistrement..." : "Enregistrer les couleurs"}
              </Button>
              <Button variant="outline" onClick={handleResetInterfaceSettings} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Réinitialiser par défaut
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section: Modèles d'intervention */}
        <AccordionItem value="workflow" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Modèles d'intervention</p>
                <p className="text-sm text-muted-foreground font-normal">Types, étapes de workflow et personnalisation des interventions</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <InterventionTypesSettings />
            <WorkflowStepsSettings />
          </AccordionContent>
        </AccordionItem>

        {/* Section: Documents (unified PDF + Extranet) */}
        <AccordionItem value="documents" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Documents & Extranet</p>
                <p className="text-sm text-muted-foreground font-normal">Contenu et apparence des rapports PDF et du portail client</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            {/* Visibility toggles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Sections affichées
                </CardTitle>
                <CardDescription>
                  Choisissez les informations visibles dans les rapports PDF et sur l'extranet client
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    { key: 'showClientInfo' as const, label: 'Informations client' },
                    { key: 'showInterventionAddress' as const, label: "Lieu d'intervention" },
                    { key: 'showScheduledDateTime' as const, label: 'Date et heure prévues' },
                    { key: 'showDescription' as const, label: 'Description' },
                    { key: 'showEquipmentDetails' as const, label: 'Détails équipements' },
                    { key: 'showEquipmentPhotos' as const, label: 'Photos équipements' },
                    { key: 'showWorkflowSteps' as const, label: 'Étapes du workflow' },
                  ]).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        {documentSettings[key] ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm">{label}</span>
                      </div>
                      <Switch
                        checked={documentSettings[key]}
                        onCheckedChange={(checked) => updateDocumentSetting(key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Apparence
                </CardTitle>
                <CardDescription>
                  Couleurs des rapports PDF et de l'extranet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="docPrimaryColor">Couleur principale</Label>
                    <div className="flex gap-2">
                      <Input id="docPrimaryColor" type="color" value={documentSettings.primaryColor} onChange={(e) => updateDocumentSetting("primaryColor", e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                      <Input value={documentSettings.primaryColor} onChange={(e) => updateDocumentSetting("primaryColor", e.target.value)} placeholder="#003057" className="flex-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">En-têtes et titres</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docAccentColor">Couleur d'accent</Label>
                    <div className="flex gap-2">
                      <Input id="docAccentColor" type="color" value={documentSettings.accentColor} onChange={(e) => updateDocumentSetting("accentColor", e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                      <Input value={documentSettings.accentColor} onChange={(e) => updateDocumentSetting("accentColor", e.target.value)} placeholder="#0050A0" className="flex-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Éléments secondaires et pied de page</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docFooterText">Texte de pied de page</Label>
                  <Input id="docFooterText" value={documentSettings.footerText} onChange={(e) => updateDocumentSetting("footerText", e.target.value)} placeholder="Merci pour votre confiance" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docWelcomeMessage">Message de bienvenue (extranet)</Label>
                  <Input id="docWelcomeMessage" value={documentSettings.welcomeMessage} onChange={(e) => updateDocumentSetting("welcomeMessage", e.target.value)} placeholder="Bienvenue sur votre espace client" />
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Aperçu</CardTitle>
                <CardDescription>Prévisualisation du rapport</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden max-w-md">
                  <div className="p-4 text-white flex items-center gap-3" style={{ backgroundColor: documentSettings.primaryColor }}>
                    {companySettings.logoUrl && (
                      <img src={companySettings.logoUrl} alt="Logo" className="h-10 w-auto object-contain bg-white rounded p-1" />
                    )}
                    <div>
                      <p className="font-bold">{companySettings.name || "Nom de l'entreprise"}</p>
                      <p className="text-sm opacity-80">RAPPORT D'INTERVENTION</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white space-y-2">
                    {documentSettings.showClientInfo && (
                      <>
                        <div className="text-sm font-medium" style={{ color: documentSettings.primaryColor }}>Informations client</div>
                        <div className="h-2 bg-muted rounded w-3/4"></div>
                      </>
                    )}
                    {documentSettings.showDescription && (
                      <>
                        <div className="text-sm font-medium mt-2" style={{ color: documentSettings.primaryColor }}>Détails intervention</div>
                        <div className="h-2 bg-muted rounded w-full"></div>
                      </>
                    )}
                    {documentSettings.showEquipmentDetails && (
                      <>
                        <div className="text-sm font-medium mt-2" style={{ color: documentSettings.accentColor }}>Équipements</div>
                        <div className="h-2 bg-muted rounded w-2/3"></div>
                      </>
                    )}
                    {documentSettings.showWorkflowSteps && (
                      <>
                        <div className="text-sm font-medium mt-2" style={{ color: documentSettings.primaryColor }}>Étapes du workflow</div>
                        <div className="h-2 bg-muted rounded w-1/2"></div>
                      </>
                    )}
                  </div>
                  <div className="p-3 text-center text-xs text-white" style={{ backgroundColor: documentSettings.accentColor }}>
                    {documentSettings.footerText || "Texte de pied de page"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveDocumentSettings} disabled={updateDocumentSettingsMutation.isPending} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {updateDocumentSettingsMutation.isPending ? "Enregistrement..." : "Enregistrer les paramètres documents"}
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
