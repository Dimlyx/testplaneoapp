import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEquipment, useCreateEquipment, useUpdateEquipment } from "@/hooks/useEquipment";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const equipmentSchema = z.object({
  client_id: z.string().min(1, "Le client est requis"),
  equipment_type: z.string().min(1, "Le type est requis"),
  brand: z.string().min(1, "La marque est requise"),
  model: z.string().min(1, "Le modèle est requis"),
  serial_number: z.string().optional(),
  installation_date: z.string().optional(),
  notes: z.string().optional(),
});

type EquipmentFormValues = z.infer<typeof equipmentSchema>;

const equipmentTypes = [
  "Tapis de course",
  "Vélo elliptique",
  "Vélo d'appartement",
  "Rameur",
  "Banc de musculation",
  "Machine à charges guidées",
  "Stepper",
  "Trampoline fitness",
  "Table de ping-pong",
  "Baby-foot",
  "Autre",
];

const EquipmentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const preselectedClientId = searchParams.get("client");

  const { data: allEquipment = [], isLoading: loadingEquipment } = useEquipment();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();

  const equipment = isEditing ? allEquipment.find(e => e.id === id) : null;

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      client_id: preselectedClientId || "",
      equipment_type: "",
      brand: "",
      model: "",
      serial_number: "",
      installation_date: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (equipment && isEditing) {
      form.reset({
        client_id: equipment.client_id,
        equipment_type: equipment.equipment_type,
        brand: equipment.brand,
        model: equipment.model,
        serial_number: equipment.serial_number || "",
        installation_date: equipment.installation_date || "",
        notes: equipment.notes || "",
      });
    }
  }, [equipment, isEditing, form]);

  const onSubmit = async (values: EquipmentFormValues) => {
    try {
      const data = {
        client_id: values.client_id,
        equipment_type: values.equipment_type,
        brand: values.brand,
        model: values.model,
        serial_number: values.serial_number || null,
        installation_date: values.installation_date || null,
        notes: values.notes || null,
      };

      if (isEditing && id) {
        await updateEquipment.mutateAsync({ id, ...data });
        toast({ title: "Équipement mis à jour avec succès" });
      } else {
        await createEquipment.mutateAsync(data);
        toast({ title: "Équipement créé avec succès" });
      }
      navigate("/admin/equipment");
    } catch (error) {
      toast({ 
        title: isEditing ? "Erreur lors de la mise à jour" : "Erreur lors de la création", 
        variant: "destructive" 
      });
    }
  };

  if ((isEditing && loadingEquipment) || loadingClients) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? "Modifier l'équipement" : "Nouvel équipement"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Modifiez les informations de l'équipement" : "Ajoutez un nouvel équipement"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="equipment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type d'équipement *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {equipmentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marque *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Technogym" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modèle *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Run 1000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Détails techniques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="serial_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de série</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: SN123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="installation_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'installation</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notes sur l'équipement..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createEquipment.isPending || updateEquipment.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Mettre à jour" : "Créer l'équipement"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default EquipmentForm;
