import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateClient } from '@/hooks/useClients';
import { useUserOrganization } from '@/hooks/useUserOrganization';

interface QuickCreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: (clientId: string) => void;
}

export function QuickCreateClientDialog({
  open,
  onOpenChange,
  onClientCreated,
}: QuickCreateClientDialogProps) {
  const { data: organizationId } = useUserOrganization();
  const createClient = useCreateClient(organizationId);

  const [formData, setFormData] = useState({
    name: '',
    client_type: 'individual' as 'individual' | 'professional',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const result = await createClient.mutateAsync({
      name: formData.name,
      client_type: formData.client_type,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      postal_code: formData.postal_code || undefined,
    });

    onClientCreated(result.id);
    setFormData({
      name: '',
      client_type: 'individual',
      email: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qc-name">Nom *</Label>
              <Input
                id="qc-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nom du client"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-type">Type</Label>
              <Select
                value={formData.client_type}
                onValueChange={(value: 'individual' | 'professional') =>
                  setFormData(prev => ({ ...prev, client_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Particulier</SelectItem>
                  <SelectItem value="professional">Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qc-email">Email</Label>
              <Input
                id="qc-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-phone">Téléphone</Label>
              <Input
                id="qc-phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-address">Adresse</Label>
            <Input
              id="qc-address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Adresse"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qc-postal">Code postal</Label>
              <Input
                id="qc-postal"
                value={formData.postal_code}
                onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                placeholder="75000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-city">Ville</Label>
              <Input
                id="qc-city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Paris"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? 'Création...' : 'Créer le client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
