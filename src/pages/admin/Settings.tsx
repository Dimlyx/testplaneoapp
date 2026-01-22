import { useState } from "react";
import { Settings as SettingsIcon, Tag, FileText, Palette, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import InterventionTypesSettings from "@/components/settings/InterventionTypesSettings";

// Report settings stored in localStorage for now
const REPORT_SETTINGS_KEY = "report_settings";

interface ReportSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  logoUrl: string;
}

const defaultReportSettings: ReportSettings = {
  companyName: "SportEquip Services",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  primaryColor: "#1e3a5f",
  accentColor: "#3b82f6",
  footerText: "Merci pour votre confiance",
  logoUrl: "",
};

const getStoredSettings = (): ReportSettings => {
  try {
    const stored = localStorage.getItem(REPORT_SETTINGS_KEY);
    if (stored) {
      return { ...defaultReportSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error loading report settings:", e);
  }
  return defaultReportSettings;
};

export default function Settings() {
  const { toast } = useToast();
  const [reportSettings, setReportSettings] = useState<ReportSettings>(getStoredSettings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveReportSettings = () => {
    setIsSaving(true);
    try {
      localStorage.setItem(REPORT_SETTINGS_KEY, JSON.stringify(reportSettings));
      toast({
        title: "Paramètres enregistrés",
        description: "Les paramètres des rapports ont été sauvegardés.",
      });
    } catch (e) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateReportSetting = <K extends keyof ReportSettings>(
    key: K,
    value: ReportSettings[K]
  ) => {
    setReportSettings((prev) => ({ ...prev, [key]: value }));
  };

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
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="intervention-types" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Types d'intervention
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rapports PDF
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
                Ces informations apparaîtront sur les rapports PDF
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
                  className="p-4 text-white"
                  style={{ backgroundColor: reportSettings.primaryColor }}
                >
                  <p className="font-bold">{reportSettings.companyName || "Nom de l'entreprise"}</p>
                  <p className="text-sm opacity-80">RAPPORT D'INTERVENTION</p>
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
                  {reportSettings.footerText || "Pied de page"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveReportSettings} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
