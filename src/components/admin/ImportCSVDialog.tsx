import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { useCreateClient, type CreateClientData, type ClientType } from '@/hooks/useClients';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  name: string;
  client_type: ClientType;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  notes: string;
  valid: boolean;
  error?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeClientType(value: string): ClientType {
  const lower = value.toLowerCase().trim();
  if (['professionnel', 'professional', 'pro', 'entreprise'].includes(lower)) {
    return 'professional';
  }
  return 'individual';
}

const EXPECTED_HEADERS = ['nom', 'type', 'email', 'telephone', 'adresse', 'ville', 'code_postal', 'notes'];

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const { data: organizationId } = useUserOrganization();
  const createClient = useCreateClient(organizationId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [importResults, setImportResults] = useState({ success: 0, errors: 0 });

  const reset = () => {
    setParsedRows([]);
    setStep('upload');
    setImportResults({ success: 0, errors: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const downloadTemplate = () => {
    const header = 'nom;type;email;telephone;adresse;ville;code_postal;notes';
    const example = 'Dupont SARL;professionnel;contact@dupont.fr;0601020304;12 rue de Paris;Lyon;69001;Client fidèle';
    const csv = `${header}\n${example}`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_import_clients.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: 'Fichier vide ou invalide', variant: 'destructive' });
        return;
      }

      // Skip header
      const rows = lines.slice(1).map((line): ParsedRow => {
        const cols = parseCSVLine(line);
        const name = cols[0] || '';
        const clientType = normalizeClientType(cols[1] || '');

        if (!name) {
          return {
            name, client_type: clientType,
            email: cols[2] || '', phone: cols[3] || '',
            address: cols[4] || '', city: cols[5] || '',
            postal_code: cols[6] || '', notes: cols[7] || '',
            valid: false, error: 'Nom requis',
          };
        }

        return {
          name, client_type: clientType,
          email: cols[2] || '', phone: cols[3] || '',
          address: cols[4] || '', city: cols[5] || '',
          postal_code: cols[6] || '', notes: cols[7] || '',
          valid: true,
        };
      });

      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        const data: CreateClientData = {
          name: row.name,
          client_type: row.client_type,
          email: row.email || undefined,
          phone: row.phone || undefined,
          address: row.address || undefined,
          city: row.city || undefined,
          postal_code: row.postal_code || undefined,
          notes: row.notes || undefined,
        };
        await createClient.mutateAsync(data);
        success++;
      } catch {
        errors++;
      }
    }

    setImportResults({ success, errors });
    setStep('done');
    setImporting(false);
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des clients (CSV)
          </DialogTitle>
          <DialogDescription>
            Importez vos clients depuis un fichier CSV.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Glissez un fichier CSV ici ou cliquez pour sélectionner</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Colonnes attendues : nom, type, email, telephone, adresse, ville, code_postal, notes
                </p>
                <p className="text-xs text-muted-foreground">
                  Séparateur : virgule (,) ou point-virgule (;)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex gap-2 justify-center">
                <Button onClick={() => fileInputRef.current?.click()}>
                  Choisir un fichier
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Modèle CSV
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" /> {validCount} valide{validCount > 1 ? 's' : ''}
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" /> {invalidCount} erreur{invalidCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Nom</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Ville</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr key={i} className={!row.valid ? 'bg-destructive/5' : ''}>
                      <td className="px-3 py-1.5">
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-xs text-destructive">{row.error}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-medium">{row.name || '-'}</td>
                      <td className="px-3 py-1.5">
                        {row.client_type === 'professional' ? 'Pro' : 'Particulier'}
                      </td>
                      <td className="px-3 py-1.5">{row.email || '-'}</td>
                      <td className="px-3 py-1.5">{row.city || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Annuler</Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                {importing ? 'Import en cours...' : `Importer ${validCount} client${validCount > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <p className="text-lg font-semibold">{importResults.success} client{importResults.success > 1 ? 's' : ''} importé{importResults.success > 1 ? 's' : ''}</p>
              {importResults.errors > 0 && (
                <p className="text-sm text-destructive mt-1">{importResults.errors} erreur{importResults.errors > 1 ? 's' : ''}</p>
              )}
            </div>
            <Button onClick={() => handleClose(false)}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
