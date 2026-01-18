import { jsPDF } from "jspdf";
import { Intervention } from "@/hooks/useInterventions";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Client = Tables<"clients">;
type Equipment = Tables<"equipment"> | null;

interface InterventionPhoto {
  id: string;
  photo_url: string;
  photo_type: 'serial_number' | 'during' | 'after';
}

interface PDFInterventionData {
  intervention: Intervention;
  client: Client;
  equipment?: Equipment;
  technicianName?: string;
}

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const generateInterventionPDF = async (
  intervention: Intervention, 
  client: Client, 
  equipment?: Equipment,
  technicianName?: string,
  photos?: InterventionPhoto[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;
  
  // Helper functions
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };
  
  const addSection = (title: string, y: number) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
    doc.text(title, 15, y);
    doc.setFont("helvetica", "normal");
    return y + 10;
  };
  
  const addField = (label: string, value: string, y: number, x: number = 15) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", x, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "N/C", x + doc.getTextWidth(label + ": "), y);
    return y + 6;
  };

  const checkNewPage = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(0, 48, 87); // Navy blue
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  centerText("RAPPORT D'INTERVENTION", 15, 18);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  centerText("SportEquip Services", 25, 10);
  
  doc.setTextColor(0, 0, 0);
  yPos = 45;

  // Reference & Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Référence : INT-${intervention.id.slice(0, 8).toUpperCase()}`, 15, yPos);
  doc.text(`Date : ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, pageWidth - 60, yPos);
  yPos += 15;

  // Client Section
  yPos = addSection("INFORMATIONS CLIENT", yPos);
  yPos = addField("Nom", client.name, yPos);
  yPos = addField("Type", client.client_type === 'individual' ? 'Particulier' : 'Professionnel', yPos);
  if (client.phone) yPos = addField("Téléphone", client.phone, yPos);
  if (client.email) yPos = addField("Email", client.email, yPos);
  const fullAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
  if (fullAddress) yPos = addField("Adresse", fullAddress, yPos);
  yPos += 5;

  // Intervention Details
  yPos = addSection("DÉTAILS DE L'INTERVENTION", yPos);
  yPos = addField("Titre", intervention.title, yPos);
  yPos = addField("Type", 
    intervention.intervention_type === 'sav' ? 'SAV' : 
    intervention.intervention_type === 'maintenance' ? 'Maintenance' : 'Installation', 
    yPos
  );
  yPos = addField("Statut", 
    intervention.status === 'to_plan' ? 'À planifier' : 
    intervention.status === 'planned' ? 'Planifiée' : 
    intervention.status === 'in_progress' ? 'En cours' : 'Terminée',
    yPos
  );
  if (intervention.scheduled_date) {
    yPos = addField("Date prévue", format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr }), yPos);
  }
  if (technicianName) {
    yPos = addField("Technicien", technicianName, yPos);
  }
  yPos += 5;

  // Equipment Section (if available)
  if (equipment) {
    yPos = addSection("ÉQUIPEMENT", yPos);
    yPos = addField("Type", equipment.equipment_type, yPos);
    yPos = addField("Marque", equipment.brand, yPos);
    yPos = addField("Modèle", equipment.model, yPos);
    if (equipment.serial_number) yPos = addField("N° Série", equipment.serial_number, yPos);
    yPos += 5;
  }

  // Time tracking
  yPos = addSection("HORAIRES D'INTERVENTION", yPos);
  const col2X = 110;
  const baseY = yPos;
  yPos = addField("Heure d'arrivée", intervention.arrival_time || "N/C", yPos);
  addField("Heure de départ", intervention.departure_time || "N/C", baseY, col2X);
  
  if (intervention.arrival_time && intervention.departure_time) {
    const [arrH, arrM] = intervention.arrival_time.split(':').map(Number);
    const [depH, depM] = intervention.departure_time.split(':').map(Number);
    const totalMinutes = (depH * 60 + depM) - (arrH * 60 + arrM);
    if (totalMinutes > 0) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes} minutes`;
      yPos = addField("Durée", duration, yPos);
    }
  }
  yPos += 5;

  // Description
  if (intervention.description) {
    yPos = addSection("DESCRIPTION", yPos);
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(intervention.description, pageWidth - 30);
    doc.text(descLines, 15, yPos);
    yPos += descLines.length * 5 + 5;
  }

  // Report
  yPos = addSection("COMPTE RENDU - TRAVAUX EFFECTUÉS", yPos);
  doc.setFontSize(9);
  const reportText = intervention.report || "Aucun compte rendu";
  const reportLines = doc.splitTextToSize(reportText, pageWidth - 30);
  doc.text(reportLines, 15, yPos);
  yPos += reportLines.length * 5 + 5;

  // Observations
  if (intervention.observations) {
    yPos = addSection("OBSERVATIONS", yPos);
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(intervention.observations, pageWidth - 30);
    doc.text(obsLines, 15, yPos);
    yPos += obsLines.length * 5 + 5;
  }

  // Equipment status
  yPos = addSection("TEST DE L'ÉQUIPEMENT", yPos);
  doc.setFontSize(9);
  const funcStatus = intervention.equipment_functional !== false ? "✓ Oui" : "✗ Non";
  yPos = addField("L'équipement fonctionne correctement", funcStatus, yPos);
  yPos += 10;

  // Photos Section
  if (photos && photos.length > 0) {
    const photoTypes = {
      serial_number: { title: "PHOTO DU NUMÉRO DE SÉRIE", photos: photos.filter(p => p.photo_type === 'serial_number') },
      during: { title: "PHOTOS PENDANT INTERVENTION", photos: photos.filter(p => p.photo_type === 'during') },
      after: { title: "PHOTOS APRÈS INTERVENTION", photos: photos.filter(p => p.photo_type === 'after') },
    };

    for (const [, { title, photos: typePhotos }] of Object.entries(photoTypes)) {
      if (typePhotos.length === 0) continue;

      checkNewPage(60);
      yPos = addSection(title, yPos);

      const photoWidth = 55;
      const photoHeight = 40;
      const photosPerRow = 3;
      let xPos = 15;
      let photoCount = 0;

      for (const photo of typePhotos) {
        const base64 = await loadImageAsBase64(photo.photo_url);
        if (base64) {
          if (photoCount > 0 && photoCount % photosPerRow === 0) {
            xPos = 15;
            yPos += photoHeight + 5;
            checkNewPage(photoHeight + 10);
          }

          try {
            doc.addImage(base64, 'JPEG', xPos, yPos, photoWidth, photoHeight);
          } catch {
            // If image fails to load, add a placeholder
            doc.setDrawColor(200, 200, 200);
            doc.rect(xPos, yPos, photoWidth, photoHeight);
            doc.setFontSize(8);
            doc.text("Image non disponible", xPos + 5, yPos + photoHeight / 2);
          }
          
          xPos += photoWidth + 5;
          photoCount++;
        }
      }
      yPos += photoHeight + 10;
    }
  }

  // Check if we need a new page for signatures
  checkNewPage(50);

  // Signatures Section
  yPos = addSection("SIGNATURES", yPos);
  yPos += 5;
  
  // Two columns for signatures
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Technicien", 30, yPos);
  doc.text("Client", 130, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 25;
  
  // Signature boxes
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, yPos - 20, 70, 20);
  doc.rect(115, yPos - 20, 70, 20);
  
  // Client signature name
  if (intervention.client_signature_name) {
    doc.setFontSize(8);
    doc.text(`Nom: ${intervention.client_signature_name}`, 115, yPos + 5);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  centerText(`Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, footerY, 8);
  centerText("SportEquip Services - contact@sportequip.fr - 01 23 45 67 89", footerY + 5, 8);

  // Save
  doc.save(`intervention-${intervention.id.slice(0, 8)}.pdf`);
};
