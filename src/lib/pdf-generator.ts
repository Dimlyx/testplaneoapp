import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Intervention = Tables<"interventions">;
type Client = Tables<"clients">;

export const generateInterventionPDF = (intervention: Intervention, client: Client) => {
  const content = `
RAPPORT D'INTERVENTION
======================

ENTREPRISE: SportEquip Services
Date du rapport: ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}

---

INFORMATIONS CLIENT
-------------------
Nom: ${client.name}
Type: ${client.client_type === 'individual' ? 'Particulier' : 'Professionnel'}
Email: ${client.email || 'Non renseigné'}
Téléphone: ${client.phone || 'Non renseigné'}
Adresse: ${client.address || ''} ${client.postal_code || ''} ${client.city || ''}

---

DÉTAILS DE L'INTERVENTION
-------------------------
Titre: ${intervention.title}
Type: ${intervention.intervention_type === 'sav' ? 'SAV' : intervention.intervention_type === 'maintenance' ? 'Maintenance' : 'Installation'}
Statut: ${intervention.status === 'to_plan' ? 'À planifier' : intervention.status === 'planned' ? 'Planifiée' : intervention.status === 'in_progress' ? 'En cours' : 'Terminée'}
Date prévue: ${intervention.scheduled_date ? format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr }) : 'Non planifiée'}
Heure: ${intervention.scheduled_time || 'Non définie'}

Description:
${intervention.description || 'Aucune description'}

---

COMPTE RENDU
------------
${intervention.report || 'Aucun compte rendu'}

---

COMMENTAIRES TECHNIQUES
-----------------------
${intervention.technical_comments || 'Aucun commentaire technique'}

---

Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
  `.trim();

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `intervention-${intervention.id.slice(0, 8)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
