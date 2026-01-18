import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useIntervention, useCreateIntervention, useUpdateIntervention } from "@/hooks/useInterventions";
import { useClients } from "@/hooks/useClients";
import { useClientEquipment } from "@/hooks/useEquipment";
import { useTechnicians } from "@/hooks/useTechnicians";
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

const interventionSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  client_id: z.string().min(1, "Le client est requis"),
  equipment_id: z.string().optional(),
  technician_id: z.string().optional(),
  intervention_type: z.enum(["sav", "maintenance", "installation"]),
  status: z.enum(["to_plan", "planned", "in_progress", "completed"]),
  scheduled_date: z.string().optional(),
  scheduled_time: z.string().optional(),
  report: z.string().optional(),
  technical_comments: z.string().optional(),
});

type InterventionFormValues = z.infer<typeof interventionSchema>;

const InterventionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { data: intervention, isLoading: loadingIntervention } = useIntervention(id || "");
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: technicians = [], isLoading: loadingTechnicians } = useTechnicians();
  const createIntervention = useCreateIntervention();
  const updateIntervention = useUpdateIntervention();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const { data: clientEquipment = [] } = useClientEquipment(selectedClientId);

  const form = useForm<InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: {
      title: "",
      description: "",
      client_id: "",
      equipment_id: "",
      technician_id: "",
      intervention_type: "sav",
      status: "to_plan",
      scheduled_date: "",
      scheduled_time: "",
      report: "",
      technical_comments: "",
    },
  });

  useEffect(() => {
    if (intervention && isEditing) {
      form.reset({
        title: intervention.title,
        description: intervention.description || "",
        client_id: intervention.client_id,
        equipment_id: intervention.equipment_id || "",
        technician_id: intervention.technician_id || "",
        intervention_type: intervention.intervention_type,
        status: intervention.status,
        scheduled_date: intervention.scheduled_date || "",
        scheduled_time: intervention.scheduled_time || "",
        report: intervention.report || "",
        technical_comments: intervention.technical_comments || "",
      });
      setSelectedClientId(intervention.client_id);
    }
  }, [intervention, isEditing, form]);

  const onSubmit = async (values: InterventionFormValues) => {
    try {
      const data = {
        title: values.title,
        client_id: values.client_id,
        intervention_type: values.intervention_type,
        status: values.status,
        equipment_id: values.equipment_id || null,
        technician_id: values.technician_id || null,
        scheduled_date: values.scheduled_date || null,
        scheduled_time: values.scheduled_time || null,
        description: values.description || null,
        report: values.report || null,
        technical_comments: values.technical_comments || null,
      };

      if (isEditing && id) {
        await updateIntervention.mutateAsync({ id, ...data });
        toast({ title: "Intervention mise à jour avec succès" });
      } else {
        await createIntervention.mutateAsync(data);
        toast({ title: "Intervention créée avec succès" });
      }
      navigate("/admin/interventions");
    } catch (error) {
      toast({ 
        title: isEditing ? "Erreur lors de la mise à jour" : "Erreur lors de la création", 
        variant: "destructive" 
      });
    }
  };

  if ((isEditing && loadingIntervention) || loadingClients || loadingTechnicians) {
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
            {isEditing ? "Modifier l'intervention" : "Nouvelle intervention"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Modifiez les détails de l'intervention" : "Créez une nouvelle intervention"}
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
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Titre de l'intervention" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Description détaillée de l'intervention" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="intervention_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sav">SAV</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="installation">Installation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="to_plan">À planifier</SelectItem>
                            <SelectItem value="planned">Planifiée</SelectItem>
                            <SelectItem value="in_progress">En cours</SelectItem>
                            <SelectItem value="completed">Terminée</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assignation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedClientId(value);
                          form.setValue("equipment_id", "");
                        }} 
                        value={field.value}
                      >
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
                  name="equipment_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Équipement</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!selectedClientId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedClientId ? "Sélectionner un équipement" : "Sélectionnez d'abord un client"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientEquipment.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.brand} {eq.model} - {eq.equipment_type}
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
                  name="technician_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technicien</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un technicien" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.full_name || tech.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="scheduled_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date prévue</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduled_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heure prévue</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Compte rendu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rapport d'intervention</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Compte rendu de l'intervention..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technical_comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaires techniques</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Commentaires techniques (usage interne)..." 
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
            <Button type="submit" disabled={createIntervention.isPending || updateIntervention.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Mettre à jour" : "Créer l'intervention"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default InterventionForm;
