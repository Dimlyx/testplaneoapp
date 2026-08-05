import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeFileName } from "@/lib/sanitize-filename";

interface ContractFileUploadProps {
  clientId: string | undefined;
  fileUrl: string | null;
  fileName: string | null;
}

export function ContractFileUpload({ clientId, fileUrl, fileName }: ContractFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  if (!clientId) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Enregistrez d'abord le client pour pouvoir joindre le contrat.
      </div>
    );
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['client', clientId] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Maximum 20 Mo.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const path = `${clientId}/contract_${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from('client-documents').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('client-documents').getPublicUrl(path);

      const { error } = await supabase
        .from('clients')
        .update({ contract_file_url: urlData.publicUrl, contract_file_name: file.name })
        .eq('id', clientId);
      if (error) throw error;

      toast({ title: 'Contrat ajouté' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!fileUrl) return;
    setUploading(true);
    try {
      const url = new URL(fileUrl);
      const parts = url.pathname.split('/client-documents/');
      if (parts.length > 1) {
        await supabase.storage.from('client-documents').remove([decodeURIComponent(parts[1])]);
      }
      const { error } = await supabase
        .from('clients')
        .update({ contract_file_url: null, contract_file_name: null })
        .eq('id', clientId);
      if (error) throw error;
      toast({ title: 'Contrat supprimé' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (fileUrl) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="p-2 rounded-md bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || 'Contrat'}</p>
          <p className="text-xs text-muted-foreground">Fichier joint au contrat</p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={fileUrl} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4 mr-1.5" />
            Ouvrir
          </a>
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={handleRemove} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Joindre le contrat</p>
        <p className="text-xs text-muted-foreground">PDF, image ou document — 20 Mo max</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
        Téléverser
      </Button>
    </div>
  );
}
