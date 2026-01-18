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

const MAX_IMAGE_WIDTH = 400;
const MAX_IMAGE_HEIGHT = 300;
const JPEG_QUALITY = 0.6;

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn('Image load timeout:', url);
      resolve(null);
    }, 10000); // 10 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        // Calculate scaled dimensions to compress the image
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > MAX_IMAGE_WIDTH) {
          height = (height * MAX_IMAGE_WIDTH) / width;
          width = MAX_IMAGE_WIDTH;
        }
        if (height > MAX_IMAGE_HEIGHT) {
          width = (width * MAX_IMAGE_HEIGHT) / height;
          height = MAX_IMAGE_HEIGHT;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Use better image smoothing for compression
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          console.log('Image loaded and compressed:', url.substring(0, 50) + '...');
          resolve(dataUrl);
        } else {
          console.error('Could not get canvas context');
          resolve(null);
        }
      } catch (err) {
        console.error('Error processing image:', err);
        resolve(null);
      }
    };
    
    img.onerror = (err) => {
      clearTimeout(timeout);
      console.error('Failed to load image:', url, err);
      resolve(null);
    };
    
    // Try loading without cache buster first (simpler approach)
    img.src = url;
  });
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
    console.log('Adding photos to PDF, count:', photos.length);
    
    const photoTypes = {
      serial_number: { title: "PHOTO DU NUMÉRO DE SÉRIE", photos: photos.filter(p => p.photo_type === 'serial_number') },
      during: { title: "PHOTOS PENDANT INTERVENTION", photos: photos.filter(p => p.photo_type === 'during') },
      after: { title: "PHOTOS APRÈS INTERVENTION", photos: photos.filter(p => p.photo_type === 'after') },
    };

    for (const [photoType, { title, photos: typePhotos }] of Object.entries(photoTypes)) {
      if (typePhotos.length === 0) continue;
      
      console.log(`Processing ${photoType} photos:`, typePhotos.length);

      checkNewPage(60);
      yPos = addSection(title, yPos);

      const photoWidth = 55;
      const photoHeight = 40;
      const photosPerRow = 3;
      let xPos = 15;
      let photoCount = 0;
      let successCount = 0;

      for (const photo of typePhotos) {
        console.log('Loading photo:', photo.photo_url.substring(0, 80) + '...');
        const base64 = await loadImageAsBase64(photo.photo_url);
        
        if (base64) {
          console.log('Photo loaded successfully, adding to PDF');
          if (photoCount > 0 && photoCount % photosPerRow === 0) {
            xPos = 15;
            yPos += photoHeight + 5;
            checkNewPage(photoHeight + 10);
          }

          try {
            doc.addImage(base64, 'JPEG', xPos, yPos, photoWidth, photoHeight);
            successCount++;
          } catch (imgErr) {
            console.error('Error adding image to PDF:', imgErr);
            // Add placeholder for failed image
            doc.setDrawColor(200, 200, 200);
            doc.rect(xPos, yPos, photoWidth, photoHeight);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("Erreur image", xPos + 10, yPos + photoHeight / 2);
            doc.setTextColor(0, 0, 0);
          }
          
          xPos += photoWidth + 5;
          photoCount++;
        } else {
          console.warn('Failed to load photo, skipping:', photo.photo_url.substring(0, 50));
          // Add placeholder for failed load
          if (photoCount > 0 && photoCount % photosPerRow === 0) {
            xPos = 15;
            yPos += photoHeight + 5;
            checkNewPage(photoHeight + 10);
          }
          doc.setDrawColor(200, 200, 200);
          doc.rect(xPos, yPos, photoWidth, photoHeight);
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("Photo non chargée", xPos + 5, yPos + photoHeight / 2);
          doc.setTextColor(0, 0, 0);
          xPos += photoWidth + 5;
          photoCount++;
        }
      }
      
      console.log(`${photoType}: ${successCount}/${typePhotos.length} photos added successfully`);
      yPos += photoHeight + 10;
    }
  } else {
    console.log('No photos to add to PDF');
  }

  // Check if we need a new page for signature
  checkNewPage(70);

  // Signature Section (Client only)
  yPos = addSection("SIGNATURE DU CLIENT", yPos);
  yPos += 5;
  
  // Client signature name
  if (intervention.client_signature_name) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Signataire : ${intervention.client_signature_name}`, 15, yPos);
    yPos += 8;
  }
  
  // Signature box
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, yPos, 80, 35);
  
  // Try to load client signature image if available
  if (intervention.client_signature_url) {
    try {
      const signatureBase64 = await loadImageAsBase64(intervention.client_signature_url);
      if (signatureBase64) {
        doc.addImage(signatureBase64, 'PNG', 17, yPos + 2, 76, 31);
      }
    } catch (err) {
      console.error('Error loading signature:', err);
    }
  }
  
  yPos += 40;

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  centerText(`Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, footerY, 8);
  centerText("SportEquip Services - contact@sportequip.fr - 01 23 45 67 89", footerY + 5, 8);

  // Save
  doc.save(`intervention-${intervention.id.slice(0, 8)}.pdf`);
};
