import { useState, useRef, useEffect } from "react";
import { Settings as SettingsIcon, Tag, FileText, Palette, Save, Upload, X, Image, Globe, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import InterventionTypesSettings from "@/components/settings/InterventionTypesSettings";
import { supabase } from "@/integrations/supabase/client";
import { 
  useReportSettings, 
  useExtranetSettings, 
  useUpdateReportSettings, 
  useUpdateExtranetSettings,
  ReportSettings,
  ExtranetSettings,
  defaultReportSettings,
  defaultExtranetSettings
} from "@/hooks/useAppSettings";

export default function Settings() {
  const { toast } = useToast();
  
  // Fetch settings from database
  const { data: dbReportSettings, isLoading: loadingReport } = useReportSettings();
  const { data: dbExtranetSettings, isLoading: loadingExtranet } = useExtranetSettings();
  const updateReportSettingsMutation = useUpdateReportSettings();
  const updateExtranetSettingsMutation = useUpdateExtranetSettings();
  
  const [reportSettings, setReportSettings] = useState<ReportSettings>(defaultReportSettings);
  const [extranetSettings, setExtranetSettings] = useState<ExtranetSettings>(defaultExtranetSettings);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state with database
  useEffect(() => {
    if (dbReportSettings) {
      setReportSettings(dbReportSettings);
    }
  }, [dbReportSettings]);

  useEffect(() => {
    if (dbExtranetSettings) {
      setExtranetSettings(dbExtranetSettings);
    }
  }, [dbExtranetSettings]);

  const handleSaveReportSettings = async () => {
    await updateReportSettingsMutation.mutateAsync(reportSettings);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une image (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erreur",
        description: "L'image ne doit pas dépasser 2 Mo",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileName = `company-logo-${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('intervention-photos')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('intervention-photos')
        .getPublicUrl(filePath);

      // Update local state and save to DB
      const newSettings = { ...reportSettings, logoUrl: urlData.publicUrl };
      setReportSettings(newSettings);
      await updateReportSettingsMutation.mutateAsync({ logoUrl: urlData.publicUrl });
      
      toast({
        title: "Logo uploadé",
        description: "Le logo a été enregistré avec succès.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'uploader le logo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    setReportSettings(prev => ({ ...prev, logoUrl: "" }));
    await updateReportSettingsMutation.mutateAsync({ logoUrl: "" });
    toast({
      title: "Logo supprimé",
      description: "Le logo a été retiré des paramètres.",
    });
  };

  const updateReportSetting = <K extends keyof ReportSettings>(
    key: K,
    value: ReportSettings[K]
  ) => {
    setReportSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateExtranetSetting = <K extends keyof ExtranetSettings>(
    key: K,
    value: ExtranetSettings[K]
  ) => {
    setExtranetSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveExtranetSettings = async () => {
    await updateExtranetSettingsMutation.mutateAsync(extranetSettings);
  };

  if (loadingReport || loadingExtranet) {
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

      <Tabs defaultValue="intervention-types" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="intervention-types" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Types d'intervention</span>
            <span className="sm:hidden">Types</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Rapports PDF</span>
            <span className="sm:hidden">PDF</span>
          </TabsTrigger>
          <TabsTrigger value="extranet" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Extranet
          </TabsTrigger>
        </TabsList>

        {/* Tab: Intervention Types */}
        <TabsContent value="intervention-types">
          <InterventionTypesSettings />
        </TabsContent>

        {/* Tab: Report Settings */}
        <TabsContent value="reports" className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informations entreprise
              </CardTitle>
              <CardDescription>
                Ces informations apparaîtront sur les rapports PDF et l'extranet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nom de l'entreprise</Label>
                  <Input
                    id="companyName"
                    value={reportSettings.companyName}
                    onChange={(e) => updateReportSetting("companyName", e.target.value)}
                    placeholder="SportEquip Services"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Téléphone</Label>
                  <Input
                    id="companyPhone"
                    value={reportSettings.companyPhone}
                    onChange={(e) => updateReportSetting("companyPhone", e.target.value)}
                    placeholder="01 23 45 67 89"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Adresse</Label>
                <Textarea
                  id="companyAddress"
                  value={reportSettings.companyAddress}
                  onChange={(e) => updateReportSetting("companyAddress", e.target.value)}
                  placeholder="123 Rue de l'Exemple, 75001 Paris"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={reportSettings.companyEmail}
                  onChange={(e) => updateReportSetting("companyEmail", e.target.value)}
                  placeholder="contact@entreprise.fr"
                />
              </div>

              {/* Logo Upload */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Logo de l'entreprise</Label>
                <div className="flex items-center gap-4">
                  {reportSettings.logoUrl ? (
                    <div className="relative">
                      <img 
                        src={reportSettings.logoUrl} 
                        alt="Logo entreprise" 
                        className="h-16 w-auto object-contain border rounded-lg p-1 bg-white"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={handleRemoveLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-16 w-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingLogo ? "Upload..." : "Choisir un logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG ou SVG. Max 2 Mo. Dimensions recommandées : 200×80 px
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Customization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personnalisation visuelle
              </CardTitle>
              <CardDescription>
                Couleurs et apparence des rapports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Couleur principale</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={reportSettings.primaryColor}
                      onChange={(e) => updateReportSetting("primaryColor", e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={reportSettings.primaryColor}
                      onChange={(e) => updateReportSetting("primaryColor", e.target.value)}
                      placeholder="#1e3a5f"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Utilisée pour les en-têtes et titres</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Couleur d'accent</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      type="color"
                      value={reportSettings.accentColor}
                      onChange={(e) => updateReportSetting("accentColor", e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={reportSettings.accentColor}
                      onChange={(e) => updateReportSetting("accentColor", e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Utilisée pour les éléments secondaires</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerText">Texte de pied de page</Label>
                <Input
                  id="footerText"
                  value={reportSettings.footerText}
                  onChange={(e) => updateReportSetting("footerText", e.target.value)}
                  placeholder="Merci pour votre confiance"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Aperçu</CardTitle>
              <CardDescription>
                Prévisualisation des couleurs sur un rapport
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden max-w-md">
                {/* Header Preview */}
                <div 
                  className="p-4 text-white flex items-center gap-3"
                  style={{ backgroundColor: reportSettings.primaryColor }}
                >
                  {reportSettings.logoUrl && (
                    <img 
                      src={reportSettings.logoUrl} 
                      alt="Logo" 
                      className="h-10 w-auto object-contain bg-white rounded p-1"
                    />
                  )}
                  <div>
                    <p className="font-bold">{reportSettings.companyName || "Nom de l'entreprise"}</p>
                    <p className="text-sm opacity-80">RAPPORT D'INTERVENTION</p>
                  </div>
                </div>
                {/* Body Preview */}
                <div className="p-4 bg-white space-y-2">
                  <div 
                    className="text-sm font-medium"
                    style={{ color: reportSettings.primaryColor }}
                  >
                    Informations client
                  </div>
                  <div className="h-2 bg-muted rounded w-3/4"></div>
                  <div className="h-2 bg-muted rounded w-1/2"></div>
                  <div 
                    className="text-sm font-medium mt-4"
                    style={{ color: reportSettings.primaryColor }}
                  >
                    Détails intervention
                  </div>
                  <div className="h-2 bg-muted rounded w-full"></div>
                  <div className="h-2 bg-muted rounded w-2/3"></div>
                </div>
                {/* Footer Preview */}
                <div 
                  className="p-3 text-center text-xs text-white"
                  style={{ backgroundColor: reportSettings.accentColor }}
                >
                  {reportSettings.footerText || "Texte de pied de page"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button 
            onClick={handleSaveReportSettings} 
            disabled={updateReportSettingsMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateReportSettingsMutation.isPending ? "Enregistrement..." : "Enregistrer les paramètres"}
          </Button>
        </TabsContent>

        {/* Tab: Extranet Settings */}
        <TabsContent value="extranet" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Personnalisation de l'extranet
              </CardTitle>
              <CardDescription>
                Contrôlez les informations affichées sur le portail client accessible via lien public
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visibility toggles */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">Sections affichées</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showClientInfo ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Informations client</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showClientInfo}
                      onCheckedChange={(checked) => updateExtranetSetting("showClientInfo", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showInterventionAddress ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Lieu d'intervention</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showInterventionAddress}
                      onCheckedChange={(checked) => updateExtranetSetting("showInterventionAddress", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showScheduledDateTime ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Date et heure prévues</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showScheduledDateTime}
                      onCheckedChange={(checked) => updateExtranetSetting("showScheduledDateTime", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showDescription ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Description intervention</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showDescription}
                      onCheckedChange={(checked) => updateExtranetSetting("showDescription", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showEquipmentDetails ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Détails équipements</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showEquipmentDetails}
                      onCheckedChange={(checked) => updateExtranetSetting("showEquipmentDetails", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showEquipmentPhotos ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Photos équipements</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showEquipmentPhotos}
                      onCheckedChange={(checked) => updateExtranetSetting("showEquipmentPhotos", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showReport ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Compte rendu</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showReport}
                      onCheckedChange={(checked) => updateExtranetSetting("showReport", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {extranetSettings.showSignature ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">Signature client</span>
                    </div>
                    <Switch
                      checked={extranetSettings.showSignature}
                      onCheckedChange={(checked) => updateExtranetSetting("showSignature", checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Custom text */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium text-sm text-muted-foreground">Textes personnalisés</h3>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Message de bienvenue</Label>
                  <Textarea
                    id="welcomeMessage"
                    value={extranetSettings.welcomeMessage}
                    onChange={(e) => updateExtranetSetting("welcomeMessage", e.target.value)}
                    placeholder="Bienvenue sur votre espace client. Retrouvez ici le détail de votre intervention."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customFooterText">Texte de pied de page</Label>
                  <Input
                    id="customFooterText"
                    value={extranetSettings.customFooterText}
                    onChange={(e) => updateExtranetSetting("customFooterText", e.target.value)}
                    placeholder="Merci pour votre confiance - N'hésitez pas à nous contacter"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button 
            onClick={handleSaveExtranetSettings} 
            disabled={updateExtranetSettingsMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateExtranetSettingsMutation.isPending ? "Enregistrement..." : "Enregistrer les paramètres extranet"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
