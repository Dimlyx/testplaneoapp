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

type EquipmentStatus = 'not_working' | 'needs_intervention' | 'working';

interface InterventionEquipmentData {
  id: string;
  equipment_id: string;
  technical_comments: string | null;
  equipment_functional: boolean | null;
  equipment_status: EquipmentStatus | null;
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

interface ReportSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  logoUrl: string;
}

const DEFAULT_SETTINGS: ReportSettings = {
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  primaryColor: '#003057',
  accentColor: '#0050A0',
  footerText: '',
  logoUrl: '',
};

const getReportSettings = (): ReportSettings => {
  try {
    const saved = localStorage.getItem('reportSettings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading report settings:', e);
  }
  return DEFAULT_SETTINGS;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 48, 87]; // Default navy blue
};

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
  
  // Load custom settings
  const settings = getReportSettings();
  const primaryRgb = hexToRgb(settings.primaryColor);
  const accentRgb = hexToRgb(settings.accentColor);
  
  // Helper functions
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };
  
  const addSection = (title: string, y: number, useAccent: boolean = false) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    if (useAccent) {
      doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(240, 240, 240);
      doc.setTextColor(0, 0, 0);
    }
    doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
    doc.text(title, 15, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
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
  const headerHeight = 45;
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  
  let logoWidth = 0;
  const logoMargin = 15;
  
  // Add logo if available
  if (settings.logoUrl) {
    try {
      const logoBase64 = await loadImageAsBase64(settings.logoUrl);
      if (logoBase64) {
        const logoHeight = 25;
        logoWidth = 30;
        doc.addImage(logoBase64, 'JPEG', logoMargin, 10, logoWidth, logoHeight);
        logoWidth += 10; // Add spacing after logo
      }
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  }
  
  const textStartX = logoMargin + logoWidth;
  
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  
  // Company name or default title
  if (settings.companyName) {
    doc.setFontSize(12);
    doc.text(settings.companyName, textStartX, 15);
    doc.setFontSize(14);
    doc.text("RAPPORT D'INTERVENTION", textStartX, 25);
  } else {
    doc.setFontSize(16);
    doc.text("RAPPORT D'INTERVENTION", textStartX, 20);
  }
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(client.name, textStartX, 35);
  
  // Company contact info in header (right aligned)
  if (settings.companyPhone || settings.companyEmail) {
    doc.setFontSize(8);
    const contactInfo = [settings.companyPhone, settings.companyEmail].filter(Boolean).join(' | ');
    const contactWidth = doc.getTextWidth(contactInfo);
    doc.text(contactInfo, pageWidth - contactWidth - 15, 40);
  }
  
  doc.setTextColor(0, 0, 0);
  yPos = headerHeight + 10;

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
      
      // Equipment header with accent color
      // Build equipment header - exclude "À identifier" values
      const brandDisplay = eqInfo?.brand && eqInfo.brand !== 'À identifier' ? eqInfo.brand : '';
      const modelDisplay = eqInfo?.model && eqInfo.model !== 'À identifier' ? eqInfo.model : '';
      const headerLabel = [brandDisplay, modelDisplay].filter(Boolean).join(' ') || eqInfo?.equipment_type || '';
      
      yPos = addSection(`ÉQUIPEMENT ${i + 1}: ${headerLabel}`, yPos, true);
      doc.setTextColor(0, 0, 0);
      
      // Equipment details - exclude "À identifier" values
      if (eqInfo) {
        yPos = addField("Type", eqInfo.equipment_type, yPos);
        if (eqInfo.brand && eqInfo.brand !== 'À identifier') {
          yPos = addField("Marque", eqInfo.brand, yPos);
        }
        if (eqInfo.model && eqInfo.model !== 'À identifier') {
          yPos = addField("Modèle", eqInfo.model, yPos);
        }
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

      // État de l'équipement
      checkNewPage(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("État de l'équipement", 15, yPos);
      doc.setFont("helvetica", "normal");
      yPos += 5;
      doc.setFontSize(9);
      const getEquipmentStatusLabel = (status: EquipmentStatus | null) => {
        switch (status) {
          case 'not_working': return 'Ne fonctionne pas';
          case 'needs_intervention': return 'Fonctionne - Pièces ou intervention nécessaire';
          case 'working': return 'Fonctionne';
          default: return 'Non renseigné';
        }
      };
      doc.text(`État: ${getEquipmentStatusLabel(eq.equipment_status)}`, 15, yPos);
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
    if (equipment.brand && equipment.brand !== 'À identifier') {
      yPos = addField("Marque", equipment.brand, yPos);
    }
    if (equipment.model && equipment.model !== 'À identifier') {
      yPos = addField("Modèle", equipment.model, yPos);
    }
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
    
    // Custom footer text or default
    const footerContent = settings.footerText 
      ? `${settings.footerText} - Page ${i}/${totalPages}`
      : `Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} - Page ${i}/${totalPages}`;
    
    centerText(footerContent, footerY, 8);
    
    // Add company address in footer if configured
    if (settings.companyAddress) {
      doc.setFontSize(7);
      centerText(settings.companyAddress, footerY - 5, 7);
    }
  }

  // Save
  doc.save(`intervention-${intervention.id.slice(0, 8)}.pdf`);
};
