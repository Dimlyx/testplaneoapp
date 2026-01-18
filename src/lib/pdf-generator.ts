import { jsPDF } from "jspdf";
import { Intervention } from "@/hooks/useInterventions";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Client = Tables<"clients">;

interface InterventionPhoto {
  id: string;
  photo_url: string;
  photo_type: 'serial_number' | 'during' | 'after';
  equipment_id?: string | null;
}

interface InterventionEquipmentData {
  id: string;
  equipment_id: string;
  technical_comments: string | null;
  equipment_functional: boolean | null;
  equipment?: {
    id: string;
    brand: string;
    model: string;
    equipment_type: string;
    serial_number: string | null;
  };
}

interface PDFGeneratorOptions {
  intervention: Intervention;
  client: Client;
  technicianName?: string;
  photos?: InterventionPhoto[];
  interventionEquipments?: InterventionEquipmentData[];
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
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (err) {
        console.error('Error processing image:', err);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    
    img.src = url;
  });
};

export const generateInterventionPDF = async (
  intervention: Intervention, 
  client: Client, 
  equipment?: Tables<"equipment"> | null,
  technicianName?: string,
  photos?: InterventionPhoto[],
  interventionEquipments?: InterventionEquipmentData[]
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
  
  const addSection = (title: string, y: number, bgColor: [number, number, number] = [240, 240, 240]) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
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

  // ================== HEADER ==================
  doc.setFillColor(0, 48, 87);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  centerText("RAPPORT D'INTERVENTION", 15, 18);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  centerText(client.name, 25, 10);
  
  doc.setTextColor(0, 0, 0);
  yPos = 45;

  // Reference & Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Référence : INT-${intervention.id.slice(0, 8).toUpperCase()}`, 15, yPos);
  doc.text(`Date : ${intervention.scheduled_date ? format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr }) : format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, pageWidth - 60, yPos);
  yPos += 15;

  // ================== CLIENT SECTION ==================
  yPos = addSection("INFORMATIONS CLIENT", yPos);
  yPos = addField("Client", client.name, yPos);
  yPos = addField("Type", client.client_type === 'individual' ? 'Particulier' : 'Professionnel', yPos);
  if (client.phone) yPos = addField("Téléphone", client.phone, yPos);
  if (client.email) yPos = addField("Email", client.email, yPos);
  const fullAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
  if (fullAddress) yPos = addField("Adresse chantier", fullAddress, yPos);
  yPos += 5;

  // ================== INTERVENTION DETAILS ==================
  yPos = addSection("DÉTAILS DE L'INTERVENTION", yPos);
  yPos = addField("Titre", intervention.title, yPos);
  yPos = addField("Type", 
    intervention.intervention_type === 'sav' ? 'SAV' : 
    intervention.intervention_type === 'maintenance' ? 'Maintenance' : 'Installation', 
    yPos
  );
  if (technicianName) {
    yPos = addField("Technicien", technicianName, yPos);
  }
  yPos += 5;

  // ================== TIME TRACKING ==================
  yPos = addSection("HORAIRES D'INTERVENTION", yPos);
  const col2X = 110;
  let baseY = yPos;
  yPos = addField("Heure d'arrivée", intervention.arrival_time || "N/C", yPos);
  addField("Heure de départ", intervention.departure_time || "N/C", baseY, col2X);
  
  if (intervention.arrival_time && intervention.departure_time) {
    const [arrH, arrM] = intervention.arrival_time.split(':').map(Number);
    const [depH, depM] = intervention.departure_time.split(':').map(Number);
    const totalMinutes = (depH * 60 + depM) - (arrH * 60 + arrM);
    if (totalMinutes > 0) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const duration = hours > 0 ? `${hours} heure(s) ${minutes} minute(s)` : `${minutes} minutes`;
      yPos = addField("Durée de l'intervention", duration, yPos);
    }
  }
  yPos += 5;

  // ================== TRAVAUX EFFECTUÉS ==================
  yPos = addSection("TRAVAUX EFFECTUÉS - COMPTE-RENDU", yPos);
  doc.setFontSize(9);
  const reportText = intervention.report || "Aucun compte rendu";
  const reportLines = doc.splitTextToSize(reportText, pageWidth - 30);
  doc.text(reportLines, 15, yPos);
  yPos += reportLines.length * 5 + 8;

  // ================== EQUIPMENTS SECTION ==================
  if (interventionEquipments && interventionEquipments.length > 0) {
    for (let i = 0; i < interventionEquipments.length; i++) {
      const eq = interventionEquipments[i];
      const eqInfo = eq.equipment;
      const eqPhotos = photos?.filter(p => p.equipment_id === eq.equipment_id) || [];
      
      checkNewPage(80);
      
      // Equipment header with blue background
      yPos = addSection(`ÉQUIPEMENT ${i + 1}: ${eqInfo?.brand || ''} ${eqInfo?.model || ''}`, yPos, [0, 80, 150]);
      doc.setTextColor(0, 0, 0);
      
      // Equipment details
      if (eqInfo) {
        yPos = addField("Type", eqInfo.equipment_type, yPos);
        yPos = addField("Marque", eqInfo.brand, yPos);
        yPos = addField("Modèle", eqInfo.model, yPos);
        if (eqInfo.serial_number) yPos = addField("N° Série", eqInfo.serial_number, yPos);
      }
      yPos += 3;

      // Photos S/N
      const snPhotos = eqPhotos.filter(p => p.photo_type === 'serial_number');
      if (snPhotos.length > 0) {
        checkNewPage(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Photos N° de série", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        
        for (const photo of snPhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          if (base64) {
            checkNewPage(50);
            try {
              doc.addImage(base64, 'JPEG', 15, yPos, 60, 45);
              yPos += 50;
            } catch (e) {
              console.error('Error adding SN photo:', e);
            }
          }
        }
      }

      // Photo de l'équipement (during photos)
      const duringPhotos = eqPhotos.filter(p => p.photo_type === 'during');
      if (duringPhotos.length > 0) {
        checkNewPage(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Photo de l'équipement", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        
        let xPos = 15;
        let photoCount = 0;
        for (const photo of duringPhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          if (base64) {
            if (photoCount > 0 && photoCount % 2 === 0) {
              xPos = 15;
              yPos += 50;
              checkNewPage(50);
            }
            try {
              doc.addImage(base64, 'JPEG', xPos, yPos, 60, 45);
              xPos += 70;
              photoCount++;
            } catch (e) {
              console.error('Error adding during photo:', e);
            }
          }
        }
        if (photoCount > 0) yPos += 50;
      }

      // Technical comments / Observation
      if (eq.technical_comments) {
        checkNewPage(30);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Observation", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        doc.setFontSize(9);
        const commentLines = doc.splitTextToSize(eq.technical_comments, pageWidth - 30);
        doc.text(commentLines, 15, yPos);
        yPos += commentLines.length * 5 + 5;
      }

      // Test de l'équipement
      checkNewPage(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Test de l'équipement", 15, yPos);
      doc.setFont("helvetica", "normal");
      yPos += 5;
      doc.setFontSize(9);
      const funcStatus = eq.equipment_functional !== false ? "Oui" : "Non";
      doc.text(`L'équipement fonctionne correctement: ${funcStatus}`, 15, yPos);
      yPos += 8;

      // Photos après (after photos)
      const afterPhotos = eqPhotos.filter(p => p.photo_type === 'after');
      if (afterPhotos.length > 0) {
        checkNewPage(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Photos après intervention", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        
        let xPos = 15;
        let photoCount = 0;
        for (const photo of afterPhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          if (base64) {
            if (photoCount > 0 && photoCount % 2 === 0) {
              xPos = 15;
              yPos += 50;
              checkNewPage(50);
            }
            try {
              doc.addImage(base64, 'JPEG', xPos, yPos, 60, 45);
              xPos += 70;
              photoCount++;
            } catch (e) {
              console.error('Error adding after photo:', e);
            }
          }
        }
        if (photoCount > 0) yPos += 55;
      }
      
      yPos += 5;
    }
  } else if (equipment) {
    // Legacy: single equipment mode
    yPos = addSection("ÉQUIPEMENT", yPos);
    yPos = addField("Type", equipment.equipment_type, yPos);
    yPos = addField("Marque", equipment.brand, yPos);
    yPos = addField("Modèle", equipment.model, yPos);
    if (equipment.serial_number) yPos = addField("N° Série", equipment.serial_number, yPos);
    yPos += 5;
    
    // Legacy photos
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
            } catch (imgErr) {
              doc.setDrawColor(200, 200, 200);
              doc.rect(xPos, yPos, photoWidth, photoHeight);
            }
            
            xPos += photoWidth + 5;
            photoCount++;
          }
        }
        
        yPos += photoHeight + 10;
      }
    }
    
    // Equipment status
    yPos = addSection("TEST DE L'ÉQUIPEMENT", yPos);
    doc.setFontSize(9);
    const funcStatus = intervention.equipment_functional !== false ? "Oui" : "Non";
    yPos = addField("L'équipement fonctionne correctement", funcStatus, yPos);
    yPos += 10;
  }

  // ================== OBSERVATIONS ==================
  if (intervention.observations) {
    checkNewPage(30);
    yPos = addSection("OBSERVATIONS GÉNÉRALES", yPos);
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(intervention.observations, pageWidth - 30);
    doc.text(obsLines, 15, yPos);
    yPos += obsLines.length * 5 + 8;
  }

  // ================== SIGNATURE ==================
  checkNewPage(70);
  yPos = addSection("SIGNATURE DU CLIENT", yPos);
  yPos += 5;
  
  if (intervention.client_signature_name) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Signataire : ${intervention.client_signature_name}`, 15, yPos);
    yPos += 8;
  }
  
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, yPos, 80, 35);
  
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

  // ================== FOOTER ==================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    centerText(`Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} - Page ${i}/${totalPages}`, footerY, 8);
  }

  // Save
  doc.save(`intervention-${intervention.id.slice(0, 8)}.pdf`);
};
