import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Mail, Save, RotateCcw, Eye, Building2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const AVAILABLE_VARIABLES = [
  { key: '{{client_name}}', label: 'Nom du client' },
  { key: '{{intervention_title}}', label: 'Titre de l\'intervention' },
  { key: '{{scheduled_date}}', label: 'Date planifiée' },
  { key: '{{scheduled_time}}', label: 'Heure planifiée' },
  { key: '{{address}}', label: 'Adresse complète' },
  { key: '{{description}}', label: 'Description' },
  { key: '{{org_name}}', label: 'Nom de l\'organisation' },
  { key: '{{org_email}}', label: 'Email de l\'organisation' },
  { key: '{{org_phone}}', label: 'Téléphone de l\'organisation' },
];

const DEFAULT_TEMPLATE = {
  subject: 'Intervention planifiée - {{intervention_title}}',
  greeting: 'Bonjour {{client_name}},',
  body_text: 'Nous vous informons qu\'une intervention a été planifiée :',
  closing_text: 'N\'hésitez pas à nous contacter pour toute question.',
  signature_text: 'Cordialement,',
  header_color: '#003057',
  footer_text: '',
};

interface TemplateForm {
  subject: string;
  greeting: string;
  body_text: string;
  closing_text: string;
  signature_text: string;
  header_color: string;
  footer_text: string;
}

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<TemplateForm>({ ...DEFAULT_TEMPLATE });

  const { data: organizations, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: template, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['email-template', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('template_type', 'intervention_notification')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Sync form when template loads
  const updateFormFromTemplate = (tmpl: typeof template) => {
    if (tmpl) {
      setForm({
        subject: tmpl.subject,
        greeting: tmpl.greeting,
        body_text: tmpl.body_text,
        closing_text: tmpl.closing_text,
        signature_text: tmpl.signature_text,
        header_color: tmpl.header_color,
        footer_text: tmpl.footer_text || '',
      });
    } else {
      setForm({ ...DEFAULT_TEMPLATE });
    }
  };

  // Update form when org/template changes
  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setShowPreview(false);
  };

  // Watch template data
  const prevTemplateRef = useState<string | null>(null);
  if (template !== undefined && JSON.stringify(template) !== prevTemplateRef[0]) {
    prevTemplateRef[1](JSON.stringify(template));
    updateFormFromTemplate(template);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (template) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            subject: form.subject,
            greeting: form.greeting,
            body_text: form.body_text,
            closing_text: form.closing_text,
            signature_text: form.signature_text,
            header_color: form.header_color,
            footer_text: form.footer_text,
          })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({
            organization_id: selectedOrgId,
            template_type: 'intervention_notification',
            subject: form.subject,
            greeting: form.greeting,
            body_text: form.body_text,
            closing_text: form.closing_text,
            signature_text: form.signature_text,
            header_color: form.header_color,
            footer_text: form.footer_text,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-template', selectedOrgId] });
      toast.success('Template sauvegardé avec succès');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (template) {
        const { error } = await supabase
          .from('email_templates')
          .delete()
          .eq('id', template.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setForm({ ...DEFAULT_TEMPLATE });
      queryClient.invalidateQueries({ queryKey: ['email-template', selectedOrgId] });
      toast.success('Template réinitialisé aux valeurs par défaut');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const selectedOrg = organizations?.find(o => o.id === selectedOrgId);

  const previewHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: ${form.header_color}; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${selectedOrg?.name || '{{org_name}}'}</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #374151; font-size: 16px;">${form.greeting.replace('{{client_name}}', 'Jean Dupont')}</p>
        <p style="color: #374151; font-size: 16px;">${form.body_text}</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">Maintenance climatisation</h2>
          <p style="margin: 0 0 8px 0; color: #374151;">📅 <strong>lundi 17 février 2026</strong> à <strong>09:00</strong></p>
          <p style="margin: 0; color: #374151;">📍 12 rue de la Paix, 75001 Paris</p>
        </div>
        <p style="color: #374151; font-size: 16px;">${form.closing_text}</p>
        <p style="color: #374151; font-size: 16px;">${form.signature_text}<br><strong>${selectedOrg?.name || '{{org_name}}'}</strong></p>
      </div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">contact@example.com</p>
        ${form.footer_text ? `<p style="margin: 8px 0 0 0;">${form.footer_text}</p>` : ''}
      </div>
    </div>`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="h-6 w-6" />
          Templates d'emails
        </h1>
        <p className="text-muted-foreground">
          Personnalisez les emails envoyés aux clients pour chaque organisation
        </p>
      </div>

      {/* Organization selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Sélectionner une organisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingOrgs ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedOrgId} onValueChange={handleOrgChange}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choisir une organisation..." />
              </SelectTrigger>
              <SelectContent>
                {organizations?.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedOrgId && (
        <>
          {/* Variables reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Variables disponibles
              </CardTitle>
              <CardDescription>
                Utilisez ces variables dans vos textes, elles seront remplacées automatiquement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Tooltip key={v.key}>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help font-mono text-xs">
                        {v.key}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{v.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Template editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Notification d'intervention
                    {template && <Badge variant="outline" className="ml-2">Personnalisé</Badge>}
                    {!template && !isLoadingTemplate && <Badge variant="secondary" className="ml-2">Par défaut</Badge>}
                  </CardTitle>
                  <CardDescription>Email envoyé au client lors de la planification d'une intervention</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {showPreview ? 'Masquer' : 'Aperçu'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingTemplate ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Objet de l'email</Label>
                      <Input
                        value={form.subject}
                        onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Intervention planifiée - {{intervention_title}}"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur d'en-tête</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={form.header_color}
                          onChange={(e) => setForm(f => ({ ...f, header_color: e.target.value }))}
                          className="h-10 w-14 rounded border cursor-pointer"
                        />
                        <Input
                          value={form.header_color}
                          onChange={(e) => setForm(f => ({ ...f, header_color: e.target.value }))}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Salutation</Label>
                    <Input
                      value={form.greeting}
                      onChange={(e) => setForm(f => ({ ...f, greeting: e.target.value }))}
                      placeholder="Bonjour {{client_name}},"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Texte d'introduction</Label>
                    <Textarea
                      value={form.body_text}
                      onChange={(e) => setForm(f => ({ ...f, body_text: e.target.value }))}
                      placeholder="Nous vous informons qu'une intervention a été planifiée :"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Texte de conclusion</Label>
                    <Textarea
                      value={form.closing_text}
                      onChange={(e) => setForm(f => ({ ...f, closing_text: e.target.value }))}
                      placeholder="N'hésitez pas à nous contacter pour toute question."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Signature</Label>
                    <Input
                      value={form.signature_text}
                      onChange={(e) => setForm(f => ({ ...f, signature_text: e.target.value }))}
                      placeholder="Cordialement,"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pied de page</Label>
                    <Textarea
                      value={form.footer_text}
                      onChange={(e) => setForm(f => ({ ...f, footer_text: e.target.value }))}
                      placeholder="Texte additionnel affiché en bas de l'email (ex: mentions légales, horaires...)"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                    {template && (
                      <Button
                        variant="outline"
                        onClick={() => resetMutation.mutate()}
                        disabled={resetMutation.isPending}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Réinitialiser par défaut
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aperçu de l'email</CardTitle>
                <CardDescription>Rendu avec des données d'exemple</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="bg-muted/30 p-4 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}